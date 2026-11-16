import React, { useEffect, useRef, useState, useCallback } from 'react';

/**
 * VisualEffectsLayer handles:
 * 1. Accumulating snow (drifts up to ~1cm / 30px at the bottom of the screen).
 * 2. Halloween Bat effect (wanders periodically ~1x/hour at irregular times,
 *    rushes the screen in 3D, impacts with cracked glass, then fades out).
 *    Strictly paused during video playback / fullscreen.
 */

// --- Audio synthesis for glass impact ---
function playImpactSound() {
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();
    if (ctx.state === 'suspended') {
      ctx.resume().catch(() => {});
    }
    const now = ctx.currentTime;

    // 1. Sharp high-frequency snap
    const snapOsc = ctx.createOscillator();
    const snapGain = ctx.createGain();
    snapOsc.type = 'triangle';
    snapOsc.frequency.setValueAtTime(3400, now);
    snapOsc.frequency.exponentialRampToValueAtTime(320, now + 0.07);
    snapGain.gain.setValueAtTime(0.45, now);
    snapGain.gain.exponentialRampToValueAtTime(0.001, now + 0.07);
    snapOsc.connect(snapGain);
    snapGain.connect(ctx.destination);
    snapOsc.start(now);
    snapOsc.stop(now + 0.08);

    // 2. Filtered noise burst (crackling glass texture)
    const bufferSize = Math.floor(ctx.sampleRate * 0.22);
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (ctx.sampleRate * 0.04));
    }
    const noise = ctx.createBufferSource();
    noise.buffer = buffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.setValueAtTime(1200, now);
    const noiseGain = ctx.createGain();
    noiseGain.gain.setValueAtTime(0.55, now);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);
    noise.connect(filter);
    filter.connect(noiseGain);
    noiseGain.connect(ctx.destination);
    noise.start(now);
    noise.stop(now + 0.23);

    // 3. Resonant thud (impact against glass)
    const thud = ctx.createOscillator();
    const thudGain = ctx.createGain();
    thud.type = 'sine';
    thud.frequency.setValueAtTime(160, now);
    thud.frequency.exponentialRampToValueAtTime(38, now + 0.16);
    thudGain.gain.setValueAtTime(0.65, now);
    thudGain.gain.exponentialRampToValueAtTime(0.001, now + 0.16);
    thud.connect(thudGain);
    thudGain.connect(ctx.destination);
    thud.start(now);
    thud.stop(now + 0.17);
  } catch {
    // Silent fallback
  }
}

// --- Bat SVG Component with animated wings ---
const BatGraphic: React.FC<{ flapping: boolean }> = ({ flapping }) => (
  <svg
    viewBox="0 0 200 120"
    className={`w-full h-full filter drop-shadow-[0_8px_16px_rgba(0,0,0,0.85)] ${flapping ? 'animate-pulse' : ''}`}
    fill="currentColor"
    style={{ color: '#16121e' }}
  >
    {/* Bat body */}
    <ellipse cx="100" cy="62" rx="14" ry="24" fill="#0d0a14" />
    {/* Head & Ears */}
    <circle cx="100" cy="40" r="11" fill="#0d0a14" />
    <polygon points="92,40 86,22 97,33" fill="#1b1528" />
    <polygon points="108,40 114,22 103,33" fill="#1b1528" />
    {/* Glowing red spooky eyes */}
    <circle cx="96" cy="38" r="2" fill="#ef4444" />
    <circle cx="104" cy="38" r="2" fill="#ef4444" />
    {/* Left wing with ribs */}
    <path
      d="M 94 54 C 80 32 50 20 20 28 C 12 44 26 62 10 74 C 28 78 44 68 52 82 C 68 84 78 72 90 76 Z"
      fill="#141020"
      stroke="#221834"
      strokeWidth="1.5"
    />
    <path d="M 90 54 Q 50 38 20 28 M 60 50 Q 35 60 10 74 M 72 65 Q 60 76 52 82" stroke="#2b2040" strokeWidth="1" fill="none" />
    {/* Right wing with ribs */}
    <path
      d="M 106 54 C 120 32 150 20 180 28 C 188 44 174 62 190 74 C 172 78 156 68 148 82 C 132 84 122 72 110 76 Z"
      fill="#141020"
      stroke="#221834"
      strokeWidth="1.5"
    />
    <path d="M 110 54 Q 150 38 180 28 M 140 50 Q 165 60 190 74 M 128 65 Q 140 76 148 82" stroke="#2b2040" strokeWidth="1" fill="none" />
    {/* Little fangs */}
    <polygon points="98,46 99,50 100,46" fill="#f8fafc" />
    <polygon points="100,46 101,50 102,46" fill="#f8fafc" />
  </svg>
);

// --- Realistic Glass Crack SVG ---
const CrackedGlassOverlay: React.FC<{ x: number; y: number; opacity: number }> = ({ x, y, opacity }) => (
  <div
    className="fixed pointer-events-none z-[999999] transition-opacity duration-700 select-none"
    style={{
      left: `${x}px`,
      top: `${y}px`,
      width: '560px',
      height: '560px',
      transform: 'translate(-50%, -50%)',
      opacity,
    }}
  >
    <svg
      viewBox="0 0 500 500"
      className="w-full h-full overflow-visible"
      style={{
        filter: 'drop-shadow(0 0 1px #ffffff) drop-shadow(0 0 8px rgba(0,0,0,0.85))',
      }}
    >
      {/* Central Impact hole */}
      <circle cx="250" cy="250" r="14" fill="rgba(255,255,255,0.45)" stroke="#ffffff" strokeWidth="2" />
      <polygon points="244,242 258,240 264,254 252,264 240,256" fill="rgba(255,255,255,0.3)" stroke="#ffffff" strokeWidth="1.5" />

      {/* Radial spiderweb cracks emanating from 250, 250 */}
      <path
        d="M 250 250 L 160 140 L 90 100 L 20 50 
           M 250 250 L 210 120 L 200 40 L 190 0 
           M 250 250 L 310 130 L 370 70 L 440 20 
           M 250 250 L 370 200 L 450 180 L 500 170 
           M 250 250 L 380 290 L 460 350 L 490 420 
           M 250 250 L 290 370 L 320 450 L 330 500 
           M 250 250 L 210 380 L 170 450 L 130 500 
           M 250 250 L 135 320 L 70 370 L 10 420 
           M 250 250 L 120 230 L 50 220 L 0 210
           M 250 250 L 170 190 L 100 180
           M 250 250 L 330 320 L 420 370"
        stroke="#ffffff"
        strokeWidth="2.2"
        strokeLinecap="round"
        fill="none"
        opacity="0.95"
      />
      {/* Concentric fracture rings */}
      <path
        d="M 225 220 Q 255 210 280 225 Q 290 255 275 280 Q 240 290 220 270 Z
           M 195 190 Q 260 165 315 195 Q 340 265 310 320 Q 240 345 185 305 Z
           M 155 150 Q 265 110 355 155 Q 400 270 350 365 Q 240 405 145 345 Z"
        stroke="#ffffff"
        strokeWidth="1.2"
        strokeDasharray="10,4"
        fill="none"
        opacity="0.8"
      />
      {/* Micro-shards */}
      <polygon points="245,230 260,220 252,238" fill="rgba(255,255,255,0.4)" stroke="#fff" strokeWidth="1" />
      <polygon points="265,255 278,248 270,268" fill="rgba(255,255,255,0.3)" stroke="#fff" strokeWidth="1" />
      <polygon points="230,260 240,272 225,275" fill="rgba(255,255,255,0.3)" stroke="#fff" strokeWidth="1" />
    </svg>
  </div>
);

export const VisualEffectsLayer: React.FC = () => {
  // --- Snow State (Désactivé par défaut tant que non activé dans les paramètres) ---
  const [isSnowActive, setIsSnowActive] = useState(() => {
    const localVal = localStorage.getItem('snowfall_active');
    if (localVal !== null) return localVal === 'true';
    const sessionVal = sessionStorage.getItem('snowfall_active');
    if (sessionVal !== null) return sessionVal === 'true';
    return false;
  });
  const snowCanvasRef = useRef<HTMLCanvasElement | null>(null);

  // --- Halloween Bat State (Désactivé par défaut tant que non activé dans les paramètres) ---
  const [batEnabled, setBatEnabled] = useState(() => {
    return localStorage.getItem('dawger_bat_enabled') === 'true';
  });

  // Stages: 'idle' | 'wandering' | 'dive' | 'impact' | 'fading'
  const [batStage, setBatStage] = useState<'idle' | 'wandering' | 'dive' | 'impact' | 'fading'>('idle');
  const [batPos, setBatPos] = useState({ x: -150, y: 100, scale: 0.35, rotate: 0 });
  const [impactPos, setImpactPos] = useState({ x: 500, y: 350 });
  const [crackOpacity, setCrackOpacity] = useState(0);
  const [isScreenShaking, setIsScreenShaking] = useState(false);

  // Check if video is playing or fullscreen active (do not disturb user)
  const isVideoPlayingOrFullscreen = useCallback(() => {
    if (typeof window === 'undefined') return false;
    if (document.fullscreenElement) return true;
    if (window.location.pathname.startsWith('/watch/')) return true;
    const videos = document.querySelectorAll('video');
    for (const v of Array.from(videos)) {
      if (!v.paused && !v.ended && v.readyState >= 2) return true;
    }
    return false;
  }, []);

  // Sync settings events
  useEffect(() => {
    const handleSnowToggle = () => {
      const localVal = localStorage.getItem('snowfall_active');
      const sessionVal = sessionStorage.getItem('snowfall_active');
      setIsSnowActive(localVal !== null ? localVal === 'true' : sessionVal === 'true');
    };
    const handleBatToggle = () => {
      setBatEnabled(localStorage.getItem('dawger_bat_enabled') === 'true');
    };

    window.addEventListener('snowfall_toggled', handleSnowToggle);
    window.addEventListener('dawger_bat_toggle_changed', handleBatToggle);
    return () => {
      window.removeEventListener('snowfall_toggled', handleSnowToggle);
      window.removeEventListener('dawger_bat_toggle_changed', handleBatToggle);
    };
  }, []);

  // Sync Halloween theme class on <html>
  useEffect(() => {
    if (typeof document !== 'undefined') {
      document.documentElement.classList.toggle('theme-halloween', batEnabled);
    }
  }, [batEnabled]);

  // --- Snow Accumulation Engine ---
  useEffect(() => {
    if (!isSnowActive) return;
    const canvas = snowCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = window.innerHeight);

    const handleResize = () => {
      if (!canvas) return;
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
    };
    window.addEventListener('resize', handleResize);

    const NUM_COLS = 120;
    const groundHeights = new Float32Array(NUM_COLS);
    const MAX_ACCUMULATION = 32; // ~1cm on standard displays

    // Initialize snowflakes
    const FLAKE_COUNT = Math.min(160, Math.floor(width / 10));
    const flakes = Array.from({ length: FLAKE_COUNT }, () => ({
      x: Math.random() * width,
      y: Math.random() * height,
      radius: 1.2 + Math.random() * 2.4,
      speedY: 0.9 + Math.random() * 1.8,
      speedX: (Math.random() - 0.5) * 0.8,
      sway: Math.random() * Math.PI * 2,
      swaySpeed: 0.02 + Math.random() * 0.03,
      alpha: 0.6 + Math.random() * 0.35,
    }));

    let animId = 0;
    const render = () => {
      ctx.clearRect(0, 0, width, height);

      // 1. Draw and accumulate bottom snowdrift
      ctx.beginPath();
      ctx.moveTo(0, height);
      for (let i = 0; i < NUM_COLS; i++) {
        const colX = (i / (NUM_COLS - 1)) * width;
        const colY = height - groundHeights[i];
        if (i === 0) {
          ctx.lineTo(colX, colY);
        } else {
          const prevX = ((i - 1) / (NUM_COLS - 1)) * width;
          const prevY = height - groundHeights[i - 1];
          const midX = (prevX + colX) / 2;
          const midY = (prevY + colY) / 2;
          ctx.quadraticCurveTo(prevX, prevY, midX, midY);
        }
      }
      ctx.lineTo(width, height);
      ctx.closePath();

      const snowGrad = ctx.createLinearGradient(0, height - MAX_ACCUMULATION, 0, height);
      snowGrad.addColorStop(0, 'rgba(255, 255, 255, 0.96)');
      snowGrad.addColorStop(0.35, 'rgba(240, 246, 255, 0.92)');
      snowGrad.addColorStop(1, 'rgba(215, 230, 250, 0.88)');
      ctx.fillStyle = snowGrad;
      ctx.fill();

      // Top soft highlight edge
      ctx.lineWidth = 1.2;
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.9)';
      ctx.stroke();

      // 2. Draw falling flakes
      for (let i = 0; i < flakes.length; i++) {
        const f = flakes[i];
        f.sway += f.swaySpeed;
        f.x += f.speedX + Math.sin(f.sway) * 0.5;
        f.y += f.speedY;

        const col = Math.min(NUM_COLS - 1, Math.max(0, Math.floor((f.x / width) * NUM_COLS)));
        const targetGroundY = height - groundHeights[col];

        // Snow lands on top of accumulation
        if (f.y >= targetGroundY) {
          if (groundHeights[col] < MAX_ACCUMULATION) {
            groundHeights[col] += 0.35;
            // Diffuse accumulation gently to adjacent columns for organic mound shape
            if (col > 0 && groundHeights[col - 1] < groundHeights[col] - 1) {
              groundHeights[col - 1] += 0.15;
            }
            if (col < NUM_COLS - 1 && groundHeights[col + 1] < groundHeights[col] - 1) {
              groundHeights[col + 1] += 0.15;
            }
          }
          // Respawn at top
          f.y = -8;
          f.x = Math.random() * width;
        }

        // Screen wrap
        if (f.x < -10) f.x = width + 10;
        if (f.x > width + 10) f.x = -10;

        ctx.beginPath();
        ctx.arc(f.x, f.y, f.radius, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255, 255, 255, ${f.alpha})`;
        ctx.fill();
      }

      animId = requestAnimationFrame(render);
    };

    animId = requestAnimationFrame(render);

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', handleResize);
    };
  }, [isSnowActive]);

  // --- Bat Trigger Sequence Execution ---
  const launchBatSequence = useCallback(() => {
    if (batStage !== 'idle') return;

    const w = window.innerWidth;
    const h = window.innerHeight;
    const fromLeft = Math.random() > 0.5;
    const startX = fromLeft ? -120 : w + 120;
    const startY = 80 + Math.random() * (h * 0.4);

    const targetImpactX = w * (0.35 + Math.random() * 0.3);
    const targetImpactY = h * (0.35 + Math.random() * 0.3);
    setImpactPos({ x: targetImpactX, y: targetImpactY });

    // Step 1: Wandering
    setBatStage('wandering');
    setBatPos({ x: startX, y: startY, scale: 0.35, rotate: fromLeft ? 20 : -20 });

    const wanderDuration = 3200;
    const startTime = performance.now();

    const wanderStep = (now: number) => {
      const elapsed = now - startTime;
      const progress = Math.min(1, elapsed / wanderDuration);

      const curX = startX + (targetImpactX - startX) * progress;
      const curY = startY + Math.sin(progress * Math.PI * 4) * 45 + (targetImpactY - 120 - startY) * progress;
      const angle = Math.sin(progress * Math.PI * 4) * 25 + (fromLeft ? 15 : -15);

      setBatPos({ x: curX, y: curY, scale: 0.35 + progress * 0.15, rotate: angle });

      if (progress < 1) {
        requestAnimationFrame(wanderStep);
      } else {
        // Step 2: Sudden 3D dive towards camera ("hop hop !")
        setBatStage('dive');
        const diveStart = performance.now();
        const diveDuration = 520;

        const diveStep = (diveNow: number) => {
          const diveElapsed = diveNow - diveStart;
          const diveProgress = Math.min(1, diveElapsed / diveDuration);
          // Ease in quad for dramatic acceleration
          const easeProgress = diveProgress * diveProgress;

          const dx = curX + (targetImpactX - curX) * easeProgress;
          const dy = curY + (targetImpactY - curY) * easeProgress;
          const dScale = 0.5 + easeProgress * 3.8;

          setBatPos({ x: dx, y: dy, scale: dScale, rotate: 0 });

          if (diveProgress < 1) {
            requestAnimationFrame(diveStep);
          } else {
            // Step 3: Impact!
            setBatStage('impact');
            playImpactSound();
            setIsScreenShaking(true);
            setCrackOpacity(1);

            setTimeout(() => {
              setIsScreenShaking(false);
            }, 160);

            // Hide bat quickly upon impact
            setBatPos({ x: targetImpactX, y: targetImpactY, scale: 0, rotate: 0 });

            // Step 4: Fade out crack after 1.2s delay
            setTimeout(() => {
              setBatStage('fading');
              setCrackOpacity(0);
              setTimeout(() => {
                setBatStage('idle');
              }, 1600);
            }, 1200);
          }
        };
        requestAnimationFrame(diveStep);
      }
    };

    requestAnimationFrame(wanderStep);
  }, [batStage]);

  // Manual test trigger event from Settings
  useEffect(() => {
    const handleTest = () => {
      launchBatSequence();
    };
    window.addEventListener('dawger_trigger_bat_test', handleTest);
    return () => window.removeEventListener('dawger_trigger_bat_test', handleTest);
  }, [launchBatSequence]);

  // Periodic random schedule (premier passage découverte à ~24s puis ~1h imprévisible: 50 à 95 mins)
  useEffect(() => {
    if (!batEnabled) return;

    // Check & initialize next trigger time in localStorage
    const now = Date.now();
    const hasSeenFirst = localStorage.getItem('dawger_bat_seen_first') === 'true';
    let nextTime = Number(localStorage.getItem('dawger_bat_next_time'));

    if (!hasSeenFirst) {
      // Première apparition rapide au bout de 24 secondes de visite pour la découverte !
      nextTime = now + 24000;
      localStorage.setItem('dawger_bat_next_time', String(nextTime));
    } else if (!nextTime || isNaN(nextTime) || nextTime < now - 3600000) {
      // Rythme régulier : délai aléatoire entre 50 et 95 minutes
      const randomMinutes = 50 + Math.random() * 45;
      nextTime = now + randomMinutes * 60 * 1000;
      localStorage.setItem('dawger_bat_next_time', String(nextTime));
    }

    const interval = setInterval(() => {
      const current = Date.now();
      const scheduled = Number(localStorage.getItem('dawger_bat_next_time'));

      if (current >= scheduled) {
        // Anti-spoil check: if user is watching a video or in fullscreen, postpone by 3 minutes
        if (isVideoPlayingOrFullscreen()) {
          const postponeTime = current + 3 * 60 * 1000;
          localStorage.setItem('dawger_bat_next_time', String(postponeTime));
          return;
        }

        // Marquer la première apparition comme vue
        localStorage.setItem('dawger_bat_seen_first', 'true');

        // Safe to launch!
        launchBatSequence();

        // Reschedule next random time (50 to 95 minutes in the future)
        const nextDelay = (50 + Math.random() * 45) * 60 * 1000;
        localStorage.setItem('dawger_bat_next_time', String(Date.now() + nextDelay));
      }
    }, 3000); // Check every 3s

    return () => clearInterval(interval);
  }, [batEnabled, isVideoPlayingOrFullscreen, launchBatSequence]);

  return (
    <>
      {/* Accumulating Snow Canvas */}
      {isSnowActive && (
        <canvas
          ref={snowCanvasRef}
          className="fixed inset-0 pointer-events-none z-[999990] select-none"
        />
      )}

      {/* Halloween Theme Overlay (Movix style: ambient purple/orange aura + subtle corner cobwebs) */}
      {batEnabled && !isVideoPlayingOrFullscreen() && (
        <div
          aria-hidden="true"
          className="fixed inset-0 pointer-events-none z-[1] overflow-hidden select-none"
        >
          <div
            className="absolute inset-x-0 top-0 h-64 opacity-40"
            style={{
              background: 'radial-gradient(ellipse 80% 60% at 50% 0%, rgba(249,115,22,0.22) 0%, rgba(147,51,234,0.16) 45%, transparent 80%)',
            }}
          />
          <svg
            viewBox="0 0 120 120"
            className="absolute top-0 left-0 w-24 h-24 sm:w-32 sm:h-32 text-orange-400/20"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.2"
          >
            <path d="M0,0 L110,15 M0,0 L95,55 M0,0 L65,95 M0,0 L20,115" />
            <path d="M25,4 Q20,18 5,26 M50,7 Q40,32 10,48 M78,11 Q62,48 14,72 M102,14 Q82,66 18,98" />
          </svg>
          <svg
            viewBox="0 0 120 120"
            className="absolute top-0 right-0 w-24 h-24 sm:w-32 sm:h-32 text-purple-400/20 -scale-x-100"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.2"
          >
            <path d="M0,0 L110,15 M0,0 L95,55 M0,0 L65,95 M0,0 L20,115" />
            <path d="M25,4 Q20,18 5,26 M50,7 Q40,32 10,48 M78,11 Q62,48 14,72 M102,14 Q82,66 18,98" />
          </svg>
        </div>
      )}

      {/* Cracked glass impact overlay */}
      {crackOpacity > 0 && (
        <CrackedGlassOverlay x={impactPos.x} y={impactPos.y} opacity={crackOpacity} />
      )}

      {/* Flying / Swooping Bat */}
      {batStage !== 'idle' && (
        <div
          className="fixed pointer-events-none z-[999995] will-change-transform select-none"
          style={{
            left: `${batPos.x}px`,
            top: `${batPos.y}px`,
            width: '120px',
            height: '70px',
            transform: `translate(-50%, -50%) scale(${batPos.scale}) rotate(${batPos.rotate}deg)`,
            transition: batStage === 'dive' ? 'none' : 'filter 200ms ease',
            filter: batStage === 'dive' ? 'blur(1.5px)' : undefined,
          }}
        >
          <BatGraphic flapping={true} />
        </div>
      )}

      {/* Screen shake style */}
      {isScreenShaking && (
        <style dangerouslySetInnerHTML={{
          __html: `
            body {
              animation: dawgerScreenShake 150ms cubic-bezier(.36,.07,.19,.97) both !important;
            }
            @keyframes dawgerScreenShake {
              10%, 90% { transform: translate3d(-3px, 2px, 0); }
              20%, 80% { transform: translate3d(4px, -3px, 0); }
              30%, 50%, 70% { transform: translate3d(-4px, 4px, 0); }
              40%, 60% { transform: translate3d(3px, -2px, 0); }
            }
          `
        }} />
      )}
    </>
  );
};

export default VisualEffectsLayer;
