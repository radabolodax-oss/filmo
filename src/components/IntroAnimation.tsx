import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { useWebHaptics } from 'web-haptics/react';
import { useTranslation } from 'react-i18next';
import { useIntro } from '../context/IntroContext';

interface IntroAnimationProps {
  onAnimationComplete: () => void;
}

const LETTERS = ['D', 'A', 'W', 'G', 'E', 'R'] as const;

function makeParticles(count: number) {
  return Array.from({ length: count }, () => ({
    angle: Math.random() * Math.PI * 2,
    dist: 30 + Math.random() * 90,
    size: 2 + Math.random() * 3,
    delay: Math.random() * 0.2,
    dur: 0.5 + Math.random() * 0.6,
  }));
}

const IntroAnimation: React.FC<IntroAnimationProps> = ({ onAnimationComplete }) => {
  const { t } = useTranslation();
  const [revealedLetters, setRevealedLetters] = useState<number>(-1);
  const [flash, setFlash] = useState<string | null>(null);
  const [shaking, setShaking] = useState(false);
  const [flareActive, setFlareActive] = useState(false);
  const [showTagline, setShowTagline] = useState(false);
  const [isFading, setIsFading] = useState(false);
  const { skipIntro } = useIntro();

  const { trigger: haptic } = useWebHaptics();

  const particles = useMemo(() => makeParticles(24), []);

  const finish = useCallback(() => {
    document.body.style.overflow = '';
    onAnimationComplete();
  }, [onAnimationComplete]);

  const triggerFlash = useCallback((color: string, dur = 200) => {
    setFlash(color);
    setTimeout(() => setFlash(null), dur);
  }, []);

  const triggerShake = useCallback((dur = 300) => {
    setShaking(true);
    setTimeout(() => setShaking(false), dur);
  }, []);

  // Lock scroll immediately
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = '';
    };
  }, []);

  const vibe = useCallback((pattern: number[], type: 'heavy' | 'medium' | 'selection' = 'medium') => {
    if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
      try { navigator.vibrate(pattern); } catch {}
    } else {
      try { haptic(type); } catch {}
    }
  }, [haptic]);

  useEffect(() => {
    const timers: ReturnType<typeof setTimeout>[] = [];
    const schedule = (fn: () => void, ms: number) => {
      timers.push(setTimeout(fn, ms));
    };

    // Timeline des lettres DAWGER (rapide, dynamique, cinématique)
    schedule(() => { setRevealedLetters(0); triggerFlash('rgba(239,68,68,0.25)', 160); vibe([35], 'heavy'); }, 400);  // D
    schedule(() => { setRevealedLetters(1); vibe([25], 'medium'); }, 700);                                              // A
    schedule(() => { setRevealedLetters(2); vibe([30], 'heavy'); }, 1000);                                             // W
    schedule(() => { setRevealedLetters(3); vibe([25], 'medium'); }, 1300);                                             // G
    schedule(() => { setRevealedLetters(4); vibe([25], 'medium'); }, 1600);                                             // E
    schedule(() => { setRevealedLetters(5); triggerFlash('rgba(239,68,68,0.35)', 200); triggerShake(250); vibe([50, 30, 80], 'heavy'); }, 1900); // R

    // Balayage lumineux (flare) + Tagline
    schedule(() => { setFlareActive(true); setShowTagline(true); vibe([20], 'selection'); }, 2300);

    // Fade out
    schedule(() => { setIsFading(true); }, 3300);
    schedule(finish, 3800);

    return () => {
      timers.forEach(clearTimeout);
    };
  }, [finish, triggerFlash, triggerShake, vibe]);

  // Raccourci Clavier pour passer l'intro
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' || e.key === ' ' || e.key === 'Enter') {
        finish();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [finish]);

  return (
    <div
      className={`fixed inset-0 z-[99999] overflow-hidden select-none transition-opacity duration-700
        ${isFading ? 'opacity-0 pointer-events-none' : 'opacity-100'}
        ${shaking ? 'intro-shake' : ''}`}
      style={{
        background: 'radial-gradient(ellipse at center, #0f0a0c 0%, #050406 60%, #000000 100%)',
        height: '100dvh',
        touchAction: 'none'
      }}
    >
      <style>{KEYFRAMES}</style>

      {/* Grille d'ambiance */}
      <div
        className="absolute inset-0 opacity-20 pointer-events-none"
        style={{
          backgroundImage: 'radial-gradient(circle, rgba(239,68,68,0.15) 1px, transparent 1px)',
          backgroundSize: '32px 32px',
        }}
      />

      {/* Halo lumineux central */}
      <div
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[300px] h-[300px] sm:w-[600px] sm:h-[600px] rounded-full pointer-events-none"
        style={{
          background: 'radial-gradient(circle, rgba(239,68,68,0.14) 0%, rgba(220,38,38,0.04) 45%, transparent 70%)',
          filter: 'blur(50px)',
        }}
      />

      {/* Flash visuel */}
      {flash && (
        <div
          className="absolute inset-0 z-40 pointer-events-none transition-opacity duration-200"
          style={{ backgroundColor: flash }}
        />
      )}

      {/* Conteneur principal des lettres DAWGER */}
      <div className="absolute inset-0 flex flex-col items-center justify-center z-20 px-4">
        <div className="relative flex items-center justify-center">
          <h1 className="text-5xl sm:text-7xl md:text-8xl lg:text-9xl font-black tracking-[0.2em] sm:tracking-[0.28em] flex items-center text-white">
            {LETTERS.map((char, index) => {
              const isVisible = revealedLetters >= index;
              return (
                <span
                  key={char + index}
                  className={`inline-block transition-all duration-300 relative ${
                    isVisible ? 'opacity-100 scale-100' : 'opacity-0 scale-150 blur-md'
                  }`}
                  style={{
                    color: index === LETTERS.length - 1 ? '#ef4444' : '#ffffff',
                    textShadow: index === LETTERS.length - 1
                      ? '0 0 30px rgba(239,68,68,0.8), 0 0 60px rgba(239,68,68,0.4)'
                      : '0 0 25px rgba(255,255,255,0.4), 0 0 50px rgba(239,68,68,0.3)',
                    transformOrigin: 'center center',
                  }}
                >
                  {char}
                </span>
              );
            })}
          </h1>

          {/* Balayage lumineux flare */}
          {flareActive && (
            <div className="absolute top-0 bottom-0 left-0 right-0 overflow-hidden pointer-events-none">
              <div
                className="dawger-flare-sweep"
                style={{
                  position: 'absolute',
                  top: '-20%',
                  bottom: '-20%',
                  width: '90px',
                  background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.7) 45%, rgba(239,68,68,0.9) 55%, transparent)',
                  filter: 'blur(10px)',
                  transform: 'skewX(-20deg)',
                }}
              />
            </div>
          )}
        </div>

        {/* Ligne d'accent élégante */}
        <div
          className={`h-[2px] mt-4 sm:mt-6 transition-all duration-700 ${
            revealedLetters >= 5 ? 'w-48 sm:w-80 opacity-80' : 'w-0 opacity-0'
          }`}
          style={{
            background: 'linear-gradient(90deg, transparent, rgba(239,68,68,0.8), rgba(255,255,255,0.9), rgba(239,68,68,0.8), transparent)',
          }}
        />

        {/* Tagline */}
        <p
          className={`mt-4 sm:mt-5 text-[11px] sm:text-xs md:text-sm tracking-[0.35em] sm:tracking-[0.45em] uppercase font-mono text-gray-400/90 transition-all duration-700 ${
            showTagline ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-3'
          }`}
        >
          {t('introAnimation.tagline', 'Le streaming. Repensé.')}
        </p>
      </div>

      {/* Particules légères au centre */}
      {revealedLetters >= 0 && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
          {particles.map((p, i) => (
            <div
              key={i}
              className="absolute rounded-full dawger-particle"
              style={{
                width: p.size,
                height: p.size,
                backgroundColor: i % 2 === 0 ? '#ef4444' : '#ffffff',
                boxShadow: `0 0 10px ${i % 2 === 0 ? 'rgba(239,68,68,0.8)' : 'rgba(255,255,255,0.8)'}`,
                '--px': `${Math.cos(p.angle) * p.dist}px`,
                '--py': `${Math.sin(p.angle) * p.dist}px`,
                animationDuration: `${p.dur}s`,
                animationDelay: `${p.delay}s`,
              } as React.CSSProperties}
            />
          ))}
        </div>
      )}

      {/* Bouton Passer */}
      <button
        onClick={() => {
          vibe([20], 'selection');
          skipIntro();
          finish();
        }}
        className="absolute top-5 right-5 sm:top-6 sm:right-6 text-white/40 hover:text-white text-[11px] sm:text-xs
                  px-3 py-1.5 sm:px-4 sm:py-2 transition-all duration-200 hover:bg-white/10 rounded-lg
                  border border-white/10 hover:border-white/25 z-[100000] font-mono tracking-widest uppercase"
      >
        {t('introAnimation.skip', 'Passer')}
      </button>
    </div>
  );
};

export default IntroAnimation;

const KEYFRAMES = `
@keyframes dawgerShake {
  0%, 100% { transform: translate(0, 0); }
  20% { transform: translate(-2px, 2px); }
  40% { transform: translate(2px, -1px); }
  60% { transform: translate(-1px, 1px); }
  80% { transform: translate(1px, -1px); }
}

.intro-shake {
  animation: dawgerShake 0.25s ease-in-out;
}

@keyframes flareSweep {
  0% { left: -150px; }
  100% { left: calc(100% + 150px); }
}

.dawger-flare-sweep {
  animation: flareSweep 0.9s cubic-bezier(0.2, 0.8, 0.2, 1) forwards;
}

@keyframes dawgerParticleMove {
  0% {
    transform: translate(0, 0) scale(1);
    opacity: 1;
  }
  100% {
    transform: translate(var(--px), var(--py)) scale(0);
    opacity: 0;
  }
}

.dawger-particle {
  animation: dawgerParticleMove 0.8s ease-out forwards;
}
`;
