import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Star, Calendar, Play, X, Check } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { TMDB_API_KEY, TMDB_API_URL } from '../config/config';
import { getTmdbLanguage } from '../i18n';

interface TrailerInfo {
  youtubeKeys: string[];
  overview: string | null;
  backdropPath: string | null;
}

const trailerCache = new Map<string, TrailerInfo>();
const mp4UrlCache = new Map<string, { url: string; expiresAt: number }>();

function gmRequest(options: {
  method: 'GET' | 'POST';
  url: string;
  headers?: Record<string, string>;
  data?: string;
}): Promise<string> {
  return new Promise((resolve, reject) => {
    const gm = (window as any).GM_xmlhttpRequest;
    if (typeof gm !== 'function') {
      reject(new Error('GM_xmlhttpRequest unavailable'));
      return;
    }
    gm({
      method: options.method,
      url: options.url,
      headers: options.headers || {},
      data: options.data,
      timeout: 6000,
      onload: (res: any) => {
        if (res && res.status >= 200 && res.status < 300 && typeof res.responseText === 'string') {
          resolve(res.responseText);
        } else {
          reject(new Error(`HTTP ${res?.status || 0}`));
        }
      },
      onerror: () => reject(new Error('GM network error')),
      ontimeout: () => reject(new Error('GM timeout')),
    });
  });
}

function pickBestMp4FromPlayerJson(data: any): string | null {
  const formats: any[] = data?.streamingData?.formats || [];
  const best =
    formats.find((f) => f?.url && f.itag === 22) ||
    formats.find((f) => f?.url && f.itag === 18) ||
    formats.find((f) => f?.url && String(f.mimeType || '').includes('video/mp4')) ||
    formats.find((f) => f?.url);
  return best?.url || null;
}

async function extractYoutubeDirectMp4(videoId: string): Promise<string | null> {
  if (!videoId) return null;
  const cached = mp4UrlCache.get(videoId);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.url;
  }

  // 1. Mobile WebView (Android .apk & iOS .ipa) via native GM_xmlhttpRequest bridge
  if (typeof (window as any).GM_xmlhttpRequest === 'function') {
    try {
      const embedHtml = await gmRequest({
        method: 'GET',
        url: `https://www.youtube.com/embed/${videoId}`,
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
        },
      });
      const visitorMatch = embedHtml.match(/"VISITOR_DATA":"([^"]+)"/);
      const visitorData = visitorMatch ? visitorMatch[1] : undefined;

      const playerRaw = await gmRequest({
        method: 'POST',
        url: 'https://www.youtube.com/youtubei/v1/player?prettyPrint=false',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'com.google.android.youtube/20.03.32 (Linux; U; Android 14) gzip',
          'X-YouTube-Client-Name': '3',
          'X-YouTube-Client-Version': '20.03.32',
        },
        data: JSON.stringify({
          videoId,
          context: {
            client: {
              clientName: 'ANDROID',
              clientVersion: '20.03.32',
              androidSdkVersion: 34,
              osName: 'Android',
              osVersion: '14',
              hl: 'fr',
              gl: 'FR',
              visitorData,
            },
          },
          contentCheckOk: true,
          racyCheckOk: true,
        }),
      });
      const url = pickBestMp4FromPlayerJson(JSON.parse(playerRaw));
      if (url) {
        mp4UrlCache.set(videoId, { url, expiresAt: Date.now() + 45 * 60 * 1000 });
        return url;
      }
    } catch {
      // Fall through to PC methods
    }
  }

  // 2. PC Desktop (.exe) via local Node endpoint /__dawger_yt_mp4
  try {
    const localRes = await fetch(`/__dawger_yt_mp4?id=${encodeURIComponent(videoId)}`, {
      cache: 'no-store',
    });
    const contentType = localRes.headers.get('content-type') || '';
    if (localRes.ok && contentType.includes('application/json')) {
      const json = await localRes.json();
      if (json && typeof json.url === 'string' && json.url.startsWith('http')) {
        mp4UrlCache.set(videoId, { url: json.url, expiresAt: Date.now() + 45 * 60 * 1000 });
        return json.url;
      }
    }
  } catch {
    // Fall through to direct fetch
  }

  // 3. Direct InnerTube fetch (works in Electron with webSecurity:false + X-Dawger-YT-UA hook)
  try {
    const embedRes = await fetch(`https://www.youtube.com/embed/${videoId}`);
    const embedHtml = await embedRes.text();
    const visitorMatch = embedHtml.match(/"VISITOR_DATA":"([^"]+)"/);
    const visitorData = visitorMatch ? visitorMatch[1] : undefined;

    const playerRes = await fetch('https://www.youtube.com/youtubei/v1/player?prettyPrint=false', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Dawger-YT-UA': 'com.google.android.youtube/20.03.32 (Linux; U; Android 14) gzip',
        'X-YouTube-Client-Name': '3',
        'X-YouTube-Client-Version': '20.03.32',
      },
      body: JSON.stringify({
        videoId,
        context: {
          client: {
            clientName: 'ANDROID',
            clientVersion: '20.03.32',
            androidSdkVersion: 34,
            osName: 'Android',
            osVersion: '14',
            hl: 'fr',
            gl: 'FR',
            visitorData,
          },
        },
        contentCheckOk: true,
        racyCheckOk: true,
      }),
    });
    const data = await playerRes.json();
    const url = pickBestMp4FromPlayerJson(data);
    if (url) {
      mp4UrlCache.set(videoId, { url, expiresAt: Date.now() + 45 * 60 * 1000 });
      return url;
    }
  } catch {
    // ignore
  }

  return null;
}

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

    if (expectedTitle && !titlesMatch(expectedTitle, detail)) {
      const altType: 'movie' | 'tv' = resolvedType === 'movie' ? 'tv' : 'movie';
      try {
        const alt = await fetchVideosForType(altType, mediaId, lang);
        if (titlesMatch(expectedTitle, alt.detail)) {
          detail = alt.detail;
          videos = alt.videos;
          resolvedType = altType;
        } else {
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
  detailPath?: string;
  starred?: boolean;
  onToggleWatchlist?: (e: React.MouseEvent) => void;
  onClose?: () => void;
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
  detailPath,
  starred = false,
  onToggleWatchlist,
  onClose,
  active,
  onOverviewLoaded,
}) => {
  const navigate = useNavigate();
  const [info, setInfo] = useState<TrailerInfo | null>(null);
  const [keyIndex, setKeyIndex] = useState(0);
  const [directMp4Url, setDirectMp4Url] = useState<string | null>(null);
  const [useFallbackEmbed, setUseFallbackEmbed] = useState(false);
  const [isVideoVisible, setIsVideoVisible] = useState(false);
  const [boxStyle, setBoxStyle] = useState<React.CSSProperties | null>(null);
  const anchorRef = useRef<HTMLDivElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const iframeRef = useRef<HTMLIFrameElement | null>(null);

  // Close when another card opens its preview or when Escape is pressed
  useEffect(() => {
    if (!active) return;
    const handleOtherOpen = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail && (detail.mediaId !== mediaId || detail.mediaType !== mediaType)) {
        onClose?.();
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose?.();
      }
    };
    window.addEventListener('dawger:teaser-preview-open', handleOtherOpen);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('dawger:teaser-preview-open', handleOtherOpen);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [active, mediaId, mediaType, onClose]);

  useLayoutEffect(() => {
    if (!active) {
      setBoxStyle(null);
      return;
    }
    const updatePosition = () => {
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const el = anchorRef.current;
      const rect = el ? el.getBoundingClientRect() : { width: 200, height: 300 };
      // Enlarged by +60% and strictly locked at the exact center of the screen
      const targetW = Math.min(vw - 24, Math.max(rect.width * 2.64, 544));
      const targetH = Math.min(vh - 24, Math.max(rect.height * 1.89, 512));
      const left = Math.max(12, Math.round((vw - targetW) / 2));
      const top = Math.max(12, Math.round((vh - targetH) / 2));
      setBoxStyle({
        position: 'fixed',
        left: `${left}px`,
        top: `${top}px`,
        width: `${Math.round(targetW)}px`,
        height: `${Math.round(targetH)}px`,
        zIndex: 9999,
      });
    };
    updatePosition();
    window.addEventListener('resize', updatePosition);
    return () => {
      window.removeEventListener('resize', updatePosition);
    };
  }, [active]);

  useEffect(() => {
    setInfo(null);
    setKeyIndex(0);
    setDirectMp4Url(null);
    setUseFallbackEmbed(false);
    setIsVideoVisible(false);
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
    };
  }, [active, mediaType, mediaId, initialOverview, title, onOverviewLoaded]);

  const ytKey = info?.youtubeKeys?.[keyIndex] || null;

  // Extract direct MP4 stream for the current ytKey
  useEffect(() => {
    setDirectMp4Url(null);
    setIsVideoVisible(false);
    if (!active || !ytKey) return;

    let cancelled = false;
    extractYoutubeDirectMp4(ytKey).then((mp4) => {
      if (cancelled) return;
      if (mp4) {
        setDirectMp4Url(mp4);
        setUseFallbackEmbed(false);
      } else {
        const totalKeys = info?.youtubeKeys?.length || 0;
        if (keyIndex + 1 < totalKeys) {
          setKeyIndex((prev) => prev + 1);
        } else {
          // Last resort fallback if all keys failed MP4 extraction
          setUseFallbackEmbed(true);
        }
      }
    });

    return () => {
      cancelled = true;
    };
  }, [active, ytKey, keyIndex, info?.youtubeKeys?.length]);

  const tryNextKey = () => {
    setIsVideoVisible(false);
    setDirectMp4Url(null);
    const totalKeys = info?.youtubeKeys?.length || 0;
    if (keyIndex + 1 < totalKeys) {
      setKeyIndex((prev) => prev + 1);
    } else if (!useFallbackEmbed) {
      setUseFallbackEmbed(true);
    }
  };

  if (!active) return null;

  const synopsisText = initialOverview || info?.overview || '';
  const coverUrl = info?.backdropPath
    ? `https://image.tmdb.org/t/p/w780${info.backdropPath}`
    : posterUrl;

  const handleWatchClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onClose?.();
    if (detailPath) {
      navigate(detailPath);
    }
  };

  return (
    <div ref={anchorRef} className="absolute inset-0 pointer-events-none">
      {boxStyle &&
        typeof document !== 'undefined' &&
        createPortal(
          <>
            {/* Backdrop click-outside area ("dans le vide") to dismiss */}
            <div
              className="fixed inset-0 z-[9998] bg-black/50 backdrop-blur-[2px] animate-in fade-in duration-150"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onClose?.();
              }}
            />

            {/* Enlarged +60% Teaser Floating Window */}
            <div
              style={boxStyle}
              onClick={(e) => e.stopPropagation()}
              className="rounded-2xl overflow-hidden pointer-events-auto bg-zinc-950 border border-white/20 shadow-[0_25px_80px_rgba(0,0,0,0.95)] animate-in fade-in zoom-in-95 duration-200 select-none"
            >
              {/* Extracted Native HTML5 <video> — zero YouTube UI, zero delay, direct sound at 100% */}
              {directMp4Url && (
                <div className="absolute inset-0 bg-black overflow-hidden pointer-events-none">
                  <video
                    ref={videoRef}
                    src={directMp4Url}
                    autoPlay
                    playsInline
                    loop
                    muted={false}
                    onLoadedData={(e) => {
                      const v = e.currentTarget;
                      v.muted = false;
                      v.volume = 1;
                      v.play().catch(() => {});
                      setIsVideoVisible(true);
                    }}
                    onPlay={(e) => {
                      const v = e.currentTarget;
                      v.muted = false;
                      v.volume = 1;
                      setIsVideoVisible(true);
                    }}
                    onError={tryNextKey}
                    className="w-full h-full object-cover pointer-events-none"
                  />
                </div>
              )}

              {/* Fallback embed only if direct MP4 extraction was unavailable for all keys */}
              {!directMp4Url && useFallbackEmbed && ytKey && (
                <div className="absolute inset-0 bg-black overflow-hidden pointer-events-none">
                  <iframe
                    ref={iframeRef}
                    onLoad={() => {
                      try {
                        iframeRef.current?.contentWindow?.postMessage(
                          JSON.stringify({ event: 'command', func: 'unMute', args: [], id: 1, channel: 'widget' }),
                          '*',
                        );
                        iframeRef.current?.contentWindow?.postMessage(
                          JSON.stringify({ event: 'command', func: 'setVolume', args: [100], id: 1, channel: 'widget' }),
                          '*',
                        );
                      } catch {
                        // ignore
                      }
                      setIsVideoVisible(true);
                    }}
                    src={`https://www.youtube-nocookie.com/embed/${ytKey}?autoplay=1&mute=0&controls=0&disablekb=1&fs=0&iv_load_policy=3&modestbranding=1&rel=0&playsinline=1&showinfo=0&loop=1&playlist=${ytKey}&enablejsapi=1`}
                    title="Teaser preview"
                    allow="autoplay; encrypted-media"
                    className="w-full h-full border-0 scale-[2.15] pointer-events-none"
                  />
                </div>
              )}

              {/* Cover image (backdrop or poster) shown only until the first video frame is ready */}
              <div
                className={`absolute inset-0 z-10 bg-zinc-950 transition-opacity duration-200 pointer-events-none ${
                  isVideoVisible ? 'opacity-0' : 'opacity-100'
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
                <span className="absolute top-3.5 left-3.5 z-20 px-3 py-1 rounded-lg bg-black/75 backdrop-blur-sm text-xs font-semibold uppercase tracking-wider text-white/90 pointer-events-none">
                  {typeLabel}
                </span>
              )}

              {/* Top-right close button */}
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  onClose?.();
                }}
                aria-label="Fermer l'aperçu"
                className="absolute top-3.5 right-3.5 z-30 w-8 h-8 rounded-full bg-black/70 hover:bg-black/90 border border-white/15 text-white/80 hover:text-white flex items-center justify-center transition-colors"
              >
                <X className="w-4 h-4" />
              </button>

              {/* Foreground gradient + Title/Logo + Rating/Year + Synopsis + Action Buttons */}
              <div className="absolute inset-0 z-20 bg-gradient-to-t from-black via-black/80 to-transparent flex flex-col justify-end p-5 sm:p-6">
                {logoUrl ? (
                  <div className="mb-2 h-10 sm:h-12 flex items-end">
                    <img
                      src={logoUrl}
                      alt={title || ''}
                      className="max-h-full max-w-[75%] object-contain object-left drop-shadow-md"
                      draggable={false}
                    />
                  </div>
                ) : (
                  title && (
                    <h3 className="text-lg sm:text-xl font-bold text-white line-clamp-1 mb-1.5 drop-shadow">
                      {title}
                    </h3>
                  )
                )}

                <div className="flex items-center gap-3 mb-2">
                  {typeof voteAverage === 'number' && voteAverage > 0 && (
                    <div className="flex items-center gap-1">
                      <Star className="w-4 h-4 text-yellow-400" fill="currentColor" />
                      <span className="text-xs sm:text-sm font-semibold text-white/95">
                        {voteAverage.toFixed(1)}
                      </span>
                    </div>
                  )}
                  {year ? (
                    <div className="flex items-center gap-1">
                      <Calendar className="w-4 h-4 text-white/70" />
                      <span className="text-xs sm:text-sm text-white/80">{year}</span>
                    </div>
                  ) : null}
                </div>

                {synopsisText && (
                  <p className="text-xs sm:text-sm leading-relaxed text-white/90 line-clamp-4 sm:line-clamp-5 drop-shadow mb-4">
                    {synopsisText}
                  </p>
                )}

                {/* Action buttons: Regarder + Ma liste */}
                <div className="flex items-center gap-3 pt-1">
                  <button
                    type="button"
                    onClick={handleWatchClick}
                    className="flex-1 sm:flex-none inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 active:scale-[0.98] text-black font-bold text-xs sm:text-sm shadow-lg shadow-emerald-500/25 transition-all cursor-pointer"
                  >
                    <Play className="w-4 h-4 fill-current" />
                    <span>Regarder</span>
                  </button>

                  {onToggleWatchlist && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        onToggleWatchlist(e);
                      }}
                      className={`inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl font-semibold text-xs sm:text-sm border backdrop-blur-md active:scale-[0.98] transition-all cursor-pointer ${
                        starred
                          ? 'bg-yellow-500/20 border-yellow-400/50 text-yellow-300 hover:bg-yellow-500/30'
                          : 'bg-white/10 border-white/20 text-white hover:bg-white/20'
                      }`}
                    >
                      <Star
                        className={`w-4 h-4 ${starred ? 'text-yellow-400' : 'text-white'}`}
                        fill={starred ? 'currentColor' : 'none'}
                      />
                      <span>{starred ? 'Dans Ma liste' : 'Ma liste'}</span>
                      {starred && <Check className="w-3.5 h-3.5 text-yellow-400" />}
                    </button>
                  )}
                </div>
              </div>
            </div>
          </>,
          document.body,
        )}
    </div>
  );
};
