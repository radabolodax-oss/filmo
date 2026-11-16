import React, { useEffect, useState } from 'react';
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

  try {
    const lang = getTmdbLanguage();
    const res = await axios.get(`${TMDB_API_URL}/${mediaType}/${mediaId}/videos`, {
      params: { api_key: TMDB_API_KEY, language: lang },
      timeout: 5000,
    });
    let results: any[] = res.data?.results || [];

    if (!results.some((v) => v.site === 'YouTube' && v.type === 'Trailer')) {
      const enRes = await axios.get(`${TMDB_API_URL}/${mediaType}/${mediaId}/videos`, {
        params: { api_key: TMDB_API_KEY, language: 'en-US' },
        timeout: 5000,
      });
      const enResults: any[] = enRes.data?.results || [];
      results = [...results, ...enResults];
    }

    const pick =
      results.find((v) => v.site === 'YouTube' && v.type === 'Trailer' && v.official) ||
      results.find((v) => v.site === 'YouTube' && v.type === 'Trailer') ||
      results.find((v) => v.site === 'YouTube' && v.type === 'Teaser') ||
      results.find((v) => v.site === 'YouTube');

    if (pick?.key) {
      youtubeKey = pick.key;
    }
  } catch {
    // ignore
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
  trailerCache.set(cacheKey, info);
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

  useEffect(() => {
    if (!active) return;
    let cancelled = false;
    fetchTrailerAndOverview(mediaType, mediaId, initialOverview).then((res) => {
      if (!cancelled) setInfo(res);
    });
    return () => {
      cancelled = true;
    };
  }, [active, mediaType, mediaId, initialOverview]);

  if (!active) return null;

  const ytKey = info?.youtubeKey;
  const synopsisText = initialOverview || info?.overview || '';

  return (
    <div className="absolute inset-0 z-20 bg-black overflow-hidden pointer-events-none">
      {ytKey && (
        <iframe
          src={`https://www.youtube.com/embed/${ytKey}?autoplay=1&mute=0&controls=0&modestbranding=1&rel=0&playsinline=1&loop=1&playlist=${ytKey}`}
          title="Trailer preview"
          allow="autoplay; encrypted-media"
          className="w-full h-full border-0 scale-[1.35] pointer-events-none"
        />
      )}
      {synopsisText && (
        <div className="absolute inset-x-0 bottom-0 p-2.5 pt-8 bg-gradient-to-t from-black via-black/85 to-transparent">
          <p className="text-[11px] leading-snug text-white/90 line-clamp-4 drop-shadow">
            {synopsisText}
          </p>
        </div>
      )}
    </div>
  );
};
