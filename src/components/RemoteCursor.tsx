import React, { useEffect, useRef, useState } from 'react';

const STEP = 48;

type Dir = 'up' | 'down' | 'left' | 'right';

declare global {
  interface Window {
    __remoteCursor?: {
      move: (dir: Dir) => void;
      select: () => void;
      back: () => void;
    };
  }
}

/**
 * Visible mouse-style cursor for D-pad/remote input (Android TV), like the
 * pointer Google TV shows for apps that aren't built with focus-based
 * (leanback) navigation. Arrow keys glide the dot around the screen,
 * OK/Enter "clicks" whatever DOM element is currently under it. Hidden
 * until first used so touch/mouse users never see it, and hides again on
 * the first touch in case input switches mid-session.
 *
 * Two input paths, both wired to the same logic:
 *  1. Standard `keydown` — works when the WebView already has focus and
 *     forwards hardware D-pad keys as ArrowUp/Down/Left/Right/Enter.
 *  2. window.__remoteCursor.{move,select,back} — a bridge MainActivity's
 *     dispatchKeyEvent() calls directly via evaluateJavascript(), for
 *     devices/OEM WebViews where D-pad events get eaten by native view
 *     focus before ever reaching page JS.
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

    const move = (dir: Dir) => {
      setActive(true);
      setPos(prev => {
        let { x, y } = prev;
        if (dir === 'up') y = clamp(y - STEP, window.innerHeight - 1);
        if (dir === 'down') y = clamp(y + STEP, window.innerHeight - 1);
        if (dir === 'left') x = clamp(x - STEP, window.innerWidth - 1);
        if (dir === 'right') x = clamp(x + STEP, window.innerWidth - 1);
        return { x, y };
      });
    };

    const select = () => {
      if (!activeRef.current) return;
      const { x, y } = posRef.current;
      const el = document.elementFromPoint(x, y) as HTMLElement | null;
      el?.click();
    };

    const back = () => {
      if (!activeRef.current) return;
      window.history.back();
    };

    window.__remoteCursor = { move, select, back };

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowUp' || e.key === 'ArrowDown' || e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
        move(e.key === 'ArrowUp' ? 'up' : e.key === 'ArrowDown' ? 'down' : e.key === 'ArrowLeft' ? 'left' : 'right');
        e.preventDefault();
        return;
      }

      if (e.key === 'Enter' || e.key === ' ') {
        if (!activeRef.current) return;
        select();
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
        back();
      }
    };

    const onTouchStart = () => setActive(false);

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('touchstart', onTouchStart, { passive: true });
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('touchstart', onTouchStart);
      delete window.__remoteCursor;
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
