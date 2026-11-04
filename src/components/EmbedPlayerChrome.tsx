import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, Clock, Layers, Maximize, Minimize, FastForward, SkipForward, Settings, X, Check } from 'lucide-react';
import FrameRedirectWatch, { triggerFrameBlocked } from './FrameRedirectWatch';

export interface EmbedPlayerChromeProps {
  onBack: () => void;
  onChangeSource: () => void;
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
 * Provides the 4+ left vertical controls (Back, Sources, Next Episode, Fullscreen, Player Settings),
 * top-center dynamic session end badge,
 * FrameRedirectWatch auto-fallback watchdog, and real-time OLED video rendering filter.
 */
const EmbedPlayerChrome: React.FC<EmbedPlayerChromeProps> = ({
  onBack,
  onChangeSource,
  onFallbackNext,
  onNextEpisode,
  onNextMovie,
  nextMovieTitle,
  currentSourceLabel,
  runtimeMinutes,
  extraHeaderControls,
  children,
}) => {
  const { t } = useTranslation();
  const [showControls, setShowControls] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [clockTick, setClockTick] = useState(Date.now());
  const [showSkipIntroPill, setShowSkipIntroPill] = useState(true);

  // Synced preferences from localStorage
  const [autoSkipIntro, setAutoSkipIntro] = useState<boolean>(() => localStorage.getItem('dawger_auto_skip_intro') !== 'false');
  const [sessionEndPref, setSessionEndPref] = useState<boolean>(() => localStorage.getItem('dawger_session_end_time') !== 'false');
  const [autoFallbackPref, setAutoFallbackPref] = useState<boolean>(() => localStorage.getItem('dawger_auto_fallback') !== 'false');
  const [videoOled, setVideoOled] = useState<string>(() => localStorage.getItem('playerVideoOled') || 'off');
  const [speedPref, setSpeedPref] = useState<string>(() => localStorage.getItem('playerPlaybackSpeed') || '1');
  const [autoNext, setAutoNext] = useState<boolean>(() => localStorage.getItem('playerAutoNextEpisodePref') !== 'false');
  const [saveProgress, setSaveProgress] = useState<boolean>(() => localStorage.getItem('playerSaveProgressPref') !== 'false');

  const containerRef = useRef<HTMLDivElement>(null);
  const hideTimerRef = useRef<NodeJS.Timeout | null>(null);

  const notifyPrefsChanged = () => {
    window.dispatchEvent(new CustomEvent('dawger-player-prefs-changed'));
  };

  // Clock tick every 20 seconds to keep dynamic session end accurate
  useEffect(() => {
    const timer = setInterval(() => setClockTick(Date.now()), 20000);
    return () => clearInterval(timer);
  }, []);

  // Sync preferences from other components/tabs
  useEffect(() => {
    const syncFromStorage = () => {
      setAutoSkipIntro(localStorage.getItem('dawger_auto_skip_intro') !== 'false');
      setSessionEndPref(localStorage.getItem('dawger_session_end_time') !== 'false');
      setAutoFallbackPref(localStorage.getItem('dawger_auto_fallback') !== 'false');
      setVideoOled(localStorage.getItem('playerVideoOled') || 'off');
      setSpeedPref(localStorage.getItem('playerPlaybackSpeed') || '1');
      setAutoNext(localStorage.getItem('playerAutoNextEpisodePref') !== 'false');
      setSaveProgress(localStorage.getItem('playerSaveProgressPref') !== 'false');
    };
    window.addEventListener('dawger-player-prefs-changed', syncFromStorage);
    window.addEventListener('storage', syncFromStorage);
    return () => {
      window.removeEventListener('dawger-player-prefs-changed', syncFromStorage);
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

  // Auto-skip intro: hide skip pill after 2 minutes
  useEffect(() => {
    const timer = setTimeout(() => setShowSkipIntroPill(false), 120000);
    return () => clearTimeout(timer);
  }, []);

  const handleToggleAutoSkip = () => {
    const next = !autoSkipIntro;
    setAutoSkipIntro(next);
    localStorage.setItem('dawger_auto_skip_intro', next ? 'true' : 'false');
    notifyPrefsChanged();
  };

  const handleToggleSessionEnd = () => {
    const next = !sessionEndPref;
    setSessionEndPref(next);
    localStorage.setItem('dawger_session_end_time', next ? 'true' : 'false');
    notifyPrefsChanged();
  };

  const handleToggleAutoFallback = () => {
    const next = !autoFallbackPref;
    setAutoFallbackPref(next);
    localStorage.setItem('dawger_auto_fallback', next ? 'true' : 'false');
    notifyPrefsChanged();
  };

  const handleOledChange = (mode: string) => {
    setVideoOled(mode);
    localStorage.setItem('playerVideoOled', mode);
    notifyPrefsChanged();
  };

  const handleSpeedChange = (spd: string) => {
    setSpeedPref(spd);
    localStorage.setItem('playerPlaybackSpeed', spd);
    applyPlaybackSpeed(spd);
    notifyPrefsChanged();
  };

  const handleToggleAutoNext = () => {
    const next = !autoNext;
    setAutoNext(next);
    localStorage.setItem('playerAutoNextEpisodePref', next ? 'true' : 'false');
    notifyPrefsChanged();
  };

  const handleToggleSaveProgress = () => {
    const next = !saveProgress;
    setSaveProgress(next);
    localStorage.setItem('playerSaveProgressPref', next ? 'true' : 'false');
    notifyPrefsChanged();
  };

  const getOledFilterStyle = () => {
    switch (videoOled) {
      case 'natural': return 'contrast(1.08) saturate(1.1) brightness(0.98)';
      case 'cinema': return 'contrast(1.15) saturate(1.15) brightness(0.95)';
      case 'vivid': return 'contrast(1.25) saturate(1.25) brightness(0.93)';
      default: return 'none';
    }
  };

  const resetHideTimer = useCallback(() => {
    setShowControls(true);
    if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    hideTimerRef.current = setTimeout(() => {
      setShowControls(false);
    }, 3500);
  }, []);

  // Dynamic session end calculation
  const sessionEndTime = useMemo(() => {
    if (!sessionEndPref) return null;
    const mins = runtimeMinutes && runtimeMinutes > 0 ? runtimeMinutes : 45;
    const rate = parseFloat(speedPref) || 1;
    const endMs = clockTick + (mins / rate) * 60 * 1000;
    const end = new Date(endMs);
    return end.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }).replace(':', 'h');
  }, [sessionEndPref, runtimeMinutes, clockTick, speedPref]);

  const toggleFullscreen = async () => {
    try {
      if (!document.fullscreenElement) {
        if (containerRef.current) {
          await containerRef.current.requestFullscreen();
          setIsFullscreen(true);
        }
      } else {
        await document.exitFullscreen();
        setIsFullscreen(false);
      }
    } catch (err) {
      console.warn('[EmbedPlayerChrome] Fullscreen error:', err);
    }
  };

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  const handleManualSkipIntro = () => {
    if (containerRef.current) {
      const videos = containerRef.current.querySelectorAll('video');
      videos.forEach((v) => {
        try {
          v.currentTime = Math.min(v.duration || 9999, v.currentTime + 85);
        } catch { /* ignore */ }
      });
      const iframes = containerRef.current.querySelectorAll('iframe');
      iframes.forEach((ifr) => {
        try {
          ifr.contentWindow?.postMessage({ event: 'command', func: 'seekTo', args: [85] }, '*');
          ifr.contentWindow?.postMessage({ type: 'player:seek', value: 85 }, '*');
          ifr.contentWindow?.postMessage({ action: 'seek', time: 85 }, '*');
          ifr.contentWindow?.postMessage({ method: 'seek', value: 85 }, '*');
          ifr.contentWindow?.postMessage('seek:+85', '*');
        } catch { /* ignore */ }
      });
    }
    setShowSkipIntroPill(false);
  };

  return (
    <div
      ref={containerRef}
      onMouseMove={resetHideTimer}
      onTouchStart={resetHideTimer}
      className={`relative w-full h-full bg-black overflow-hidden select-none group ${
        isFullscreen
          ? 'fixed inset-0 z-[9999] w-screen h-screen m-0 p-0 rounded-none flex flex-col justify-center'
          : 'w-full h-full'
      }`}
    >
      {/* Left Vertical Controls Column: Back, Sources, Next Episode, Fullscreen */}
      <div
        onMouseEnter={() => {
          if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
          setShowControls(true);
        }}
        className={`absolute left-2.5 top-2.5 sm:left-3 sm:top-3 z-[10000] transition-all duration-200 flex flex-col gap-1.5 pointer-events-auto ${
          showControls
            ? 'opacity-100 translate-x-0'
            : 'opacity-35 hover:opacity-100 translate-x-0'
        }`}
      >
        {/* 1. Bouton Retour */}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onBack();
          }}
          className="flex items-center justify-center w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-black/80 hover:bg-black/95 hover:border-emerald-500/60 hover:text-emerald-400 active:scale-95 text-white border border-white/15 backdrop-blur-md shadow-xl transition-all group"
          title={isFullscreen ? t('watch.exitFullscreen') : t('watch.back')}
          aria-label={isFullscreen ? t('watch.exitFullscreen') : t('watch.back')}
        >
          <ArrowLeft className="w-3.5 h-3.5 transition-transform group-hover:-translate-x-0.5" />
        </button>

        {/* 2. Bouton Sources (vert émeraude Dawger) */}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onChangeSource();
          }}
          className="flex items-center justify-center w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-black/80 hover:bg-black/95 border border-emerald-500/50 hover:border-emerald-400 active:scale-95 text-white backdrop-blur-md shadow-xl transition-all group"
          title={t('watch.sources')}
          aria-label={t('watch.sources')}
        >
          <Layers className="w-3.5 h-3.5 text-emerald-400 transition-transform group-hover:scale-110" />
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

        {/* 4. Bouton Paramètres (colonne de gauche) */}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setShowSettings((prev) => !prev);
          }}
          className={`flex items-center justify-center w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-black/80 hover:bg-black/95 active:scale-95 text-white border backdrop-blur-md shadow-xl transition-all group ${
            showSettings ? 'border-emerald-500 text-emerald-400' : 'border-white/15 hover:border-emerald-500/60 hover:text-emerald-400'
          }`}
          title={t('watch.settingsTitle') || 'Paramètres'}
          aria-label={t('watch.settingsTitle') || 'Paramètres'}
        >
          <Settings className={`w-3.5 h-3.5 transition-transform ${showSettings ? 'rotate-45' : 'group-hover:rotate-45'}`} />
        </button>

        {/* 5. Bouton Plein écran */}
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

      {/* Panneau Paramètres Player (ouvert depuis la colonne de gauche) */}
      {showSettings && (
        <div
          onClick={(e) => e.stopPropagation()}
          className="absolute inset-y-0 left-0 w-80 sm:w-96 max-w-[90vw] z-[10001] bg-black/95 border-r border-emerald-500/30 backdrop-blur-xl p-5 flex flex-col shadow-2xl animate-in slide-in-from-left duration-200 overflow-y-auto"
        >
          <div className="flex items-center justify-between pb-4 border-b border-white/10 mb-4">
            <div className="flex items-center gap-2">
              <Settings className="w-4 h-4 text-emerald-400" />
              <h3 className="text-white font-bold text-sm sm:text-base">Paramètres du lecteur</h3>
            </div>
            <button
              type="button"
              onClick={() => setShowSettings(false)}
              className="p-1 rounded-lg hover:bg-white/10 text-gray-400 hover:text-white transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="space-y-5 text-xs sm:text-sm">
            {/* Mode OLED */}
            <div>
              <span className="text-gray-300 font-semibold block mb-2">Filtre d'image OLED</span>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { id: 'off', label: 'Désactivé' },
                  { id: 'natural', label: 'Naturel' },
                  { id: 'cinema', label: 'Cinéma' },
                  { id: 'vivid', label: 'Vif' },
                ].map((mode) => (
                  <button
                    key={mode.id}
                    type="button"
                    onClick={() => handleOledChange(mode.id)}
                    className={`px-3 py-2 rounded-lg text-left font-medium transition-all border ${
                      videoOled === mode.id
                        ? 'bg-emerald-500/20 border-emerald-500 text-emerald-300'
                        : 'bg-white/5 border-white/10 text-gray-300 hover:bg-white/10'
                    }`}
                  >
                    {mode.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Vitesse de lecture */}
            <div>
              <span className="text-gray-300 font-semibold block mb-2">Vitesse de lecture</span>
              <div className="flex gap-1.5 flex-wrap">
                {['0.75', '1', '1.25', '1.5', '2'].map((spd) => (
                  <button
                    key={spd}
                    type="button"
                    onClick={() => handleSpeedChange(spd)}
                    className={`flex-1 min-w-[50px] py-1.5 rounded-lg font-medium text-center transition-all border ${
                      speedPref === spd
                        ? 'bg-emerald-500/20 border-emerald-500 text-emerald-300'
                        : 'bg-white/5 border-white/10 text-gray-300 hover:bg-white/10'
                    }`}
                  >
                    {spd}x
                  </button>
                ))}
              </div>
            </div>

            {/* Toggles */}
            <div className="pt-2 border-t border-white/10 space-y-3">
              <label className="flex items-center justify-between cursor-pointer group">
                <span className="text-gray-300 group-hover:text-white transition-colors">Passer les intros auto</span>
                <input
                  type="checkbox"
                  checked={autoSkipIntro}
                  onChange={handleToggleAutoSkip}
                  className="accent-emerald-500 w-4 h-4 cursor-pointer"
                />
              </label>

              <label className="flex items-center justify-between cursor-pointer group">
                <span className="text-gray-300 group-hover:text-white transition-colors">Auto-fallback en cas de panne</span>
                <input
                  type="checkbox"
                  checked={autoFallbackPref}
                  onChange={handleToggleAutoFallback}
                  className="accent-emerald-500 w-4 h-4 cursor-pointer"
                />
              </label>

              <label className="flex items-center justify-between cursor-pointer group">
                <span className="text-gray-300 group-hover:text-white transition-colors">Estimation fin de séance</span>
                <input
                  type="checkbox"
                  checked={sessionEndPref}
                  onChange={handleToggleSessionEnd}
                  className="accent-emerald-500 w-4 h-4 cursor-pointer"
                />
              </label>

              <label className="flex items-center justify-between cursor-pointer group">
                <span className="text-gray-300 group-hover:text-white transition-colors">Épisode suivant auto</span>
                <input
                  type="checkbox"
                  checked={autoNext}
                  onChange={handleToggleAutoNext}
                  className="accent-emerald-500 w-4 h-4 cursor-pointer"
                />
              </label>
            </div>
          </div>
        </div>
      )}





      {/* Video Content Container with Direct Hardware OLED CSS Filter */}
      <div
        data-embed-chrome-content
        style={{ filter: getOledFilterStyle() }}
        className="w-full h-full flex items-center justify-center transition-all duration-300"
      >
        {children}
      </div>


    </div>
  );
};

export default EmbedPlayerChrome;
