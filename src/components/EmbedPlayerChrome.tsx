import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, Maximize, Minimize, Settings, SkipForward } from 'lucide-react';
import { triggerFrameBlocked } from './FrameRedirectWatch';
import { EmbedSettingsDrawer } from './EmbedSettingsDrawer';
import {
  DEFAULT_CUSTOM_OLED,
  getOledFilterString,
  PREFS_CHANGED_EVENT,
  readEmbedZoom,
  readOledPrefs,
  type CustomOledSettings,
  type OledMode,
} from '../utils/playerVisualPrefs';

export interface EmbedPlayerChromeProps {
  onBack: () => void;
  onChangeSource?: () => void;
  isMenuOpen?: boolean;
  onMenuOpenChange?: (open: boolean) => void;
  renderSourcesPanel?: () => React.ReactNode;
  onFallbackNext?: () => void;
  onNextEpisode?: () => void;
  onNextMovie?: () => void;
  nextMovieTitle?: string;
  currentSourceLabel?: string;
  runtimeMinutes?: number;
  extraHeaderControls?: React.ReactNode;
  children: React.ReactNode;
}

/**
 * Unified Dawger player chrome for all embed/iframe players across Movies, Series, and Anime.
 * Provides the left vertical controls (Back, unified Gear for Sources & Settings, Next Episode/Movie, Fullscreen),
 * FrameRedirectWatch auto-fallback watchdog, CSS zoom, and real-time OLED video rendering filter.
 */
const EmbedPlayerChrome: React.FC<EmbedPlayerChromeProps> = ({
  onBack,
  onChangeSource,
  isMenuOpen,
  onMenuOpenChange,
  renderSourcesPanel,
  onFallbackNext: _onFallbackNext,
  onNextEpisode,
  onNextMovie,
  nextMovieTitle,
  currentSourceLabel: _currentSourceLabel,
  runtimeMinutes: _runtimeMinutes,
  extraHeaderControls,
  children,
}) => {
  const { t } = useTranslation();
  const [showControls, setShowControls] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(() => {
    if (typeof document === 'undefined') return false;
    const doc = document as any;
    return Boolean(doc.fullscreenElement || doc.webkitFullscreenElement || doc.mozFullScreenElement || (window as any).__DAWGER_CSS_FULLSCREEN__);
  });
  const [internalMenuOpen, setInternalMenuOpen] = useState(false);
  const isControlledMenu = isMenuOpen !== undefined;
  const menuOpen = isControlledMenu ? Boolean(isMenuOpen) : internalMenuOpen;
  const setMenuOpen = useCallback((next: boolean) => {
    if (!isControlledMenu) setInternalMenuOpen(next);
    onMenuOpenChange?.(next);
  }, [isControlledMenu, onMenuOpenChange]);

  // Synced preferences from localStorage
  const [autoFallbackPref, setAutoFallbackPref] = useState<boolean>(() => localStorage.getItem('dawger_auto_fallback') !== 'false');
  const [videoOled, setVideoOled] = useState<OledMode>(() => readOledPrefs().mode);
  const [customOled, setCustomOled] = useState<CustomOledSettings>(() => readOledPrefs().custom || DEFAULT_CUSTOM_OLED);
  const [embedZoom, setEmbedZoom] = useState<number>(() => readEmbedZoom());
  const [speedPref, setSpeedPref] = useState<string>(() => localStorage.getItem('playerPlaybackSpeed') || '1');
  const [autoNext, setAutoNext] = useState<boolean>(() => localStorage.getItem('playerAutoNextEpisodePref') !== 'false');
  const [sessionEndEnabled, setSessionEndEnabled] = useState<boolean>(() => localStorage.getItem('dawger_session_end_time') !== 'false');

  const containerRef = useRef<HTMLDivElement>(null);
  const hideTimerRef = useRef<NodeJS.Timeout | null>(null);
  const manualFullscreenRef = useRef<boolean>(
    typeof window !== 'undefined' && Boolean((window as any).__DAWGER_CSS_FULLSCREEN__)
  );

  // Sync preferences from other components/tabs
  useEffect(() => {
    const syncFromStorage = () => {
      setAutoFallbackPref(localStorage.getItem('dawger_auto_fallback') !== 'false');
      const { mode, custom } = readOledPrefs();
      setVideoOled(mode);
      setCustomOled(custom);
      setEmbedZoom(readEmbedZoom());
      setSpeedPref(localStorage.getItem('playerPlaybackSpeed') || '1');
      setAutoNext(localStorage.getItem('playerAutoNextEpisodePref') !== 'false');
      setSessionEndEnabled(localStorage.getItem('dawger_session_end_time') !== 'false');
    };
    window.addEventListener(PREFS_CHANGED_EVENT, syncFromStorage);
    window.addEventListener('storage', syncFromStorage);
    return () => {
      window.removeEventListener(PREFS_CHANGED_EVENT, syncFromStorage);
      window.removeEventListener('storage', syncFromStorage);
    };
  }, []);

  // Apply playback speed to any HTML5 video elements in container
  const applyPlaybackSpeed = useCallback((spd: string) => {
    const rate = parseFloat(spd) || 1;
    if (containerRef.current) {
      const videos = containerRef.current.querySelectorAll('video');
      videos.forEach((v) => {
        try {
          v.playbackRate = rate;
        } catch { /* ignore */ }
      });
    }
  }, []);

  useEffect(() => {
    applyPlaybackSpeed(speedPref);
  }, [speedPref, applyPlaybackSpeed]);

  // Auto-next listener via iframe postMessages or video ended events
  useEffect(() => {
    const handleWindowMessage = (e: MessageEvent) => {
      try {
        const data = typeof e.data === 'string' ? JSON.parse(e.data) : e.data;
        const evType = data?.event || data?.action || data?.type || data?.status || '';
        if (evType === 'ended' || evType === 'finish' || evType === 'player:ended' || evType === 'complete') {
          if (autoNext && onNextEpisode) {
            onNextEpisode();
          }
        }
      } catch { /* ignore */ }
    };

    window.addEventListener('message', handleWindowMessage);
    return () => window.removeEventListener('message', handleWindowMessage);
  }, [autoNext, onNextEpisode]);

  // Video element 'ended' event listener
  useEffect(() => {
    if (!containerRef.current) return;
    const videos = containerRef.current.querySelectorAll('video');
    const handleEnded = () => {
      if (autoNext && onNextEpisode) {
        onNextEpisode();
      }
    };
    videos.forEach((v) => v.addEventListener('ended', handleEnded));
    return () => {
      videos.forEach((v) => v.removeEventListener('ended', handleEnded));
    };
  });

  // Iframe error watchdog for auto-fallback
  useEffect(() => {
    if (!containerRef.current || !autoFallbackPref) return;
    const iframes = containerRef.current.querySelectorAll('iframe');
    const handleIframeError = (e: Event) => {
      console.warn('[EmbedPlayerChrome] Iframe error detected:', e);
      triggerFrameBlocked('iframe_load_failure', (e.target as HTMLIFrameElement)?.src || '');
    };
    iframes.forEach((ifr) => ifr.addEventListener('error', handleIframeError));
    return () => {
      iframes.forEach((ifr) => ifr.removeEventListener('error', handleIframeError));
    };
  }, [autoFallbackPref, children]);

  const oledFilterStyle = getOledFilterString(videoOled, customOled);

  const resetHideTimer = useCallback(() => {
    setShowControls(true);
    if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    hideTimerRef.current = setTimeout(() => {
      setShowControls(false);
    }, 3500);
  }, []);

  const toggleFullscreen = async () => {
    try {
      const wantFullscreen = !isFullscreen;
      if (wantFullscreen) {
        manualFullscreenRef.current = true;
        (window as any).__DAWGER_CSS_FULLSCREEN__ = true;
        setIsFullscreen(true);
        try {
          window.history.pushState({ dawgerFs: true }, '');
        } catch {}
        (window as any).__DAWGER_EXIT_FULLSCREEN__ = () => {
          void toggleFullscreen();
        };
        const hostEl = containerRef.current?.closest<HTMLElement>('[data-dawger-fullscreen-host="true"]') || containerRef.current;
        if (hostEl) {
          const el = hostEl as any;
          const req = el.requestFullscreen || el.webkitRequestFullscreen || el.mozRequestFullScreen || el.msRequestFullscreen;
          if (typeof req === 'function') {
            try {
              await Promise.resolve(req.call(el));
              manualFullscreenRef.current = false;
            } catch {}
          }
        }
        try {
          await (window.screen?.orientation as any)?.lock?.('landscape');
        } catch {}
      } else {
        manualFullscreenRef.current = false;
        (window as any).__DAWGER_CSS_FULLSCREEN__ = false;
        setIsFullscreen(false);
        (window as any).__DAWGER_EXIT_FULLSCREEN__ = null;
        const doc = document as any;
        const exit = doc.exitFullscreen || doc.webkitExitFullscreen || doc.mozCancelFullScreen || doc.msExitFullscreen;
        if (typeof exit === 'function' && (doc.fullscreenElement || doc.webkitFullscreenElement || doc.mozFullScreenElement)) {
          await Promise.resolve(exit.call(doc)).catch(() => {});
        }
        try {
          (window.screen?.orientation as any)?.unlock?.();
        } catch {}
        if (window.history.state?.dawgerFs || window.history.state?.dawgerHlsFs) {
          try {
            window.history.replaceState(null, '');
          } catch {}
        }
      }
    } catch (err) {
      console.warn('[EmbedPlayerChrome] Fullscreen error:', err);
    }
  };

  useEffect(() => {
    if (isFullscreen) {
      (window as any).__DAWGER_EXIT_FULLSCREEN__ = () => {
        void toggleFullscreen();
      };
    }
    const handleFullscreenChange = () => {
      const doc = document as any;
      const active = Boolean(doc.fullscreenElement || doc.webkitFullscreenElement || doc.mozFullScreenElement);
      if (active) {
        manualFullscreenRef.current = false;
        (window as any).__DAWGER_CSS_FULLSCREEN__ = true;
        setIsFullscreen(true);
      } else if (!manualFullscreenRef.current) {
        (window as any).__DAWGER_CSS_FULLSCREEN__ = false;
        setIsFullscreen(false);
        (window as any).__DAWGER_EXIT_FULLSCREEN__ = null;
        if (window.history.state?.dawgerFs || window.history.state?.dawgerHlsFs) {
          try {
            window.history.replaceState(null, '');
          } catch {}
        }
        try {
          (window.screen?.orientation as any)?.unlock?.();
        } catch {}
      }
    };

    const handlePopState = () => {
      if (manualFullscreenRef.current || isFullscreen) {
        manualFullscreenRef.current = false;
        (window as any).__DAWGER_CSS_FULLSCREEN__ = false;
        setIsFullscreen(false);
        (window as any).__DAWGER_EXIT_FULLSCREEN__ = null;
        const doc = document as any;
        const exit = doc.exitFullscreen || doc.webkitExitFullscreen || doc.mozCancelFullScreen || doc.msExitFullscreen;
        if (typeof exit === 'function' && (doc.fullscreenElement || doc.webkitFullscreenElement || doc.mozFullScreenElement)) {
          Promise.resolve(exit.call(doc)).catch(() => {});
        }
        try {
          (window.screen?.orientation as any)?.unlock?.();
        } catch {}
      }
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
    document.addEventListener('mozfullscreenchange', handleFullscreenChange);
    document.addEventListener('MSFullscreenChange', handleFullscreenChange);
    window.addEventListener('popstate', handlePopState);

    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.removeEventListener('webkitfullscreenchange', handleFullscreenChange);
      document.removeEventListener('mozfullscreenchange', handleFullscreenChange);
      document.removeEventListener('MSFullscreenChange', handleFullscreenChange);
      window.removeEventListener('popstate', handlePopState);
      const doc = document as any;
      if (!doc.fullscreenElement && !doc.webkitFullscreenElement && !doc.mozFullScreenElement && !(window as any).__DAWGER_CSS_FULLSCREEN__) {
        (window as any).__DAWGER_EXIT_FULLSCREEN__ = null;
      }
    };
  }, [isFullscreen]);

  // Escape key to exit fullscreen (CSS-only fallback; native fullscreen is handled by browser -> fullscreenchange)
  useEffect(() => {
    if (!isFullscreen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        const doc = document as any;
        const inNativeFs = Boolean(doc.fullscreenElement || doc.webkitFullscreenElement || doc.mozFullScreenElement);
        if (!inNativeFs) {
          e.preventDefault();
          e.stopPropagation();
          void toggleFullscreen();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, [isFullscreen]);

  const gearLabel = `${t('watch.sources')} & ${t('watch.settingsTitle')}`;

  return (
    <div
      ref={containerRef}
      onMouseMove={resetHideTimer}
      className={`relative w-full h-full bg-black overflow-hidden select-none group ${
        isFullscreen
          ? '!fixed !inset-0 !z-[19999] !w-screen !h-[100dvh] !m-0 !p-0 !rounded-none flex flex-col justify-center'
          : 'w-full h-full'
      }`}
    >
      {/* Left Vertical Controls Column: Back, Unified Gear (Sources + Settings), Next Episode, Fullscreen */}
      <div
        onMouseEnter={() => {
          if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
          setShowControls(true);
        }}
        onTouchStart={resetHideTimer}
        className={`absolute left-[max(0.5rem,env(safe-area-inset-left))] top-[max(0.5rem,env(safe-area-inset-top))] sm:left-3 sm:top-3 z-[10000] transition-all duration-200 flex ${isFullscreen ? 'flex-col' : 'flex-row sm:flex-col'} gap-1.5 pointer-events-auto ${
          showControls
            ? 'opacity-100 translate-x-0'
            : 'opacity-45 hover:opacity-100 translate-x-0'
        }`}
      >
        {/* 1. Bouton Retour */}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            if (isFullscreen) { void toggleFullscreen(); } else { onBack(); }
          }}
          className="flex items-center justify-center w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-black/80 hover:bg-black/95 hover:border-emerald-500/60 hover:text-emerald-400 active:scale-95 text-white border border-white/15 backdrop-blur-md shadow-xl transition-all group"
          title={isFullscreen ? t('watch.exitFullscreen') : t('watch.back')}
          aria-label={isFullscreen ? t('watch.exitFullscreen') : t('watch.back')}
        >
          <ArrowLeft className="w-3.5 h-3.5 transition-transform group-hover:-translate-x-0.5" />
        </button>

        {/* 2. Bouton Engrenage Unifié (Sources & Paramètres Dawger) */}
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            if (renderSourcesPanel) {
              setMenuOpen(!menuOpen);
            } else {
              onChangeSource?.();
            }
          }}
          onDoubleClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
          }}
          className={`flex items-center justify-center w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-black/80 hover:bg-black/95 border active:scale-95 text-white backdrop-blur-md shadow-xl transition-all group ${
            menuOpen
              ? 'border-emerald-400 text-emerald-400'
              : 'border-emerald-500/50 hover:border-emerald-400 text-emerald-400'
          }`}
          title={gearLabel}
          aria-label={gearLabel}
        >
          <Settings className={`w-3.5 h-3.5 text-emerald-400 transition-transform ${menuOpen ? 'rotate-45' : 'group-hover:rotate-45'}`} />
        </button>

        {/* 3. Bouton Épisode suivant (si disponible) */}
        {onNextEpisode && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onNextEpisode();
            }}
            className="flex items-center justify-center w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-black/80 hover:bg-black/95 border border-emerald-500/40 hover:border-emerald-400 hover:text-emerald-400 active:scale-95 text-white backdrop-blur-md shadow-xl transition-all group"
            title="Épisode suivant"
            aria-label="Épisode suivant"
          >
            <SkipForward className="w-3.5 h-3.5 text-emerald-400 transition-transform group-hover:translate-x-0.5" />
          </button>
        )}
        {!onNextEpisode && onNextMovie && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onNextMovie();
            }}
            className="flex items-center justify-center w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-black/80 hover:bg-black/95 border border-emerald-500/40 hover:border-emerald-400 hover:text-emerald-400 active:scale-95 text-white backdrop-blur-md shadow-xl transition-all group"
            title={nextMovieTitle ? `Film suivant : ${nextMovieTitle}` : "Film suivant"}
            aria-label="Film suivant"
          >
            <SkipForward className="w-3.5 h-3.5 text-emerald-400 transition-transform group-hover:translate-x-0.5" />
          </button>
        )}

        {/* 4. Bouton Plein écran */}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            toggleFullscreen();
          }}
          className="flex items-center justify-center w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-black/80 hover:bg-black/95 hover:border-emerald-500/60 hover:text-emerald-400 active:scale-95 text-white border border-white/15 backdrop-blur-md shadow-xl transition-all group"
          title={isFullscreen ? t('watch.exitFullscreen') : t('watch.fullscreen')}
          aria-label={isFullscreen ? t('watch.exitFullscreen') : t('watch.fullscreen')}
        >
          {isFullscreen ? (
            <Minimize className="w-3.5 h-3.5 transition-transform group-hover:scale-90" />
          ) : (
            <Maximize className="w-3.5 h-3.5 transition-transform group-hover:scale-110" />
          )}
        </button>

        {extraHeaderControls}
      </div>

      {/* Video Content Container with Direct Hardware OLED CSS Filter + CSS Zoom */}
      <div
        data-embed-chrome-content
        style={{
          filter: oledFilterStyle !== 'none' ? oledFilterStyle : undefined,
          transform: embedZoom !== 1 ? `scale(${embedZoom})` : undefined,
          transformOrigin: 'center center',
        }}
        className="w-full h-full flex items-center justify-center transition-all duration-300"
      >
        {children}
      </div>

      {/* Unified Gear Drawer for Iframes (rendered inside containerRef for fullscreen support) */}
      {renderSourcesPanel && (
        <EmbedSettingsDrawer
          isOpen={menuOpen}
          onClose={() => setMenuOpen(false)}
          sourcesContent={renderSourcesPanel()}
          videoOledMode={videoOled}
          customOled={customOled}
          onOledChange={(mode, custom) => {
            setVideoOled(mode);
            setCustomOled(custom);
          }}
          embedZoom={embedZoom}
          onEmbedZoomChange={setEmbedZoom}
          autoNext={autoNext}
          autoFallback={autoFallbackPref}
          sessionEndEnabled={sessionEndEnabled}
          onToggleAutoNext={setAutoNext}
          onToggleAutoFallback={setAutoFallbackPref}
          onToggleSessionEnd={setSessionEndEnabled}
        />
      )}
    </div>
  );
};

export default EmbedPlayerChrome;
