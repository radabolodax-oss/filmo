import axios from 'axios';
import { buildProxyUrl } from '../config/runtime';

export const FREMBED_BASE = 'https://frembed.uno';

interface Provider {
  id: string;
  name: string;
  checkUrl: string;
}

const PROVIDERS = {
  FREMBED: {
    id: 'frembed',
    name: 'Frembed',
    checkUrl: `${FREMBED_BASE}/api/public/v1`
  },
  STREAMTAPE: {
    id: 'streamtape',
    name: 'Streamtape',
    checkUrl: 'https://api.streamtape.com'
  }
};

export function isFrembedResultAvailable(data: any): boolean {
  if (!data || data.status !== 200) return false;
  const r = data.result;
  if (!r || typeof r !== 'object') return false;
  const count = r.totalItems ?? r.total ?? (Array.isArray(r.items) ? r.items.length : 0);
  return Number(count) > 0;
}

export async function resolveFrembedPlayerUrl(
  tmdbId: string,
  mediaType: 'movie' | 'tv',
  season?: number | string,
  episode?: number | string
): Promise<string> {
  const qs = mediaType === 'tv' && season != null && episode != null ? `?sa=${season}&epi=${episode}` : '';
  const fallback =
    mediaType === 'movie'
      ? `${FREMBED_BASE}/embed/movie/${tmdbId}`
      : `${FREMBED_BASE}/embed/serie/${tmdbId}${qs}`;
  try {
    const apiPath =
      mediaType === 'movie'
        ? `/api/frembed/movie/${tmdbId}`
        : `/api/frembed/tv/${tmdbId}${qs}`;
    const res = await axios.get(buildProxyUrl(apiPath), { timeout: 5500 });
    const resolved = res?.data?.embedUrl;
    if (typeof resolved === 'string' && resolved.startsWith('http')) {
      return resolved;
    }
  } catch {}
  return fallback;
}

export const checkContentAvailability = async (contentId: number, mediaType: 'movie' | 'tv') => {
  const availabilityChecks = await Promise.allSettled([
    checkFrembedAvailability(contentId, mediaType),
    checkStreamtapeAvailability(contentId, mediaType)
  ]);

  return availabilityChecks.reduce((acc, result, index) => {
    const providerName = Object.values(PROVIDERS)[index].name;
    if (result.status === 'fulfilled') {
      acc[providerName] = result.value;
    } else {
      acc[providerName] = false;
    }
    return acc;
  }, {} as Record<string, boolean>);
};

const checkFrembedAvailability = async (contentId: number, mediaType: 'movie' | 'tv') => {
  try {
    const endpoint = mediaType === 'movie'
      ? `${PROVIDERS.FREMBED.checkUrl}/movies/${contentId}`
      : `${PROVIDERS.FREMBED.checkUrl}/tv/${contentId}`;

    const response = await axios.get(endpoint, { timeout: 3500 });
    return isFrembedResultAvailable(response.data);
  } catch (error) {
    console.error(`Error checking Frembed availability:`, error);
    return false;
  }
};

const checkStreamtapeAvailability = async (contentId: number, mediaType: 'movie' | 'tv') => {
  try {
    const endpoint = `${PROVIDERS.STREAMTAPE.checkUrl}/check/${mediaType}/${contentId}`;
    const response = await axios.get(endpoint);
    return response.data.available;
  } catch (error) {
    console.error(`Error checking Streamtape availability:`, error);
    return false;
  }
};
