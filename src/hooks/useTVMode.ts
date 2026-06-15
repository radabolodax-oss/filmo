import { useEffect } from 'react';

const TV_BREAKPOINT = 1921;

// Android TV reports CSS pixels at device density, so a 1080p TV at density 2
// appears as 960×540 — never reaching 1921px. Detect TV via UA as a fallback.
function isAndroidTV(): boolean {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent;
  return /Android/i.test(ua) && /TV|Television|GoogleTV|Chromecast/i.test(ua);
}

const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(', ');

function getVisibleFocusable(): HTMLElement[] {
  return Array.from(document.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter((el) => {
    const rect = el.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0 && !el.closest('[aria-hidden="true"]');
  });
}

export const useTVMode = () => {
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

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (window.innerWidth < TV_BREAKPOINT && !isAndroidTV()) return;

      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
        e.preventDefault();
        const all = getVisibleFocusable();
        if (!all.length) return;
        const idx = all.indexOf(document.activeElement as HTMLElement);
        all[(idx + 1) % all.length]?.focus();
      } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
        e.preventDefault();
        const all = getVisibleFocusable();
        if (!all.length) return;
        const idx = all.indexOf(document.activeElement as HTMLElement);
        all[(idx - 1 + all.length) % all.length]?.focus();
      } else if (e.key === 'Enter') {
        const el = document.activeElement as HTMLElement | null;
        if (el && el.tagName !== 'INPUT' && el.tagName !== 'TEXTAREA' && el !== document.body) {
          el.click();
        }
      } else if (e.key === 'Backspace') {
        const el = document.activeElement;
        if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA')) return;
        e.preventDefault();
        window.history.back();
      }
    };

    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);
};
