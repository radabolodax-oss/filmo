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
  active: boolean;
}

export const CardTrailerPreview: React.FC<CardTrailerPreviewProps> = ({
  mediaId,
  mediaType,
  overview: initialOverview,
  active,
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
      if (!cancelled) setInfo(res);
    });
    return () => {
      cancelled = true;
      if (revealTimerRef.current) clearTimeout(revealTimerRef.current);
    };
  }, [active, mediaType, mediaId, initialOverview]);

  const sendYtCommand = (func: string, args: any[] = []) => {
    try {
      iframeRef.current?.contentWindow?.postMessage(
        JSON.stringify({ event: 'command', func, args }),
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
        // PlayerState 1 = playing -> wait slightly so pause icon/title fades out, then show
        if (data?.event === 'onStateChange' && data?.info === 1) {
          sendYtCommand('unMute');
          sendYtCommand('setVolume', [100]);
          if (revealTimerRef.current) clearTimeout(revealTimerRef.current);
          revealTimerRef.current = setTimeout(() => setIsVideoVisible(true), 800);
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
        JSON.stringify({ event: 'listening' }),
        '*',
      );
    } catch {
      // ignore
    }
    sendYtCommand('unMute');
    sendYtCommand('setVolume', [100]);
    sendYtCommand('playVideo');
    setTimeout(() => {
      sendYtCommand('unMute');
      sendYtCommand('setVolume', [100]);
    }, 350);
    // Fallback reveal after YouTube's initial title/pause button disappears (~1.4s)
    if (revealTimerRef.current) clearTimeout(revealTimerRef.current);
    revealTimerRef.current = setTimeout(() => setIsVideoVisible(true), 1400);
  };

  if (!active) return null;

  const ytKey = info?.youtubeKey;
  const synopsisText = initialOverview || info?.overview || '';

  return (
    <div className="absolute inset-0 z-20 overflow-hidden pointer-events-none">
      {ytKey && (
        <div
          className={`absolute inset-0 bg-black transition-opacity duration-500 ${
            isVideoVisible ? 'opacity-100' : 'opacity-0'
          }`}
        >
          <iframe
            ref={iframeRef}
            onLoad={handleIframeLoad}
            src={`https://www.youtube-nocookie.com/embed/${ytKey}?autoplay=1&mute=0&controls=0&disablekb=1&fs=0&iv_load_policy=3&modestbranding=1&rel=0&playsinline=1&showinfo=0&loop=1&playlist=${ytKey}&enablejsapi=1`}
            title="Trailer preview"
            allow="autoplay; encrypted-media"
            className="w-full h-full border-0 scale-[1.65] pointer-events-none"
          />
        </div>
      )}
      {synopsisText && (
        <div className="relative z-10 h-full flex flex-col justify-end">
          <div className="p-2.5 pt-8 bg-gradient-to-t from-black/95 via-black/70 to-transparent">
            <p className="line-clamp-3 text-[9.5px] sm:text-[10.5px] leading-snug text-white/95 drop-shadow">
              {synopsisText}
            </p>
          </div>
        </div>
      )}
    </div>
  );
};
