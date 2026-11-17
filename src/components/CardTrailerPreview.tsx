import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Star, Calendar } from 'lucide-react';
import axios from 'axios';
import { TMDB_API_KEY, TMDB_API_URL } from '../config/config';
import { getTmdbLanguage } from '../i18n';

interface TrailerInfo {
  youtubeKeys: string[];
  overview: string | null;
  backdropPath: string | null;
}

const trailerCache = new Map<string, TrailerInfo>();

function normalizeTitle(str?: string | null): string {
  return (str || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '');
}

function titlesMatch(expected: string | undefined, data: any): boolean {
  if (!expected) return true;
  const exp = normalizeTitle(expected);
  if (!exp) return true;
  const candidates = [
    data?.title,
    data?.name,
    data?.original_title,
    data?.original_name,
  ]
    .map(normalizeTitle)
    .filter(Boolean);
  if (candidates.length === 0) return true;
  return candidates.some((c) => c === exp || c.includes(exp) || exp.includes(c));
}

function rankVideosTeaserFirst(videos: any[]): string[] {
  const yt = videos.filter((v) => v?.site === 'YouTube' && typeof v?.key === 'string' && v.key.trim() !== '');
  const ordered = [
    ...yt.filter((v) => v.type === 'Teaser' && v.official),
    ...yt.filter((v) => v.type === 'Teaser' && !v.official),
    ...yt.filter((v) => v.type === 'Trailer' && v.official),
    ...yt.filter((v) => v.type === 'Trailer' && !v.official),
    ...yt.filter((v) => v.type === 'Clip' && v.official),
    ...yt.filter(
      (v) =>
        v.type !== 'Teaser' &&
        v.type !== 'Trailer' &&
        v.type !== 'Behind the Scenes' &&
        v.type !== 'Bloopers' &&
        v.type !== 'Featurette',
    ),
  ];
  const seen = new Set<string>();
  const keys: string[] = [];
  for (const v of ordered) {
    if (!seen.has(v.key)) {
      seen.add(v.key);
      keys.push(v.key);
    }
  }
  return keys;
}

async function fetchVideosForType(
  type: 'movie' | 'tv',
  mediaId: number,
  lang: string,
): Promise<{ detail: any; videos: any[] }> {
  const detailRes = await axios.get(`${TMDB_API_URL}/${type}/${mediaId}`, {
    params: {
      api_key: TMDB_API_KEY,
      language: lang,
      append_to_response: 'videos',
      include_video_language: `${lang.split('-')[0]},en,null`,
    },
    timeout: 5000,
  });
  const detail = detailRes.data;
  let videos: any[] = detail?.videos?.results || [];

  if (!videos.some((v) => v?.site === 'YouTube' && v?.type === 'Teaser')) {
    try {
      const allRes = await axios.get(`${TMDB_API_URL}/${type}/${mediaId}/videos`, {
        params: { api_key: TMDB_API_KEY },
        timeout: 5000,
      });
      const allVideos: any[] = allRes.data?.results || [];
      videos = [...videos, ...allVideos];
    } catch {
      // ignore
    }
  }

  return { detail, videos };
}

async function fetchTrailerAndOverview(
  mediaType: 'movie' | 'tv',
  mediaId: number,
  existingOverview?: string,
  expectedTitle?: string,
): Promise<TrailerInfo> {
  const cacheKey = `${mediaType}:${mediaId}:${normalizeTitle(expectedTitle)}`;
  const cached = trailerCache.get(cacheKey);
  if (cached) {
    return {
      youtubeKeys: cached.youtubeKeys,
      overview: existingOverview || cached.overview,
      backdropPath: cached.backdropPath,
    };
  }

  let youtubeKeys: string[] = [];
  let overview: string | null = existingOverview || null;
  let backdropPath: string | null = null;
  let hadNetworkError = false;

  try {
    const lang = getTmdbLanguage();
    let resolvedType: 'movie' | 'tv' = mediaType;
    let { detail, videos } = await fetchVideosForType(resolvedType, mediaId, lang);

    // If TMDB returned a different movie/series than the card's title, try the other mediaType
    if (expectedTitle && !titlesMatch(expectedTitle, detail)) {
      const altType: 'movie' | 'tv' = resolvedType === 'movie' ? 'tv' : 'movie';
      try {
        const alt = await fetchVideosForType(altType, mediaId, lang);
        if (titlesMatch(expectedTitle, alt.detail)) {
          detail = alt.detail;
          videos = alt.videos;
          resolvedType = altType;
        } else {
          // Neither matched the expected title -> do not play a wrong movie's video
          videos = [];
        }
      } catch {
        videos = [];
      }
    }

    youtubeKeys = rankVideosTeaserFirst(videos);
    if (!overview && detail?.overview) {
      overview = detail.overview;
    }
    if (detail?.backdrop_path) {
      backdropPath = detail.backdrop_path;
    }
  } catch {
    hadNetworkError = true;
  }

  const info: TrailerInfo = { youtubeKeys, overview, backdropPath };
  if (!hadNetworkError || youtubeKeys.length > 0) {
    trailerCache.set(cacheKey, info);
  }
  return info;
}

interface CardTrailerPreviewProps {
  mediaId: number;
  mediaType: 'movie' | 'tv';
  title?: string;
  logoUrl?: string | null;
  typeLabel?: string;
  voteAverage?: number;
  year?: number | string | null;
  overview?: string;
  posterUrl?: string;
  active: boolean;
  onOverviewLoaded?: (overview: string) => void;
}

export const CardTrailerPreview: React.FC<CardTrailerPreviewProps> = ({
  mediaId,
  mediaType,
  title,
  logoUrl,
  typeLabel,
  voteAverage,
  year,
  overview: initialOverview,
  posterUrl,
  active,
  onOverviewLoaded,
}) => {
  const [info, setInfo] = useState<TrailerInfo | null>(null);
  const [keyIndex, setKeyIndex] = useState(0);
  const [isVideoVisible, setIsVideoVisible] = useState(false);
  const [boxStyle, setBoxStyle] = useState<React.CSSProperties | null>(null);
  const anchorRef = useRef<HTMLDivElement | null>(null);
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const revealTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const loadTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useLayoutEffect(() => {
    if (!active) {
      setBoxStyle(null);
      return;
    }
    const updatePosition = () => {
      const el = anchorRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const targetW = Math.min(vw - 24, Math.max(rect.width * 1.65, 340));
      const targetH = Math.min(vh - 24, Math.max(rect.height * 1.18, 320));
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;
      const left = Math.max(12, Math.min(vw - targetW - 12, centerX - targetW / 2));
      const top = Math.max(12, Math.min(vh - targetH - 12, centerY - targetH / 2));
      setBoxStyle({
        position: 'fixed',
        left: `${Math.round(left)}px`,
        top: `${Math.round(top)}px`,
        width: `${Math.round(targetW)}px`,
        height: `${Math.round(targetH)}px`,
        zIndex: 9999,
      });
    };
    updatePosition();
    window.addEventListener('scroll', updatePosition, true);
    window.addEventListener('resize', updatePosition);
    return () => {
      window.removeEventListener('scroll', updatePosition, true);
      window.removeEventListener('resize', updatePosition);
    };
  }, [active]);

  useEffect(() => {
    setInfo(null);
    setKeyIndex(0);
    setIsVideoVisible(false);
    if (revealTimerRef.current) clearTimeout(revealTimerRef.current);
    if (loadTimeoutRef.current) clearTimeout(loadTimeoutRef.current);
    if (!active) {
      return;
    }
    let cancelled = false;
    fetchTrailerAndOverview(mediaType, mediaId, initialOverview, title).then((res) => {
      if (!cancelled) {
        setInfo(res);
        setKeyIndex(0);
        if (res.overview && onOverviewLoaded) {
          onOverviewLoaded(res.overview);
        }
      }
    });
    return () => {
      cancelled = true;
      if (revealTimerRef.current) clearTimeout(revealTimerRef.current);
      if (loadTimeoutRef.current) clearTimeout(loadTimeoutRef.current);
    };
  }, [active, mediaType, mediaId, initialOverview, title, onOverviewLoaded]);

  const tryNextKey = () => {
    setIsVideoVisible(false);
    if (revealTimerRef.current) clearTimeout(revealTimerRef.current);
    if (loadTimeoutRef.current) clearTimeout(loadTimeoutRef.current);
    setKeyIndex((prev) => prev + 1);
  };

  const sendYtCommand = (func: string, args: any[] = []) => {
    try {
      iframeRef.current?.contentWindow?.postMessage(
        JSON.stringify({ event: 'command', func, args, id: 1, channel: 'widget' }),
        '*',
      );
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    if (!active) return;
    const handleMessage = (event: MessageEvent) => {
      if (!iframeRef.current || event.source !== iframeRef.current.contentWindow) return;
      try {
        const data = typeof event.data === 'string' ? JSON.parse(event.data) : event.data;
        if (data?.event === 'onError') {
          tryNextKey();
          return;
        }
        const playerState =
          data?.event === 'onStateChange'
            ? data?.info
            : data?.event === 'infoDelivery' && typeof data?.info?.playerState === 'number'
              ? data.info.playerState
              : null;
        // PlayerState 1 = playing -> clear load watchdog and wait 4500ms so YouTube HUD fades out completely, then reveal video + sound together
        if (playerState === 1) {
          if (loadTimeoutRef.current) clearTimeout(loadTimeoutRef.current);
          if (!revealTimerRef.current) {
            revealTimerRef.current = setTimeout(() => {
              sendYtCommand('unMute');
              sendYtCommand('setVolume', [100]);
              setIsVideoVisible(true);
            }, 4500);
          }
        }
      } catch {
        // ignore
      }
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [active, keyIndex]);

  const handleIframeLoad = () => {
    try {
      iframeRef.current?.contentWindow?.postMessage(
        JSON.stringify({ event: 'listening', id: 1, channel: 'widget' }),
        '*',
      );
    } catch {
      // ignore
    }
    // Keep muted while hidden behind the poster; sound will unmute when video becomes visible
    sendYtCommand('mute');
    sendYtCommand('setVolume', [0]);
    // If this YouTube key fails to start playing within 4s (e.g. blocked embed), try next teaser key
    if (loadTimeoutRef.current) clearTimeout(loadTimeoutRef.current);
    loadTimeoutRef.current = setTimeout(() => {
      tryNextKey();
    }, 4000);
  };

  if (!active) return null;

  const ytKey = info?.youtubeKeys?.[keyIndex] || null;
  const synopsisText = initialOverview || info?.overview || '';
  const coverUrl = info?.backdropPath
    ? `https://image.tmdb.org/t/p/w780${info.backdropPath}`
    : posterUrl;

  return (
    <div ref={anchorRef} className="absolute inset-0 pointer-events-none">
      {boxStyle &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
            style={boxStyle}
            className="rounded-2xl overflow-hidden pointer-events-none bg-zinc-950 border border-white/20 shadow-[0_25px_70px_rgba(0,0,0,0.92)] animate-in fade-in zoom-in-95 duration-200"
          >
            {/* Background Teaser Iframe (kept at opacity-100 so Chromium never throttles rendering) */}
            {ytKey && (
              <div className="absolute inset-0 bg-black overflow-hidden">
                <iframe
                  ref={iframeRef}
                  onLoad={handleIframeLoad}
                  src={`https://www.youtube-nocookie.com/embed/${ytKey}?autoplay=1&mute=1&controls=0&disablekb=1&fs=0&iv_load_policy=3&modestbranding=1&rel=0&playsinline=1&showinfo=0&loop=1&playlist=${ytKey}&enablejsapi=1`}
                  title="Teaser preview"
                  allow="autoplay; encrypted-media"
                  className="w-full h-full border-0 scale-[2.15] pointer-events-none"
                />
              </div>
            )}

            {/* Cover mask while loading / waiting for YouTube HUD to disappear */}
            <div
              className={`absolute inset-0 z-10 bg-zinc-950 transition-opacity duration-500 ${
                ytKey && isVideoVisible ? 'opacity-0' : 'opacity-100'
              }`}
            >
              {coverUrl && (
                <img
                  src={coverUrl}
                  alt=""
                  className="w-full h-full object-cover"
                  draggable={false}
                />
              )}
            </div>

            {/* Top-left badge */}
            {typeLabel && (
              <span className="absolute top-3 left-3 z-20 px-2.5 py-1 rounded-lg bg-black/75 backdrop-blur-sm text-[10px] font-semibold uppercase tracking-wider text-white/90">
                {typeLabel}
              </span>
            )}

            {/* Foreground gradient + Title/Logo + Rating/Year + Synopsis */}
            <div className="absolute inset-0 z-20 bg-gradient-to-t from-black via-black/75 to-transparent flex flex-col justify-end p-4">
              {logoUrl ? (
                <div className="mb-1.5 h-8 flex items-end">
                  <img
                    src={logoUrl}
                    alt={title || ''}
                    className="max-h-full max-w-[75%] object-contain object-left drop-shadow-md"
                    draggable={false}
                  />
                </div>
              ) : (
                title && (
                  <h3 className="text-base font-bold text-white line-clamp-1 mb-1 drop-shadow">
                    {title}
                  </h3>
                )
              )}

              <div className="flex items-center gap-2.5 mb-1.5">
                {typeof voteAverage === 'number' && voteAverage > 0 && (
                  <div className="flex items-center gap-1">
                    <Star className="w-3.5 h-3.5 text-yellow-400" fill="currentColor" />
                    <span className="text-xs font-medium text-white/90">
                      {voteAverage.toFixed(1)}
                    </span>
                  </div>
                )}
                {year ? (
                  <div className="flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5 text-white/70" />
                    <span className="text-xs text-white/75">{year}</span>
                  </div>
                ) : null}
              </div>

              {synopsisText && (
                <p className="text-xs leading-snug text-white/90 line-clamp-4 drop-shadow">
                  {synopsisText}
                </p>
              )}
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
};
