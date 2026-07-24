import React, { useEffect, useRef, useState } from 'react';

const STEP = 48;

type Dir = 'up' | 'down' | 'left' | 'right';

declare global {
  interface Window {
    __remoteCursor?: {
      move: (dir: Dir) => void;
      select: () => void;
      back: () => void;
      getPosition: () => { x: number; y: number };
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

    // Walks up from the element under the cursor to find whatever actually
    // scrolls (a modal body, a horizontal rail, ...), falling back to the
    // page itself so content below the fold is still reachable.
    const findScrollable = (el: Element | null): Element => {
      while (el && el !== document.documentElement && el !== document.body) {
        const style = window.getComputedStyle(el);
        const canScrollY = (style.overflowY === 'auto' || style.overflowY === 'scroll') && el.scrollHeight > el.clientHeight;
        if (canScrollY) return el;
        el = el.parentElement;
      }
      return document.scrollingElement || document.documentElement;
    };

    const scrollAt = (x: number, y: number, delta: number) => {
      const target = findScrollable(document.elementFromPoint(x, y));
      if (target === document.scrollingElement || target === document.documentElement) {
        window.scrollBy({ top: delta });
      } else {
        (target as HTMLElement).scrollTop += delta;
      }
    };

    const move = (dir: Dir) => {
      setActive(true);
      setPos(prev => {
        let { x, y } = prev;
        if (dir === 'left') x = clamp(x - STEP, window.innerWidth - 1);
        if (dir === 'right') x = clamp(x + STEP, window.innerWidth - 1);
        if (dir === 'up' || dir === 'down') {
          const delta = dir === 'up' ? -STEP : STEP;
          const nextY = y + delta;
          // Cursor is viewport-fixed, so once it hits the top/bottom edge
          // the only way to reach more content is to scroll the page (or
          // whatever scrollable container sits under it) instead of the dot.
          if (nextY < 0 || nextY > window.innerHeight - 1) {
            scrollAt(x, y, delta);
          }
          y = clamp(nextY, window.innerHeight - 1);
        }
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

    window.__remoteCursor = { move, select, back, getPosition: () => posRef.current };

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
      style={{
        left: pos.x,
        top: pos.y,
        transform: 'translate(-50%, -50%)',
        transition: 'left 110ms ease-out, top 110ms ease-out',
      }}
    >
      <div
        className="relative rounded-full"
        style={{
          width: 18,
          height: 18,
          background: 'linear-gradient(160deg, rgba(255,255,255,0.12) 0%, rgba(255,255,255,0.04) 55%, rgba(0,0,0,0.06) 100%)',
          backdropFilter: 'blur(20px) saturate(180%)',
          WebkitBackdropFilter: 'blur(20px) saturate(180%)',
          borderTop: '1px solid rgba(255,255,255,0.28)',
          borderLeft: '1px solid rgba(255,255,255,0.16)',
          borderRight: '1px solid rgba(255,255,255,0.07)',
          borderBottom: '1px solid rgba(0,0,0,0.22)',
          boxShadow:
            'inset 0 1px 0 rgba(255,255,255,0.22), inset 0 -1px 0 rgba(0,0,0,0.10), 0 4px 14px rgba(0,0,0,0.28)',
        }}
      />
    </div>
  );
};

export default RemoteCursor;
