import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, ExternalLink, Layers, Maximize, Minimize } from 'lucide-react';

export interface EmbedPlayerChromeProps {
  onBack: () => void;
  onOpenNewTab: () => void;
  onChangeSource: () => void;
  extraHeaderControls?: React.ReactNode;
  children: React.ReactNode;
}

/**
 * Wraps a third-party embed <iframe> with our own non-intrusive Back, Sources, Fullscreen,
 * and External Link controls stacked vertically on the LEFT.
 * Prevents controls from blocking video interaction or native player controls.
 */
const EmbedPlayerChrome: React.FC<EmbedPlayerChromeProps> = ({
  onBack,
  onOpenNewTab,
  onChangeSource,
  extraHeaderControls,
  children,
}) => {
  const { t } = useTranslation();
  const [showControls, setShowControls] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const hideTimerRef = useRef<NodeJS.Timeout | null>(null);

  const resetHideTimer = useCallback(() => {
    setShowControls(true);
    if (hideTimerRef.current) {
      clearTimeout(hideTimerRef.current);
    }
    hideTimerRef.current = setTimeout(() => {
      setShowControls(false);
    }, 2500);
  }, []);

  useEffect(() => {
    resetHideTimer();
    return () => {
      if (hideTimerRef.current) {
        clearTimeout(hideTimerRef.current);
      }
    };
  }, [resetHideTimer]);

  // Fullscreen state listener
  useEffect(() => {
    const handleFsChange = () => {
      const active = !!(
        document.fullscreenElement ||
        (document as any).webkitFullscreenElement ||
        (document as any).mozFullScreenElement ||
        (document as any).msFullscreenElement
      );
      setIsFullscreen(active);
    };
    document.addEventListener('fullscreenchange', handleFsChange);
    document.addEventListener('webkitfullscreenchange', handleFsChange);
    return () => {
      document.removeEventListener('fullscreenchange', handleFsChange);
      document.removeEventListener('webkitfullscreenchange', handleFsChange);
    };
  }, []);

  const toggleFullscreen = async () => {
    try {
      const el = containerRef.current;
      if (!isFullscreen) {
        if (el?.requestFullscreen) {
          await el.requestFullscreen();
        } else if ((el as any)?.webkitRequestFullscreen) {
          await (el as any).webkitRequestFullscreen();
        } else {
          // CSS fallback
          setIsFullscreen(true);
        }
      } else {
        if (document.fullscreenElement) {
          if (document.exitFullscreen) {
            await document.exitFullscreen();
          } else if ((document as any)?.webkitExitFullscreen) {
            await (document as any).webkitExitFullscreen();
          }
        }
        setIsFullscreen(false);
      }
    } catch {
      // If native fullscreen is blocked by iframe or browser policy, fallback to CSS fullscreen
      setIsFullscreen((prev) => !prev);
    }
    resetHideTimer();
  };

  const handleBackClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isFullscreen) {
      toggleFullscreen();
    } else {
      onBack();
    }
  };

  return (
    <div
      ref={containerRef}
      onMouseMove={resetHideTimer}
      className={`relative w-full h-full bg-black select-none overflow-hidden transition-all duration-300 ${
        isFullscreen
          ? 'fixed inset-0 z-[99999] w-screen h-screen m-0 p-0 rounded-none flex flex-col justify-center'
          : 'w-full h-full'
      }`}
    >
      {/* Left Vertical Controls Column: Back, Sources, Fullscreen, External Link */}
      <div
        className={`absolute left-3 top-3 sm:left-4 sm:top-4 z-[10000] transition-all duration-300 pointer-events-none flex flex-col gap-2 ${
          showControls ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-2'
        }`}
        style={{
          paddingTop: isFullscreen
            ? 'max(1.75rem, env(safe-area-inset-top, 1.75rem))'
            : '0px',
        }}
      >
        {/* 1. Bouton Retour */}
        <button
          onClick={handleBackClick}
          className="pointer-events-auto flex items-center justify-center w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-black/80 hover:bg-black/95 hover:border-emerald-500/60 hover:text-emerald-400 active:scale-95 text-white border border-white/15 backdrop-blur-md shadow-xl transition-all group"
          title={isFullscreen ? t('watch.exitFullscreen') : t('watch.back')}
          aria-label={isFullscreen ? t('watch.exitFullscreen') : t('watch.back')}
        >
          <ArrowLeft className="w-4 h-4 transition-transform group-hover:-translate-x-0.5" />
        </button>

        {/* 2. Bouton Sources (avec vert émeraude Dawger) */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            onChangeSource();
          }}
          className="pointer-events-auto flex items-center justify-center w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-black/80 hover:bg-black/95 border border-emerald-500/40 hover:border-emerald-400 active:scale-95 text-white backdrop-blur-md shadow-xl transition-all group"
          title={t('watch.sources')}
          aria-label={t('watch.sources')}
        >
          <Layers className="w-4 h-4 text-emerald-400 transition-transform group-hover:scale-110" />
        </button>

        {/* 3. Bouton Plein écran */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            toggleFullscreen();
          }}
          className="pointer-events-auto flex items-center justify-center w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-black/80 hover:bg-black/95 hover:border-emerald-500/60 hover:text-emerald-400 active:scale-95 text-white border border-white/15 backdrop-blur-md shadow-xl transition-all group"
          title={isFullscreen ? t('watch.exitFullscreen') : t('watch.fullscreen')}
          aria-label={isFullscreen ? t('watch.exitFullscreen') : t('watch.fullscreen')}
        >
          {isFullscreen ? (
            <Minimize className="w-4 h-4 transition-transform group-hover:scale-90" />
          ) : (
            <Maximize className="w-4 h-4 transition-transform group-hover:scale-110" />
          )}
        </button>

        {/* 4. Bouton Lecture externe */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            onOpenNewTab();
          }}
          className="pointer-events-auto flex items-center justify-center w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-black/80 hover:bg-black/95 hover:border-emerald-500/60 hover:text-emerald-400 active:scale-95 text-white border border-white/15 backdrop-blur-md shadow-xl transition-all group"
          title={t('watch.openInNewPage')}
          aria-label={t('watch.openInNewPage')}
        >
          <ExternalLink className="w-4 h-4 transition-transform group-hover:scale-110" />
        </button>
      </div>

      {/* Top Center: Extra Controls (e.g. Episode navigation) */}
      {extraHeaderControls && (
        <div
          className={`absolute top-3 left-1/2 -translate-x-1/2 z-[10000] transition-opacity duration-300 pointer-events-none flex items-center gap-1.5 sm:gap-2 ${
            showControls ? 'opacity-100' : 'opacity-0'
          }`}
          style={{
            paddingTop: isFullscreen
              ? 'max(1.75rem, env(safe-area-inset-top, 1.75rem))'
              : '0px',
          }}
        >
          <div className="pointer-events-auto flex items-center gap-1.5 sm:gap-2 bg-black/80 backdrop-blur-md border border-white/15 px-3 py-1.5 rounded-xl shadow-xl">
            {extraHeaderControls}
          </div>
        </div>
      )}

      {/* Persistent mini button to show controls when hidden */}
      {!showControls && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            setShowControls(true);
          }}
          className="absolute left-3 top-3 sm:left-4 sm:top-4 z-[10000] p-2 rounded-xl bg-black/60 hover:bg-black/80 text-white/70 hover:text-white backdrop-blur-md border border-white/10 transition-all opacity-40 hover:opacity-100"
          title={t('watch.controls')}
          aria-label={t('watch.controls')}
        >
          <Layers className="w-4 h-4 text-emerald-400" />
        </button>
      )}

      {/* Video Content / Iframe */}
      <div className="w-full h-full flex items-center justify-center">
        {children}
      </div>
    </div>
  );
};

export default EmbedPlayerChrome;
