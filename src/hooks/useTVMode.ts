import { useEffect } from 'react';

// ─── Platform detection ───────────────────────────────────────────────────────

function detectTV(): boolean {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent;
  return (
    /SmartTV|Tizen|WebOS|HbbTV|VIDAA|NetCast|SMART-TV|TV Store/i.test(ua) ||
    (/Android/i.test(ua) && /TV|Television|GoogleTV|Chromecast/i.test(ua)) ||
    /CrKey|Cobalt/i.test(ua)
  );
}

// ─── DOM helpers ──────────────────────────────────────────────────────────────

const FOCUSABLE = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(', ');

function isVisible(el: HTMLElement, vw = window.innerWidth, vh = window.innerHeight): boolean {
  if (el.closest('[aria-hidden="true"]')) return false;
  if (el.hasAttribute('data-carousel-prev') || el.hasAttribute('data-carousel-next')) return false;
  const s = getComputedStyle(el);
  if (s.visibility === 'hidden' || s.display === 'none') return false;
  const r = el.getBoundingClientRect();
  return r.width > 0 && r.height > 0 && r.right > 0 && r.bottom > 0 && r.left < vw && r.top < vh;
}

// Chromium quirk : quand un élément absolute inset-0 est à l'intérieur d'un
// ancêtre avec transform (ex. .embla-slide:has(:focus) scale(1.07)), son
// getBoundingClientRect() renvoie {width:0, height:0} même s'il est visible.
// On remonte alors au .embla-slide parent pour avoir des coordonnées fiables.
function getUsableRect(el: Element): DOMRect {
  const r = (el as HTMLElement).getBoundingClientRect();
  if (r.width === 0 && r.height === 0) {
    const slide = (el as HTMLElement).closest<HTMLElement>('.embla-slide');
    if (slide) return slide.getBoundingClientRect();
  }
  return r;
}

function getVisible(): HTMLElement[] {
  const modal = document.querySelector<HTMLElement>(
    '[role="dialog"]:not([aria-hidden="true"]), [data-radix-dialog-content]'
  );
  const root = modal ?? document;
  return Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(el => isVisible(el));
}

// ─── Spatial scoring (for header / non-carousel areas) ───────────────────────

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
    if (!r.width || !r.height) continue;
    const dx = r.left + r.width / 2 - cx;
    const dy = r.top + r.height / 2 - cy;
    const inDir =
      dir === 'right' ? dx > cr.width  * 0.3 :
      dir === 'left'  ? dx < -cr.width * 0.3 :
      dir === 'down'  ? dy > cr.height * 0.3 :
                        dy < -cr.height * 0.3;
    if (!inDir) continue;
    const pri = (dir === 'left' || dir === 'right') ? Math.abs(dx) : Math.abs(dy);
    const sec = (dir === 'left' || dir === 'right') ? Math.abs(dy) : Math.abs(dx);
    if (pri + sec * 5 < bestScore) { bestScore = pri + sec * 5; best = el; }
  }
  return best;
}

// ─── Focus memory (Netflix-style: each row remembers its last focused card) ───
//
// Module-level WeakMap — survives re-renders, GC'd automatically when a
// carousel element is removed from the DOM.

const focusMemory = new WeakMap<Element, HTMLElement>();

function rememberFocus(el: HTMLElement): void {
  const carousel = el.closest<HTMLElement>('[data-carousel]');
  if (carousel) focusMemory.set(carousel, el);
}

// ─── Carousel list helpers ────────────────────────────────────────────────────

function getAllCarousels(): HTMLElement[] {
  return Array.from(document.querySelectorAll<HTMLElement>('[data-carousel]'));
}

function getCarouselItems(carousel: HTMLElement): HTMLElement[] {
  return Array.from(carousel.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(el => isVisible(el));
}

// ─── Enter a carousel row ─────────────────────────────────────────────────────
//
// Strategy (in order):
//  1. Use the last remembered card for this row
//  2. Pick visible card closest to fromX (horizontal position of previous focus)
//  3. If row is off-screen, scroll to it first then retry

function focusClosestInPool(pool: HTMLElement[], fromX: number, carousel: HTMLElement): void {
  if (!pool.length) return;
  const target = pool.reduce((best, el) => {
    const eCx = el.getBoundingClientRect().left + el.getBoundingClientRect().width / 2;
    const bCx = best.getBoundingClientRect().left + best.getBoundingClientRect().width / 2;
    return Math.abs(eCx - fromX) < Math.abs(bCx - fromX) ? el : best;
  });
  target.focus({ preventScroll: true });
  focusMemory.set(carousel, target);
}

function tryFocusCarouselItems(carousel: HTMLElement, fromX: number): boolean {
  const last = focusMemory.get(carousel);
  if (last && isVisible(last)) {
    last.focus({ preventScroll: true });
    return true;
  }
  const items = getCarouselItems(carousel);
  if (!items.length) return false;
  const mainLinks = items.filter(el => el.tagName === 'A' && el.getAttribute('href'));
  const pool = mainLinks.length > 0 ? mainLinks : items;
  focusClosestInPool(pool, fromX, carousel);
  return true;
}

function enterCarousel(carousel: HTMLElement, fromX: number, retrying = false): void {
  const r = carousel.getBoundingClientRect();
  const vh = window.innerHeight;

  // Carousel not (fully) visible yet — scroll so its top aligns with the viewport top
  // then retry once the scroll settles.
  if (!retrying && (r.top > vh * 0.85 || r.bottom < vh * 0.15)) {
    let settled = false;
    const retry = () => {
      if (settled) return;
      settled = true;
      enterCarousel(carousel, fromX, true);
    };
    // scrollend fires when smooth scroll finishes (Chrome 111+, Firefox 109+)
    window.addEventListener('scrollend', retry, { once: true });
    // Fallback for browsers that don't support scrollend
    setTimeout(retry, 600);
    carousel.scrollIntoView({ block: 'start', behavior: 'smooth' });
    return;
  }

  if (retrying) {
    // After smooth scroll: if items still off-screen, instant-scroll as safety net
    if (!tryFocusCarouselItems(carousel, fromX)) {
      carousel.scrollIntoView({ block: 'start', behavior: 'instant' });
      tryFocusCarouselItems(carousel, fromX);
    }
  } else {
    tryFocusCarouselItems(carousel, fromX);
  }
}

// ─── Horizontal navigation within a carousel row ──────────────────────────────

function navigateCarousel(dir: 'left' | 'right', focused: Element, carousel: HTMLElement): void {
  const items = getCarouselItems(carousel).filter(el => el !== focused);
  const next = getNearest(focused, items, dir);

  // Accept the candidate only if it's a main link OR if the carousel has no main links at all.
  // This prevents two adjacent non-link buttons (e.g. hero Play/Info) from trapping focus
  // forever instead of advancing the slide.
  const hasMainLinks = items.some(el => el.tagName === 'A' && el.getAttribute('href'));
  const nextIsMain = next?.tagName === 'A' && next.getAttribute('href');

  if (next && (!hasMainLinks || nextIsMain)) {
    next.focus({ preventScroll: true });
    focusMemory.set(carousel, next);
    return;
  }

  // At the carousel edge — trigger scroll and re-focus the newly revealed card
  const btn = carousel.querySelector<HTMLElement>(
    dir === 'left' ? '[data-carousel-prev]' : '[data-carousel-next]'
  );
  if (!btn) return;

  // Capture X before the scroll so we can find the most adjacent card after
  const focusedRect0 = getUsableRect(focused);
  const fromX = focusedRect0.left + focusedRect0.width / 2;

  // Snapshot focused element's position before the scroll
  const focusedRectBefore = getUsableRect(focused);
  btn.click();

  // 450ms — safely past Embla's default animation (~400ms, duration:40 × 10ms)
  setTimeout(() => {
    // If the focused element didn't move (carousel was already at the edge), bail out
    const focusedRectAfter = getUsableRect(focused);
    const scrolled = Math.abs(focusedRectAfter.left - focusedRectBefore.left) > 5;
    if (!scrolled) return;

    const after = getCarouselItems(carousel);
    if (!after.length) return;
    // Prefer main card links over inner buttons (watchlist, delete…)
    const mainLinks = after.filter(el => el.tagName === 'A' && el.getAttribute('href'));
    const pool = mainLinks.length > 0 ? mainLinks : after;
    focusClosestInPool(pool, fromX, carousel);
  }, 450);
}

// ─── Vertical navigation between carousel rows (Netflix row-jumping) ──────────
//
// Rules:
//  - DOWN/UP finds adjacent [data-carousel] in DOM order (= visual order)
//  - Enters target row via enterCarousel (respects memory + horizontal alignment)
//  - If no carousel in that direction, falls back to header elements or page scroll

function navigateVertical(dir: 'up' | 'down', focused: Element): void {
  const cr = getUsableRect(focused);
  const fromX = cr.left + cr.width / 2;
  const allCarousels = getAllCarousels();
  const currentCarousel = focused.closest<HTMLElement>('[data-carousel]');

  if (currentCarousel) {
    const idx = allCarousels.indexOf(currentCarousel);
    const target = dir === 'down' ? allCarousels[idx + 1] : allCarousels[idx - 1];

    if (target) {
      enterCarousel(target, fromX);
      return;
    }

    if (dir === 'up') {
      // Try to reach header/nav elements above all carousels
      const nonCarousel = getVisible().filter(el => !el.closest('[data-carousel]'));
      const above = getNearest(focused, nonCarousel, 'up');
      if (above) { above.focus({ preventScroll: false }); return; }
    }

    scrollPage(dir);
    return;
  }

  // Focused element is outside carousels (header, nav…)
  if (dir === 'down') {
    const below = allCarousels.find(c => c.getBoundingClientRect().top > cr.bottom - 10);
    if (below) { enterCarousel(below, fromX); return; }
  } else {
    const above = [...allCarousels].reverse().find(c => c.getBoundingClientRect().bottom < cr.top + 10);
    if (above) { enterCarousel(above, fromX); return; }
  }

  // Last resort: spatial navigation then page scroll
  const next = getNearest(focused, getVisible(), dir);
  if (next) {
    next.focus({ preventScroll: false });
    next.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  } else {
    scrollPage(dir);
  }
}

function scrollPage(dir: 'up' | 'down'): void {
  window.scrollBy({
    top: dir === 'down' ? window.innerHeight * 0.75 : -window.innerHeight * 0.75,
    behavior: 'smooth',
  });
}

// ─── Key mapping ──────────────────────────────────────────────────────────────

type Action = 'up' | 'down' | 'left' | 'right' | 'back' | 'playpause' | 'play' | 'pause';

function getAction(e: KeyboardEvent): Action | null {
  if (e.key === 'ArrowUp'    || e.keyCode === 38) return 'up';
  if (e.key === 'ArrowDown'  || e.keyCode === 40) return 'down';
  if (e.key === 'ArrowLeft'  || e.keyCode === 37) return 'left';
  if (e.key === 'ArrowRight' || e.keyCode === 39) return 'right';
  if (e.keyCode === 10009 || e.keyCode === 461)   return 'back';
  if (e.key === 'Escape'     || e.keyCode === 27) return 'back';
  if (e.key === 'Backspace'  || e.keyCode === 8)  return 'back';
  if (e.keyCode === 179 || e.key === 'MediaPlayPause') return 'playpause';
  if (e.keyCode === 415 || e.key === 'MediaPlay')      return 'play';
  if (e.keyCode === 19  || e.key === 'MediaPause')     return 'pause';
  return null;
}

function isInTextInput(target: EventTarget | null): boolean {
  if (!target || !(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target.isContentEditable;
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export const useTVMode = () => {
  // tv-mode: layout changes for actual Smart TV platforms or very large screens
  useEffect(() => {
    const isTV = detectTV();
    const update = () => {
      const active = isTV || window.innerWidth >= 1921;
      document.body.classList.toggle('tv-mode', active);
      if (active) document.body.classList.add('nav-mode');
    };
    update();
    window.addEventListener('resize', update, { passive: true });
    return () => { window.removeEventListener('resize', update); document.body.classList.remove('tv-mode'); };
  }, []);

  // Auto-track focus into carousels (mouse, programmatic, keyboard — any source)
  useEffect(() => {
    const onFocusIn = (e: FocusEvent) => {
      if (e.target instanceof HTMLElement) rememberFocus(e.target);
    };
    document.addEventListener('focusin', onFocusIn, { passive: true });
    return () => document.removeEventListener('focusin', onFocusIn);
  }, []);

  // Spatial navigation + nav-mode management
  useEffect(() => {
    const isTV = detectTV();
    let cursorHidden = false;

    let lastKeyTime = 0;
    let lastMouseX = 0, lastMouseY = 0;
    const hideCursor = () => {
      if (!cursorHidden) { document.body.style.cursor = 'none'; cursorHidden = true; }
    };
    const restorePointer = (e: MouseEvent) => {
      // Ignore mouse jitter for 600ms after last key press
      if (Date.now() - lastKeyTime < 600) return;
      const dx = e.clientX - lastMouseX, dy = e.clientY - lastMouseY;
      lastMouseX = e.clientX; lastMouseY = e.clientY;
      if (dx * dx + dy * dy <= 225) return; // < 15px intentional movement
      if (cursorHidden) { document.body.style.cursor = ''; cursorHidden = false; }
      if (!isTV && window.innerWidth < 1921) document.body.classList.remove('nav-mode');
    };

    const onKey = (e: KeyboardEvent) => {
      const action = getAction(e);
      if (!action) return;
      if (document.fullscreenElement) return;

      const inInput = isInTextInput(e.target);
      lastKeyTime = Date.now();
      document.body.classList.add('nav-mode');
      if (isTV || window.innerWidth >= 1921) hideCursor();

      const isDir = action === 'up' || action === 'down' || action === 'left' || action === 'right';

      if (isDir) {
        // In a text input: LEFT/RIGHT move the text cursor — let the browser handle it.
        // UP/DOWN should escape the input and navigate spatially.
        if (inInput && (action === 'left' || action === 'right')) return;
        e.preventDefault();

        // Capture position BEFORE blur so navigateVertical can use the input's coordinates.
        const current = document.activeElement;
        if (inInput && current instanceof HTMLElement) current.blur();

        // Nothing focused yet → enter first carousel
        if (!current || current === document.body) {
          const first = getAllCarousels()[0];
          if (first) {
            enterCarousel(first, window.innerWidth / 2);
          } else {
            const all = getVisible();
            (all.find(el => !el.closest('header') && !el.closest('nav')) ?? all[0])
              ?.focus({ preventScroll: false });
          }
          return;
        }

        if (action === 'left' || action === 'right') {
          const carousel = current.closest<HTMLElement>('[data-carousel]');
          if (carousel) {
            navigateCarousel(action, current, carousel);
          } else {
            // Outside a carousel (menus, search…) — standard spatial
            const next = getNearest(current, getVisible(), action);
            if (next) next.focus({ preventScroll: false });
          }
          return;
        }

        // UP / DOWN: Netflix-style row jumping
        navigateVertical(action, current);
        return;
      }

      if (action === 'back') {
        if (inInput && (e.key === 'Backspace' || e.keyCode === 8)) return;
        if (e.key === 'Escape') {
          // Escape while in an input → blur and return to navigation mode
          if (inInput) {
            e.preventDefault();
            (e.target as HTMLElement).blur();
            return;
          }
          const hasOverlay = document.querySelector(
            '[role="dialog"]:not([aria-hidden="true"]), [data-radix-popper-content-wrapper]'
          );
          if (hasOverlay) return;
          e.preventDefault();
          window.history.back();
          return;
        }
        e.preventDefault();
        window.history.back();
        return;
      }

      if (action === 'play' || action === 'pause' || action === 'playpause') {
        const video = document.querySelector<HTMLVideoElement>('video');
        if (video) {
          e.preventDefault();
          if (action === 'play') video.play();
          else if (action === 'pause') video.pause();
          else video.paused ? video.play() : video.pause();
        }
      }
    };

    const onEnter = (e: KeyboardEvent) => {
      if (e.key !== 'Enter' && e.keyCode !== 13) return;
      if (document.fullscreenElement) return;
      const el = document.activeElement as HTMLElement | null;
      if (el && !isInTextInput(el) && el !== document.body) el.click();
    };

    document.addEventListener('keydown', onKey);
    document.addEventListener('keydown', onEnter);
    const restorePointerOnTouch = () => {
      if (cursorHidden) { document.body.style.cursor = ''; cursorHidden = false; }
      if (!isTV && window.innerWidth < 1921) document.body.classList.remove('nav-mode');
    };
    document.addEventListener('mousemove', restorePointer, { passive: true });
    document.addEventListener('touchstart', restorePointerOnTouch, { passive: true });

    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('keydown', onEnter);
      document.removeEventListener('mousemove', restorePointer);
      document.removeEventListener('touchstart', restorePointerOnTouch);
      document.body.style.cursor = '';
      document.body.classList.remove('nav-mode');
    };
  }, []);
};
