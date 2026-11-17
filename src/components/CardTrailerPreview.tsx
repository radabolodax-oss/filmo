import React, { useEffect, useRef, useState } from 'react';
import axios from 'axios';
import { TMDB_API_KEY, TMDB_API_URL } from '../config/config';
import { getTmdbLanguage } from '../i18n';

interface TrailerInfo {
  youtubeKeys: string[];
  overview: string | null;
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
    };
  }

  let youtubeKeys: string[] = [];
  let overview: string | null = existingOverview || null;
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
  } catch {
    hadNetworkError = true;
  }

  const info: TrailerInfo = { youtubeKeys, overview };
  if (!hadNetworkError || youtubeKeys.length > 0) {
    trailerCache.set(cacheKey, info);
  }
  return info;
}

interface CardTrailerPreviewProps {
  mediaId: number;
  mediaType: 'movie' | 'tv';
  title?: string;
  overview?: string;
  posterUrl?: string;
  active: boolean;
  onOverviewLoaded?: (overview: string) => void;
}

export const CardTrailerPreview: React.FC<CardTrailerPreviewProps> = ({
  mediaId,
  mediaType,
  title,
  overview: initialOverview,
  posterUrl,
  active,
  onOverviewLoaded,
}) => {
  const [info, setInfo] = useState<TrailerInfo | null>(null);
  const [keyIndex, setKeyIndex] = useState(0);
  const [isVideoVisible, setIsVideoVisible] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const revealTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const loadTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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
  if (!ytKey) return null;

  return (
    <div className="absolute inset-0 z-[5] rounded-xl overflow-hidden pointer-events-none bg-black">
      {/* Keep iframe at opacity-100 so Chromium never throttles cross-origin video rendering */}
      <div className="absolute inset-0 bg-black">
        <iframe
          ref={iframeRef}
          onLoad={handleIframeLoad}
          src={`https://www.youtube-nocookie.com/embed/${ytKey}?autoplay=1&mute=1&controls=0&disablekb=1&fs=0&iv_load_policy=3&modestbranding=1&rel=0&playsinline=1&showinfo=0&loop=1&playlist=${ytKey}&enablejsapi=1`}
          title="Trailer preview"
          allow="autoplay; encrypted-media"
          className="w-full h-full border-0 scale-[2.95] pointer-events-none"
        />
      </div>
      {/* Poster mask on top of iframe: hides YouTube's initial pause/title HUD and fades out after 3500ms */}
      <div
        className={`absolute inset-0 z-10 bg-black transition-opacity duration-500 ${
          isVideoVisible ? 'opacity-0' : 'opacity-100'
        }`}
      >
        {posterUrl && (
          <img
            src={posterUrl}
            alt=""
            className="w-full h-full object-cover"
            draggable={false}
          />
        )}
      </div>
    </div>
  );
};
