import { useEffect, useRef } from 'react';

const INTERACTION_THRESHOLD_MS = 600;

export function useAutoTabDetection() {
  const lastInteractionTime = useRef(0);

  useEffect(() => {
    const onInteraction = () => {
      lastInteractionTime.current = Date.now();
    };

    document.addEventListener('mousedown', onInteraction, true);
    document.addEventListener('touchstart', onInteraction, { capture: true, passive: true });
    document.addEventListener('keydown', onInteraction, true);

    // --- window.open override (same-origin scripts) ---
    const originalOpen = window.open.bind(window);

    window.open = function (
      url?: string | URL,
      target?: string,
      features?: string,
    ): Window | null {
      const timeSinceInteraction = Date.now() - lastInteractionTime.current;
      if (timeSinceInteraction <= INTERACTION_THRESHOLD_MS) {
        return originalOpen(url, target, features);
      }
      return null;
    };

    // --- blur refocus (cross-origin iframes using <a target="_blank"> trick) ---
    const onBlur = () => {
      const timeSinceInteraction = Date.now() - lastInteractionTime.current;
      if (timeSinceInteraction > INTERACTION_THRESHOLD_MS) {
        window.focus();
      }
    };

    window.addEventListener('blur', onBlur);

    return () => {
      window.open = originalOpen;
      window.removeEventListener('blur', onBlur);
      document.removeEventListener('mousedown', onInteraction, true);
      document.removeEventListener('touchstart', onInteraction, true);
      document.removeEventListener('keydown', onInteraction, true);
    };
  }, []);
}
