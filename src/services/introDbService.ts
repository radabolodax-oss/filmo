/**
 * TheIntroDB API Service (v4)
 * Provides automatic intro and credits timestamps for movies and TV episodes.
 * API Endpoint: https://api.theintrodb.org/v4/media
 */

export interface SegmentTimestamp {
  start: number; // in seconds
  end: number;   // in seconds
}

export interface MediaTimestamps {
  intro: SegmentTimestamp | null;
  credits: SegmentTimestamp | null;
  recap: SegmentTimestamp | null;
}

const memoryCache = new Map<string, MediaTimestamps | null>();
const THE_INTRO_DB_API = 'https://api.theintrodb.org/v4/media';

interface FetchTimestampsParams {
  tmdbId: number;
  season?: number;
  episode?: number;
}

export async function fetchIntroTimestamps({
  tmdbId,
  season,
  episode,
}: FetchTimestampsParams): Promise<MediaTimestamps | null> {
  if (!tmdbId || isNaN(tmdbId)) return null;

  const isTv = season !== undefined && episode !== undefined;
  const cacheKey = isTv
    ? `introdb_tv_${tmdbId}_s${season}_e${episode}`
    : `introdb_movie_${tmdbId}`;

  // 1. Check in-memory cache
  if (memoryCache.has(cacheKey)) {
    return memoryCache.get(cacheKey) || null;
  }

  // 2. Check sessionStorage
  try {
    const sessionData = sessionStorage.getItem(cacheKey);
    if (sessionData) {
      const parsed = JSON.parse(sessionData) as MediaTimestamps | null;
      memoryCache.set(cacheKey, parsed);
      return parsed;
    }
  } catch {
    // sessionStorage not accessible or disabled
  }

  // 3. Construct URL
  const params = new URLSearchParams();
  params.set('tmdb_id', tmdbId.toString());
  if (isTv) {
    params.set('season', season.toString());
    params.set('episode', episode.toString());
  }

  const url = `${THE_INTRO_DB_API}?${params.toString()}`;

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 4000);

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
      },
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      // 404 means no timestamps submitted yet
      memoryCache.set(cacheKey, null);
      try {
        sessionStorage.setItem(cacheKey, JSON.stringify(null));
      } catch { /* ignore */ }
      return null;
    }

    const data = await response.json();

    const result: MediaTimestamps = {
      intro: null,
      credits: null,
      recap: null,
    };

    if (Array.isArray(data.intro) && data.intro.length > 0) {
      const first = data.intro[0];
      const start = typeof first.start_ms === 'number' ? first.start_ms / 1000 : 0;
      const end = typeof first.end_ms === 'number' ? first.end_ms / 1000 : 0;
      if (end > start) {
        result.intro = { start, end };
      }
    }

    if (Array.isArray(data.credits) && data.credits.length > 0) {
      const first = data.credits[0];
      const start = typeof first.start_ms === 'number' ? first.start_ms / 1000 : 0;
      const end = typeof first.end_ms === 'number' ? first.end_ms / 1000 : start + 300;
      if (start > 0) {
        result.credits = { start, end };
      }
    }

    if (Array.isArray(data.recap) && data.recap.length > 0) {
      const first = data.recap[0];
      const start = typeof first.start_ms === 'number' ? first.start_ms / 1000 : 0;
      const end = typeof first.end_ms === 'number' ? first.end_ms / 1000 : 0;
      if (end > start) {
        result.recap = { start, end };
      }
    }

    memoryCache.set(cacheKey, result);
    try {
      sessionStorage.setItem(cacheKey, JSON.stringify(result));
    } catch { /* ignore */ }

    return result;
  } catch {
    // Network failure or timeout
    return null;
  }
}
