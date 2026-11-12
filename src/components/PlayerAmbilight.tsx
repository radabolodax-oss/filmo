import React, { useEffect, useRef, useState } from 'react';
import { PREFS_CHANGED_EVENT, readAmbilightEnabled } from '../utils/playerVisualPrefs';

interface PlayerStageProps {
  backdrop?: string | null;
  className?: string;
  children: React.ReactNode;
}

const resolveBackdropUrl = (backdrop?: string | null): string | null => {
  if (!backdrop) return null;
  if (/^https?:\/\//i.test(backdrop) || backdrop.startsWith('data:')) {
    return backdrop;
  }
  return `https://image.tmdb.org/t/p/w780${backdrop.startsWith('/') ? backdrop : `/${backdrop}`}`;
};

/**
 * Wraps the player container in an isolated stacking context and projects a
 * soft Ambilight glow behind it: samples live frames from any active HTML5
 * `<video>` at ~10 fps into a tiny blurred canvas, falling back seamlessly to
 * the blurred TMDB backdrop when paused, loading, or rendering an iframe embed.
 */
export const PlayerStage: React.FC<PlayerStageProps> = ({
  backdrop,
  className = 'relative w-full aspect-video rounded-lg overflow-hidden bg-black',
  children,
}) => {
  const stageRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [enabled, setEnabled] = useState<boolean>(() => readAmbilightEnabled());
  const [hasLiveFrames, setHasLiveFrames] = useState(false);
  const liveRef = useRef(false);

  const setLive = (next: boolean) => {
    if (liveRef.current !== next) {
      liveRef.current = next;
      setHasLiveFrames(next);
    }
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

  useEffect(() => {
    if (!enabled) {
      setHasLiveFrames(false);
      return;
    }

    const stage = stageRef.current;
    const canvas = canvasRef.current;
    if (!stage || !canvas) return;
    const ctx = canvas.getContext('2d', { alpha: false, willReadFrequently: false });
    if (!ctx) return;

    let stopped = false;
    let rafId = 0;
    let lastDraw = 0;
    let taintedVideo: HTMLVideoElement | null = null;

    const sampleFrame = (now: number) => {
      if (stopped) return;
      rafId = window.requestAnimationFrame(sampleFrame);

      if (now - lastDraw < 110) return;
      const video = stage.querySelector('video');
      if (!video || video === taintedVideo) {
        if (!video) setLive(false);
        return;
      }

      if (video.readyState >= 2 && video.videoWidth > 0 && video.videoHeight > 0 && !video.paused && !video.ended) {
        lastDraw = now;
        try {
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          setLive(true);
        } catch {
          taintedVideo = video;
          setLive(false);
        }
      }
    };

    const drawInitialFrameIfReady = () => {
      const video = stage.querySelector('video');
      if (video && video !== taintedVideo && video.readyState >= 2 && video.videoWidth > 0) {
        try {
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          setLive(true);
        } catch {
          taintedVideo = video;
        }
      }
    };

    drawInitialFrameIfReady();
    rafId = window.requestAnimationFrame(sampleFrame);

    return () => {
      stopped = true;
      if (rafId) window.cancelAnimationFrame(rafId);
    };
  }, [enabled]);

  const backdropUrl = resolveBackdropUrl(backdrop);

  return (
    <div ref={stageRef} className="relative isolate">
      {enabled && (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -inset-6 sm:-inset-10 lg:-inset-14 z-0 overflow-visible select-none"
        >
          {backdropUrl && (
            <img
              src={backdropUrl}
              alt=""
              loading="lazy"
              className={`absolute inset-0 w-full h-full object-cover rounded-3xl transition-opacity duration-700 ${
                hasLiveFrames ? 'opacity-20' : 'opacity-50'
              }`}
              style={{
                filter: 'blur(64px) saturate(1.75) brightness(1.05)',
                transform: 'scale(1.04)',
              }}
            />
          )}
          <canvas
            ref={canvasRef}
            width={32}
            height={18}
            className={`absolute inset-0 w-full h-full rounded-3xl transition-opacity duration-500 ${
              hasLiveFrames ? 'opacity-70' : 'opacity-0'
            }`}
            style={{
              filter: 'blur(60px) saturate(1.9) brightness(1.15)',
              transform: 'scale(1.04)',
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
