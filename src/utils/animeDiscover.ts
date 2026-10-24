import axios from 'axios';

const TMDB_API_KEY = import.meta.env.VITE_TMDB_API_KEY || '';

/**
 * Mots-clés TMDB qui identifient un anime / donghua (animation chinoise) /
 * animation coréenne. Combinés avec un OU ("|") dans une seule requête.
 */
const ANIME_KEYWORD_IDS = [210024, 315535, 369963, 287501];

/**
 * Langues d'origine dont l'animation est considérée comme "anime" : japonais,
 * chinois (donghua), coréen. TMDB n'accepte qu'une langue par requête, donc
 * une requête par langue.
 */
const ANIME_ORIGINAL_LANGUAGES = ['ja', 'zh', 'ko'];

export type AnimeMediaType = 'tv' | 'movie';

type DiscoverParams = Record<string, string | number | boolean>;

export interface AnimeDiscoverResult {
  results: any[];
  total_pages: number;
}

const getSortValue = (item: any, sortBy: string): number | string => {
  const field = sortBy.split('.')[0];
  if (field === 'release_date' || field === 'first_air_date') {
    const date = item.release_date || item.first_air_date || '';
    const ts = new Date(date).getTime();
    return Number.isNaN(ts) ? 0 : ts;
  }
  if (field === 'vote_average') return item.vote_average ?? 0;
  return item.popularity ?? 0;
};

/**
 * Découverte "anime" complète : animation (genre 16) dont soit un mot-clé
 * anime/donghua, soit la langue d'origine est ja/zh/ko. Les résultats des
 * différentes requêtes sont fusionnés (dédoublonnés par id), triés, et
 * étiquetés avec `media_type`.
 *
 * Le paramètre `with_keywords` éventuellement présent dans `params` est ignoré.
 */
export const discoverAnime = async (
  mediaType: AnimeMediaType,
  params: DiscoverParams,
): Promise<AnimeDiscoverResult> => {
  const { with_keywords: _ignored, ...baseParams } = params;
  void _ignored;
  const sortBy = String(baseParams.sort_by || 'popularity.desc');
  const url = `https://api.themoviedb.org/3/discover/${mediaType}`;

  const variants: DiscoverParams[] = [
    { with_keywords: ANIME_KEYWORD_IDS.join('|') },
    ...ANIME_ORIGINAL_LANGUAGES.map((lang) => ({ with_original_language: lang })),
  ];

  const responses = await Promise.all(
    variants.map((variant) =>
      axios
        .get(url, { params: { api_key: TMDB_API_KEY, ...baseParams, ...variant } })
        .then((response) => response.data)
        .catch(() => null),
    ),
  );

  const valid = responses.filter(Boolean);
  if (valid.length === 0) {
    throw new Error('discoverAnime: all requests failed');
  }

  const seen = new Set<number>();
  const merged: any[] = [];
  for (const data of valid) {
    for (const item of data.results || []) {
      if (item?.id && !seen.has(item.id)) {
        seen.add(item.id);
        merged.push({ ...item, media_type: mediaType });
      }
    }
  }

  const direction = sortBy.endsWith('.asc') ? 1 : -1;
  merged.sort((a, b) => {
    const left = getSortValue(a, sortBy);
    const right = getSortValue(b, sortBy);
    return left < right ? -direction : left > right ? direction : 0;
  });

  return {
    results: merged,
    total_pages: Math.max(...valid.map((data) => data.total_pages || 1)),
  };
};

/** Correspondance genre TV -> genre film pour la catégorie anime. */
export const TV_TO_MOVIE_GENRE: Record<string, string> = {
  '10759': '28',
  '10765': '878',
  '10762': '10751',
};
