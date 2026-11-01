import React, { useState, useEffect, useRef, useCallback } from 'react';
import { AlertCircle, RefreshCw, SkipForward, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export const FRAME_BLOCKED_EVENT = 'player:frame-blocked';

export interface FrameRedirectWatchProps {
  currentSourceLabel?: string;
  onFallbackNext?: () => void;
  onRetry?: () => void;
  autoFallbackTimeoutMs?: number;
}

export const triggerFrameBlocked = (reason = 'blocked', frameSrc = '') => {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent(FRAME_BLOCKED_EVENT, {
        detail: { reason, frameSrc, timestamp: Date.now() },
      })
    );
  }
};

const FrameRedirectWatch: React.FC<FrameRedirectWatchProps> = ({
  currentSourceLabel,
  onFallbackNext,
  onRetry,
  autoFallbackTimeoutMs = 5000,
}) => {
  const [isBlocked, setIsBlocked] = useState(false);
  const [countdown, setCountdown] = useState(Math.round(autoFallbackTimeoutMs / 1000));
  const [details, setDetails] = useState<string>('');
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const clearTimers = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  const handleDismiss = useCallback(() => {
    clearTimers();
    setIsBlocked(false);
  }, [clearTimers]);

  const handleNext = useCallback(() => {
    clearTimers();
    setIsBlocked(false);
    if (onFallbackNext) {
      onFallbackNext();
    }
  }, [clearTimers, onFallbackNext]);

  const handleRetry = useCallback(() => {
    clearTimers();
    setIsBlocked(false);
    if (onRetry) {
      onRetry();
    } else {
      window.location.reload();
    }
  }, [clearTimers, onRetry]);

  // Start auto-fallback countdown when blocked
  useEffect(() => {
    if (!isBlocked) {
      clearTimers();
      return;
    }

    const totalSeconds = Math.round(autoFallbackTimeoutMs / 1000);
    setCountdown(totalSeconds);

    intervalRef.current = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    timerRef.current = setTimeout(() => {
      handleNext();
    }, autoFallbackTimeoutMs);

    return () => {
      clearTimers();
    };
  }, [isBlocked, autoFallbackTimeoutMs, handleNext, clearTimers]);

  // Listen to securitypolicyviolation and custom FRAME_BLOCKED_EVENT
  useEffect(() => {
    const handleCspViolation = (e: SecurityPolicyViolationEvent) => {
      // Ignore non-iframe or self violations
      const blockedUri = e.blockedURI || '';
      if (!blockedUri || blockedUri.startsWith(window.location.origin)) return;

      console.warn('[FrameRedirectWatch] Security violation detected:', blockedUri);
      setDetails(blockedUri);
      setIsBlocked(true);
    };

    const handleCustomBlocked = (e: Event) => {
      const customEvent = e as CustomEvent;
      const src = customEvent.detail?.frameSrc || '';
      console.warn('[FrameRedirectWatch] Frame blocked event received:', src);
      setDetails(src);
      setIsBlocked(true);
    };

    document.addEventListener('securitypolicyviolation', handleCspViolation);
    window.addEventListener(FRAME_BLOCKED_EVENT, handleCustomBlocked);

    return () => {
      document.removeEventListener('securitypolicyviolation', handleCspViolation);
      window.removeEventListener(FRAME_BLOCKED_EVENT, handleCustomBlocked);
    };
  }, []);

  return (
    <AnimatePresence>
      {isBlocked && (
        <motion.div
          key="frame-redirect-toast"
          initial={{ opacity: 0, y: 30, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 20, scale: 0.95 }}
          transition={{ duration: 0.25, ease: 'easeOut' }}
          role="status"
          className="fixed inset-x-4 bottom-6 z-[99999] mx-auto max-w-lg rounded-2xl border border-amber-500/40 bg-zinc-950/95 p-4 text-white shadow-2xl backdrop-blur-xl"
        >
          <div className="flex items-start gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/30">
              <AlertCircle className="h-5 w-5 animate-pulse" />
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-semibold text-white">
                  Panne ou blocage détecté
                </h4>
                <button
                  type="button"
                  onClick={handleDismiss}
                  className="rounded-lg p-1 text-zinc-400 hover:bg-zinc-800 hover:text-white transition-colors"
                  aria-label="Fermer"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <p className="mt-1 text-xs text-zinc-300 leading-relaxed">
                Ce lecteur {currentSourceLabel ? `(${currentSourceLabel})` : ''} a changé d'adresse ou ne répond plus.
              </p>

              {onFallbackNext ? (
                <div className="mt-1.5 flex items-center gap-1.5 text-[11px] font-medium text-emerald-400">
                  <RefreshCw className="h-3 w-3 animate-spin" />
                  <span>Bascule automatique vers la source suivante dans {countdown}s...</span>
                </div>
              ) : null}

              <div className="mt-3 flex flex-wrap items-center gap-2">
                {onFallbackNext && (
                  <button
                    type="button"
                    onClick={handleNext}
                    className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-emerald-600 px-3 text-xs font-semibold text-white hover:bg-emerald-500 active:scale-95 transition-all shadow-md"
                  >
                    <SkipForward className="h-3.5 w-3.5" />
                    Source suivante
                  </button>
                )}

                <button
                  type="button"
                  onClick={handleRetry}
                  className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-zinc-700 bg-zinc-800/80 px-3 text-xs font-medium text-zinc-200 hover:bg-zinc-700 active:scale-95 transition-all"
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                  Réessayer
                </button>

                <button
                  type="button"
                  onClick={handleDismiss}
                  className="inline-flex h-8 items-center rounded-lg px-2.5 text-xs text-zinc-400 hover:text-zinc-200 transition-colors"
                >
                  Annuler
                </button>
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default FrameRedirectWatch;
