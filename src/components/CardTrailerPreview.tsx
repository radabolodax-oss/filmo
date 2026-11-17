import React, { useEffect, useRef, useState } from 'react';
import axios from 'axios';
import { TMDB_API_KEY, TMDB_API_URL } from '../config/config';
import { getTmdbLanguage } from '../i18n';

interface TrailerInfo {
  youtubeKey: string | null;
  overview: string | null;
}

const trailerCache = new Map<string, TrailerInfo>();

async function fetchTrailerAndOverview(
  mediaType: 'movie' | 'tv',
  mediaId: number,
  existingOverview?: string,
): Promise<TrailerInfo> {
  const cacheKey = `${mediaType}:${mediaId}`;
  const cached = trailerCache.get(cacheKey);
  if (cached) {
    return {
      youtubeKey: cached.youtubeKey,
      overview: existingOverview || cached.overview,
    };
  }

  let youtubeKey: string | null = null;
  let overview: string | null = existingOverview || null;
  let hadNetworkError = false;

  const pickBestVideo = (videos: any[]) => {
    const yt = videos.filter((v) => v?.site === 'YouTube' && v?.key);
    return (
      yt.find((v) => v.type === 'Trailer' && v.official) ||
      yt.find((v) => v.type === 'Trailer') ||
      yt.find((v) => v.type === 'Teaser' && v.official) ||
      yt.find((v) => v.type === 'Teaser') ||
      yt.find((v) => v.type !== 'Behind the Scenes' && v.type !== 'Bloopers' && v.type !== 'Featurette') ||
      null
    );
  };

  try {
    const lang = getTmdbLanguage();
    const res = await axios.get(`${TMDB_API_URL}/${mediaType}/${mediaId}/videos`, {
      params: { api_key: TMDB_API_KEY, language: lang },
      timeout: 5000,
    });
    let results: any[] = res.data?.results || [];

    if (!results.some((v) => v.site === 'YouTube' && (v.type === 'Trailer' || v.type === 'Teaser'))) {
      const enRes = await axios.get(`${TMDB_API_URL}/${mediaType}/${mediaId}/videos`, {
        params: { api_key: TMDB_API_KEY, language: 'en-US' },
        timeout: 5000,
      });
      const enResults: any[] = enRes.data?.results || [];
      results = [...results, ...enResults];
    }

    if (!results.some((v) => v.site === 'YouTube' && (v.type === 'Trailer' || v.type === 'Teaser'))) {
      const allRes = await axios.get(`${TMDB_API_URL}/${mediaType}/${mediaId}/videos`, {
        params: { api_key: TMDB_API_KEY },
        timeout: 5000,
      });
      const allResults: any[] = allRes.data?.results || [];
      results = [...results, ...allResults];
    }

    const pick = pickBestVideo(results);
    if (pick?.key) {
      youtubeKey = pick.key;
    }
  } catch {
    hadNetworkError = true;
  }

  if (!overview) {
    try {
      const detailRes = await axios.get(`${TMDB_API_URL}/${mediaType}/${mediaId}`, {
        params: { api_key: TMDB_API_KEY, language: getTmdbLanguage() },
        timeout: 5000,
      });
      if (detailRes.data?.overview) {
        overview = detailRes.data.overview;
      }
    } catch {
      // ignore
    }
  }

  const info: TrailerInfo = { youtubeKey, overview };
  if (!hadNetworkError || youtubeKey) {
    trailerCache.set(cacheKey, info);
  }
  return info;
}

interface CardTrailerPreviewProps {
  mediaId: number;
  mediaType: 'movie' | 'tv';
  overview?: string;
  posterUrl?: string;
  active: boolean;
  onOverviewLoaded?: (overview: string) => void;
}

export const CardTrailerPreview: React.FC<CardTrailerPreviewProps> = ({
  mediaId,
  mediaType,
  overview: initialOverview,
  posterUrl,
  active,
  onOverviewLoaded,
}) => {
  const [info, setInfo] = useState<TrailerInfo | null>(null);
  const [isVideoVisible, setIsVideoVisible] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const revealTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setInfo(null);
    setIsVideoVisible(false);
    if (revealTimerRef.current) clearTimeout(revealTimerRef.current);
    if (!active) {
      return;
    }
    let cancelled = false;
    fetchTrailerAndOverview(mediaType, mediaId, initialOverview).then((res) => {
      if (!cancelled) {
        setInfo(res);
        if (res.overview && onOverviewLoaded) {
          onOverviewLoaded(res.overview);
        }
      }
    });
    return () => {
      cancelled = true;
      if (revealTimerRef.current) clearTimeout(revealTimerRef.current);
    };
  }, [active, mediaType, mediaId, initialOverview, onOverviewLoaded]);

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
        const playerState =
          data?.event === 'onStateChange'
            ? data?.info
            : data?.event === 'infoDelivery' && typeof data?.info?.playerState === 'number'
              ? data.info.playerState
              : null;
        // PlayerState 1 = playing -> wait 4500ms without sending extra commands so YouTube HUD fades out completely
        if (playerState === 1) {
          if (revealTimerRef.current) clearTimeout(revealTimerRef.current);
          revealTimerRef.current = setTimeout(() => setIsVideoVisible(true), 4500);
        }
      } catch {
        // ignore
      }
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [active]);

  const handleIframeLoad = () => {
    try {
      iframeRef.current?.contentWindow?.postMessage(
        JSON.stringify({ event: 'listening', id: 1, channel: 'widget' }),
        '*',
      );
    } catch {
      // ignore
    }
    sendYtCommand('unMute');
    sendYtCommand('setVolume', [100]);
    // Fallback reveal after YouTube's initial title/pause button disappears (~5.2s)
    if (revealTimerRef.current) clearTimeout(revealTimerRef.current);
    revealTimerRef.current = setTimeout(() => setIsVideoVisible(true), 5200);
  };

  if (!active) return null;

  const ytKey = info?.youtubeKey;
  if (!ytKey) return null;

  return (
    <div className="absolute inset-0 z-[5] rounded-xl overflow-hidden pointer-events-none bg-black">
      {/* Keep iframe at opacity-100 so Chromium never throttles cross-origin video rendering */}
      <div className="absolute inset-0 bg-black">
        <iframe
          ref={iframeRef}
          onLoad={handleIframeLoad}
          src={`https://www.youtube-nocookie.com/embed/${ytKey}?autoplay=1&mute=0&controls=0&disablekb=1&fs=0&iv_load_policy=3&modestbranding=1&rel=0&playsinline=1&showinfo=0&loop=1&playlist=${ytKey}&enablejsapi=1`}
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
