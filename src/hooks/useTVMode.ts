import { useEffect } from 'react';

const TV_BREAKPOINT = 1921;

function isAndroidTV(): boolean {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent;
  return /Android/i.test(ua) && /TV|Television|GoogleTV|Chromecast/i.test(ua);
}

const FOCUSABLE = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(', ');

function getVisible(): HTMLElement[] {
  return Array.from(document.querySelectorAll<HTMLElement>(FOCUSABLE)).filter((el) => {
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0 && !el.closest('[aria-hidden="true"]');
  });
}

// Find nearest focusable element in a given direction using spatial distance
function getNearest(
  current: Element,
  candidates: HTMLElement[],
  dir: 'up' | 'down' | 'left' | 'right'
): HTMLElement | null {
  const cr = current.getBoundingClientRect();
  const cx = cr.left + cr.width / 2;
  const cy = cr.top + cr.height / 2;

  let best: HTMLElement | null = null;
  let bestScore = Infinity;

  for (const el of candidates) {
    if (el === current) continue;
    const r = el.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) continue;

    const ex = r.left + r.width / 2;
    const ey = r.top + r.height / 2;
    const dx = ex - cx;
    const dy = ey - cy;

    // Element must be clearly in the pressed direction
    const inDir =
      dir === 'right' ? dx > cr.width * 0.3 :
      dir === 'left'  ? dx < -cr.width * 0.3 :
      dir === 'down'  ? dy > cr.height * 0.3 :
                        dy < -cr.height * 0.3;

    if (!inDir) continue;

    // Primary = distance in the pressed direction
    // Secondary = perpendicular offset (penalized to prefer aligned elements)
    const primary   = dir === 'left' || dir === 'right' ? Math.abs(dx) : Math.abs(dy);
    const secondary = dir === 'left' || dir === 'right' ? Math.abs(dy) : Math.abs(dx);
    const score = primary + secondary * 2;

    if (score < bestScore) {
      bestScore = score;
      best = el;
    }
  }

  return best;
}

export const useTVMode = () => {
  // Toggle tv-mode class + hide cursor on TV
  useEffect(() => {
    const update = () => {
      const tvMode = window.innerWidth >= TV_BREAKPOINT || isAndroidTV();
      document.body.classList.toggle('tv-mode', tvMode);
    };
    update();
    window.addEventListener('resize', update, { passive: true });
    return () => {
      window.removeEventListener('resize', update);
      document.body.classList.remove('tv-mode');
    };
  }, []);

  // Spatial D-pad navigation — hide cursor on keydown, show on mousemove
  useEffect(() => {
    let cursorHidden = false;

    const hideCursor = () => {
      if (!cursorHidden) {
        document.body.style.cursor = 'none';
        cursorHidden = true;
      }
    };

    const showCursor = () => {
      if (cursorHidden) {
        document.body.style.cursor = '';
        cursorHidden = false;
      }
    };

    const onKey = (e: KeyboardEvent) => {
      const isTVMode = window.innerWidth >= TV_BREAKPOINT || isAndroidTV();
      if (!isTVMode) return;

      const dirMap: Record<string, 'up' | 'down' | 'left' | 'right'> = {
        ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right',
      };
      const dir = dirMap[e.key];

      if (dir) {
        hideCursor();
        e.preventDefault();

        const candidates = getVisible();
        const current = document.activeElement;

        // Nothing focused yet → focus first visible element
        if (!current || current === document.body) {
          candidates[0]?.focus({ preventScroll: false });
          return;
        }

        const next = getNearest(current, candidates, dir);
        if (next) {
          next.focus({ preventScroll: false });
          next.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'smooth' });
        }
        return;
      }

      if (e.key === 'Enter') {
        const el = document.activeElement as HTMLElement | null;
        if (el && el.tagName !== 'INPUT' && el.tagName !== 'TEXTAREA' && el !== document.body) {
          el.click();
        }
        return;
      }

      if (e.key === 'Backspace') {
        const el = document.activeElement;
        if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA')) return;
        e.preventDefault();
        window.history.back();
      }
    };

    document.addEventListener('keydown', onKey);
    document.addEventListener('mousemove', showCursor);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('mousemove', showCursor);
      document.body.style.cursor = '';
    };
  }, []);
};
