import React, { useEffect, useRef, useState } from 'react';
import { PREFS_CHANGED_EVENT, readAmbilightEnabled } from '../utils/playerVisualPrefs';

interface PlayerStageProps {
  backdrop?: string | null;
  className?: string;
  children: React.ReactNode;
}

interface EdgeColors {
  top: string;
  right: string;
  bottom: string;
  left: string;
}

const DEFAULT_EDGE_COLORS: EdgeColors = {
  top: 'rgba(0,0,0,0)',
  right: 'rgba(0,0,0,0)',
  bottom: 'rgba(0,0,0,0)',
  left: 'rgba(0,0,0,0)',
};

const SAMPLE_W = 16;
const SAMPLE_H = 9;

const resolveBackdropUrl = (backdrop?: string | null): string | null => {
  if (!backdrop) return null;
  if (/^https?:\/\//i.test(backdrop) || backdrop.startsWith('data:')) {
    return backdrop;
  }
  return `https://image.tmdb.org/t/p/w780${backdrop.startsWith('/') ? backdrop : `/${backdrop}`}`;
};

const boostEdgeRgb = (r: number, g: number, b: number, alpha = 0.72): string => {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  if (max < 8) return `rgba(0,0,0,0)`;

  const avg = (r + g + b) / 3;
  const boost = 1.45;
  const clamp = (n: number) => Math.max(0, Math.min(255, Math.round(n)));
  // Gently lift very dark shadows while exaggerating chroma separation
  const lumLift = max < 42 && max > min + 4 ? 1.55 : 1.12;
  const br = clamp((avg + (r - avg) * boost) * lumLift);
  const bg = clamp((avg + (g - avg) * boost) * lumLift);
  const bb = clamp((avg + (b - avg) * boost) * lumLift);
  return `rgba(${br},${bg},${bb},${alpha})`;
};

/**
 * Finds non-black vertical bounds to avoid black cinemascope bars turning the
 * top and bottom Ambilight edges solid black, and samples 4 edge zone colors.
 */
function analyzeFrameEdges(
  sampleCtx: CanvasRenderingContext2D,
  video: HTMLVideoElement,
): { edges: EdgeColors; topCropRatio: number; bottomCropRatio: number } {
  sampleCtx.drawImage(video, 0, 0, SAMPLE_W, SAMPLE_H);
  const data = sampleCtx.getImageData(0, 0, SAMPLE_W, SAMPLE_H).data;

  const pixelLum = (x: number, y: number) => {
    const i = (y * SAMPLE_W + x) * 4;
    return data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114;
  };

  let topRow = 0;
  while (topRow < Math.floor(SAMPLE_H * 0.28)) {
    let rowSum = 0;
    for (let x = 2; x < SAMPLE_W - 2; x++) rowSum += pixelLum(x, topRow);
    if (rowSum / (SAMPLE_W - 4) > 10) break;
    topRow++;
  }

  let bottomRow = SAMPLE_H - 1;
  while (bottomRow > Math.ceil(SAMPLE_H * 0.72)) {
    let rowSum = 0;
    for (let x = 2; x < SAMPLE_W - 2; x++) rowSum += pixelLum(x, bottomRow);
    if (rowSum / (SAMPLE_W - 4) > 10) break;
    bottomRow--;
  }

  if (bottomRow <= topRow + 2) {
    topRow = 0;
    bottomRow = SAMPLE_H - 1;
  }

  const avgRegion = (x0: number, x1: number, y0: number, y1: number) => {
    let r = 0, g = 0, b = 0, count = 0;
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        const i = (y * SAMPLE_W + x) * 4;
        r += data[i];
        g += data[i + 1];
        b += data[i + 2];
        count++;
      }
    }
    if (!count) return 'rgba(0,0,0,0)';
    return boostEdgeRgb(r / count, g / count, b / count);
  };

  const innerH = Math.max(1, bottomRow - topRow + 1);
  const bandY = Math.max(1, Math.floor(innerH * 0.3));

  return {
    edges: {
      top: avgRegion(1, SAMPLE_W - 2, topRow, Math.min(bottomRow, topRow + bandY)),
      bottom: avgRegion(1, SAMPLE_W - 2, Math.max(topRow, bottomRow - bandY), bottomRow),
      left: avgRegion(0, 3, topRow, bottomRow),
      right: avgRegion(SAMPLE_W - 4, SAMPLE_W - 1, topRow, bottomRow),
    },
    topCropRatio: topRow / SAMPLE_H,
    bottomCropRatio: (SAMPLE_H - 1 - bottomRow) / SAMPLE_H,
  };
}

function findActiveVideo(stage: HTMLElement): HTMLVideoElement | null {
  const candidates: HTMLVideoElement[] = Array.from(stage.querySelectorAll('video'));
  const iframes = stage.querySelectorAll('iframe');
  iframes.forEach((frame) => {
    try {
      const doc = frame.contentDocument;
      if (doc) candidates.push(...Array.from(doc.querySelectorAll('video')));
    } catch {
      // Cross-origin iframe relies on postMessage telemetry instead
    }
  });

  if (candidates.length === 0) return null;

  // Prefer actively playing video with real decoded dimensions
  const playing = candidates.find(
    (v) => v.readyState >= 2 && v.videoWidth > 0 && v.videoHeight > 0 && !v.paused && !v.ended,
  );
  if (playing) return playing;

  // Fallback to largest ready video element (ignores hidden source-menu HLSPlayer instances)
  return (
    candidates.find((v) => v.readyState >= 2 && v.videoWidth > 0 && v.videoHeight > 0 && v.offsetWidth > 0) ||
    candidates[0]
  );
}

/**
 * Wraps the player container in an isolated stacking context and projects a
 * real-time multi-layer Ambilight halo behind it (direct HTML5 `<video>` frame
 * sampling + letterbox cropping + 4-edge directional gradients + embed postMessage),
 * falling back to the blurred TMDB backdrop before playback starts.
 */
export const PlayerStage: React.FC<PlayerStageProps> = ({
  backdrop,
  className = 'relative w-full aspect-video rounded-lg overflow-hidden bg-black',
  children,
}) => {
  const stageRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const glowLayerRef = useRef<HTMLDivElement>(null);
  const [enabled, setEnabled] = useState<boolean>(() => readAmbilightEnabled());
  const [hasLiveFrames, setHasLiveFrames] = useState(false);
  const [hasExternalGlow, setHasExternalGlow] = useState(false);
  const liveRef = useRef(false);

  const applyEdgeVars = (edges: EdgeColors) => {
    const el = glowLayerRef.current;
    if (!el) return;
    el.style.setProperty('--ambi-top', edges.top);
    el.style.setProperty('--ambi-right', edges.right);
    el.style.setProperty('--ambi-bottom', edges.bottom);
    el.style.setProperty('--ambi-left', edges.left);
  };

  useEffect(() => {
    const syncPref = () => setEnabled(readAmbilightEnabled());
    window.addEventListener(PREFS_CHANGED_EVENT, syncPref);
    window.addEventListener('storage', syncPref);
    return () => {
      window.removeEventListener(PREFS_CHANGED_EVENT, syncPref);
      window.removeEventListener('storage', syncPref);
    };
  }, []);

  // Listen for live edge colors posted by same-tech embed players (/api/webflix/embed, /api/miaw/miaw-embed)
  useEffect(() => {
    if (!enabled) {
      setHasExternalGlow(false);
      return;
    }

    let expireTimer: number | null = null;
    const onMessage = (event: MessageEvent) => {
      const data = event.data;
      if (!data || data.type !== 'dawger-ambilight-colors') return;
      if (data.active === false) {
        setHasExternalGlow(false);
        return;
      }
      if (data.top && data.right && data.bottom && data.left) {
        applyEdgeVars({
          top: String(data.top),
          right: String(data.right),
          bottom: String(data.bottom),
          left: String(data.left),
        });
        setHasExternalGlow(true);
        if (expireTimer) window.clearTimeout(expireTimer);
        expireTimer = window.setTimeout(() => setHasExternalGlow(false), 2500);
      }
    };

    window.addEventListener('message', onMessage);
    return () => {
      window.removeEventListener('message', onMessage);
      if (expireTimer) window.clearTimeout(expireTimer);
    };
  }, [enabled]);

  useEffect(() => {
    if (!enabled) {
      liveRef.current = false;
      setHasLiveFrames(false);
      applyEdgeVars(DEFAULT_EDGE_COLORS);
      return;
    }

    const stage = stageRef.current;
    const canvas = canvasRef.current;
    if (!stage || !canvas) return;

    const ctx = canvas.getContext('2d', { alpha: false, willReadFrequently: false });
    if (!ctx) return;

    const sampleCanvas = document.createElement('canvas');
    sampleCanvas.width = SAMPLE_W;
    sampleCanvas.height = SAMPLE_H;
    const sampleCtx = sampleCanvas.getContext('2d', { alpha: false, willReadFrequently: true });

    let stopped = false;
    let rafId = 0;
    let lastDraw = 0;
    let lastVideoTime = -1;
    let taintedSrc: string | null = null;

    const setLive = (next: boolean) => {
      if (liveRef.current !== next) {
        liveRef.current = next;
        setHasLiveFrames(next);
      }
    };

    const drawVideoFrame = (video: HTMLVideoElement) => {
      const vw = video.videoWidth;
      const vh = video.videoHeight;
      if (video.readyState < 2 || vw <= 0 || vh <= 0) return;

      const currentSrc = video.currentSrc || video.src || 'inline';
      if (taintedSrc === currentSrc) return;

      try {
        let sx = vw * 0.02;
        let sy = vh * 0.08;
        let sw = vw * 0.96;
        let sh = vh * 0.84;

        if (sampleCtx) {
          const { edges, topCropRatio, bottomCropRatio } = analyzeFrameEdges(sampleCtx, video);
          applyEdgeVars(edges);
          const padTop = Math.max(0.02, topCropRatio);
          const padBottom = Math.max(0.02, bottomCropRatio);
          sy = vh * padTop;
          sh = Math.max(vh * 0.4, vh * (1 - padTop - padBottom));
        }

        ctx.drawImage(video, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);
        setLive(true);
      } catch {
        // Key taint by URL so changing sources clears the taint block automatically
        taintedSrc = currentSrc;
        setLive(false);
      }
    };

    const sampleFrame = (now: number) => {
      if (stopped) return;
      rafId = window.requestAnimationFrame(sampleFrame);

      if (now - lastDraw < 90) return;
      const video = findActiveVideo(stage);
      if (!video) {
        if (liveRef.current) setLive(false);
        return;
      }

      const timeMoved = Math.abs(video.currentTime - lastVideoTime) > 0.04;
      const shouldSample =
        video.readyState >= 2 &&
        video.videoWidth > 0 &&
        ((!video.paused && !video.ended) || timeMoved || !liveRef.current);

      if (shouldSample) {
        lastDraw = now;
        lastVideoTime = video.currentTime;
        drawVideoFrame(video);
      }
    };

    rafId = window.requestAnimationFrame(sampleFrame);

    return () => {
      stopped = true;
      if (rafId) window.cancelAnimationFrame(rafId);
    };
  }, [enabled]);

  const backdropUrl = resolveBackdropUrl(backdrop);
  const isReactingLive = hasLiveFrames || hasExternalGlow;

  return (
    <div ref={stageRef} className="relative isolate">
      {enabled && (
        <div
          ref={glowLayerRef}
          aria-hidden="true"
          className="pointer-events-none absolute -inset-8 sm:-inset-12 lg:-inset-16 z-0 overflow-visible select-none"
          style={{
            // Smooth 4-directional edge gradients react to live scene colors & iframe telemetry
            background: isReactingLive
              ? `radial-gradient(60% 45% at 50% 0%, var(--ambi-top, rgba(0,0,0,0)), transparent 75%),
                 radial-gradient(45% 60% at 100% 50%, var(--ambi-right, rgba(0,0,0,0)), transparent 75%),
                 radial-gradient(60% 45% at 50% 100%, var(--ambi-bottom, rgba(0,0,0,0)), transparent 75%),
                 radial-gradient(45% 60% at 0% 50%, var(--ambi-left, rgba(0,0,0,0)), transparent 75%)`
              : undefined,
            filter: isReactingLive ? 'blur(42px) saturate(1.8)' : undefined,
            transition: 'background 220ms linear, filter 300ms ease',
          }}
        >
          {backdropUrl && (
            <img
              src={backdropUrl}
              alt=""
              loading="lazy"
              className={`absolute inset-0 w-full h-full object-cover rounded-3xl transition-opacity duration-500 ${
                isReactingLive ? 'opacity-0' : 'opacity-55'
              }`}
              style={{
                filter: 'blur(64px) saturate(1.75) brightness(1.08)',
                transform: 'scale(1.05)',
              }}
            />
          )}
          <canvas
            ref={canvasRef}
            width={64}
            height={36}
            className={`absolute inset-0 w-full h-full rounded-3xl transition-opacity duration-300 ${
              hasLiveFrames ? 'opacity-95' : 'opacity-0'
            }`}
            style={{
              filter: 'blur(52px) saturate(2.35) brightness(1.35)',
              transform: 'scale(1.06)',
            }}
          />
        </div>
      )}

      <div className={`${className} z-10`}>
        {children}
      </div>
    </div>
  );
};

export default PlayerStage;
