import React, { useEffect, useRef, useState } from 'react';

const STEP = 48;

/**
 * Visible mouse-style cursor for D-pad/remote input (Android TV), like the
 * pointer Google TV shows for apps that aren't built with focus-based
 * (leanback) navigation. Arrow keys glide the dot around the screen,
 * OK/Enter "clicks" whatever DOM element is currently under it. Hidden
 * until the first arrow-key press so touch/mouse users never see it, and
 * hides again on the first touch in case input switches mid-session.
 */
const RemoteCursor: React.FC = () => {
  const [active, setActive] = useState(false);
  const [pos, setPos] = useState(() => ({ x: window.innerWidth / 2, y: window.innerHeight / 2 }));
  const posRef = useRef(pos);
  posRef.current = pos;
  const activeRef = useRef(active);
  activeRef.current = active;

  useEffect(() => {
    const clamp = (v: number, max: number) => Math.max(0, Math.min(max, v));

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowUp' || e.key === 'ArrowDown' || e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
        setActive(true);
        setPos(prev => {
          let { x, y } = prev;
          if (e.key === 'ArrowUp') y = clamp(y - STEP, window.innerHeight - 1);
          if (e.key === 'ArrowDown') y = clamp(y + STEP, window.innerHeight - 1);
          if (e.key === 'ArrowLeft') x = clamp(x - STEP, window.innerWidth - 1);
          if (e.key === 'ArrowRight') x = clamp(x + STEP, window.innerWidth - 1);
          return { x, y };
        });
        e.preventDefault();
        return;
      }

      if (e.key === 'Enter' || e.key === ' ') {
        if (!activeRef.current) return;
        const { x, y } = posRef.current;
        const el = document.elementFromPoint(x, y) as HTMLElement | null;
        el?.click();
        e.preventDefault();
        return;
      }

      // Back: Escape/Backspace (keyboard) + the keyCodes real TV remotes send for their Back key
      if (e.key === 'Escape' || e.key === 'Backspace' || e.keyCode === 461 || e.keyCode === 10009) {
        if (!activeRef.current) return;
        const target = e.target as HTMLElement | null;
        const inTextInput = target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable);
        if (inTextInput) return;
        e.preventDefault();
        window.history.back();
      }
    };

    const onTouchStart = () => setActive(false);

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('touchstart', onTouchStart, { passive: true });
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('touchstart', onTouchStart);
    };
  }, []);

  if (!active) return null;

  return (
    <div
      aria-hidden
      className="fixed z-[99999] pointer-events-none"
      style={{ left: pos.x, top: pos.y, transform: 'translate(-50%, -50%)' }}
    >
      <div className="w-8 h-8 rounded-full bg-white/90 border-2 border-emerald-400 shadow-[0_0_12px_rgba(16,185,129,0.8)]" />
    </div>
  );
};

export default RemoteCursor;
