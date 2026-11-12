import axios from 'axios';
import { getTmdbLanguage } from '../i18n';

const TMDB_API_KEY = import.meta.env.VITE_TMDB_API_KEY || '';

export interface CatalogMediaItem {
  id: number;
  title?: string;
  name?: string;
  poster_path: string;
  backdrop_path: string;
  overview: string;
  vote_average: number;
  release_date?: string;
  first_air_date?: string;
  media_type: 'movie' | 'tv';
  genre_ids?: number[];
}

export interface CatalogRowRecipe {
  id: string;
  title: string;
  mediaType: 'movie' | 'tv';
  params: Record<string, string | number | boolean>;
  /** Niche regions (e.g. NG) often lack translated overviews on TMDB FR */
  relaxedFilter?: boolean;
}

export interface InfiniteCatalogRow {
  id: string;
  recipe: CatalogRowRecipe;
  title: string;
  items: CatalogMediaItem[];
  nextPage: number;
  hasMore: boolean;
  isLoadingMore?: boolean;
}

const CULTURAL_MOVIE_RECIPES: CatalogRowRecipe[] = [
  {
    id: 'kr-movies',
    title: '🇰🇷 Films Coréens',
    mediaType: 'movie',
    params: { with_origin_country: 'KR', sort_by: 'popularity.desc' },
  },
  {
    id: 'in-movies',
    title: '🇮🇳 Cinéma Indien & Bollywood',
    mediaType: 'movie',
    params: { with_origin_country: 'IN', sort_by: 'popularity.desc' },
  },
  {
    id: 'ng-movies',
    title: '🇳🇬 Cinéma Nollywood',
    mediaType: 'movie',
    params: { with_origin_country: 'NG', sort_by: 'popularity.desc' },
    relaxedFilter: true,
  },
];

const CULTURAL_TV_RECIPES: CatalogRowRecipe[] = [
  {
    id: 'kr-tv',
    title: '🇰🇷 K-Drama & Séries Coréennes',
    mediaType: 'tv',
    params: { with_origin_country: 'KR', sort_by: 'popularity.desc' },
  },
  {
    id: 'in-tv',
    title: '🇮🇳 Séries Indiennes',
    mediaType: 'tv',
    params: { with_origin_country: 'IN', sort_by: 'popularity.desc' },
    relaxedFilter: true,
  },
  {
    id: 'ng-tv',
    title: '🇳🇬 Séries Nollywood',
    mediaType: 'tv',
    params: { with_origin_country: 'NG', sort_by: 'popularity.desc' },
    relaxedFilter: true,
  },
];

export const MOVIE_ROW_RECIPES: CatalogRowRecipe[] = [
  ...CULTURAL_MOVIE_RECIPES,
  { id: 'kr-thrillers', title: '🇰🇷 Thrillers & Polars Coréens', mediaType: 'movie', params: { with_origin_country: 'KR', with_genres: '53|80', sort_by: 'popularity.desc' } },
  { id: 'fr-movies', title: '🇫🇷 Cinéma Français', mediaType: 'movie', params: { with_origin_country: 'FR', sort_by: 'popularity.desc' } },
  { id: 'jp-movies', title: '🇯🇵 Cinéma Japonais', mediaType: 'movie', params: { with_origin_country: 'JP', sort_by: 'popularity.desc' } },
  { id: 'movie-scifi', title: '🚀 Science-Fiction & Cyberpunk', mediaType: 'movie', params: { with_genres: '878', sort_by: 'popularity.desc' } },
  { id: 'movie-horror', title: '👻 Horreur & Épouvante', mediaType: 'movie', params: { with_genres: '27', sort_by: 'popularity.desc' } },
  { id: 'movie-romance', title: '💘 Romance', mediaType: 'movie', params: { with_genres: '10749', sort_by: 'popularity.desc' } },
  { id: 'movie-fantasy', title: '✨ Fantastique & Magie', mediaType: 'movie', params: { with_genres: '14', sort_by: 'popularity.desc' } },
  { id: 'movie-mystery', title: '🕵️ Mystère & Enquêtes', mediaType: 'movie', params: { with_genres: '9648', sort_by: 'popularity.desc' } },
  { id: 'movie-war-history', title: '⚔️ Histoire & Guerre', mediaType: 'movie', params: { with_genres: '36|10752', sort_by: 'popularity.desc' } },
  { id: 'movie-doc', title: '🎥 Documentaires', mediaType: 'movie', params: { with_genres: '99', sort_by: 'popularity.desc' } },
  { id: 'movie-western', title: '🤠 Westerns', mediaType: 'movie', params: { with_genres: '37', sort_by: 'popularity.desc' } },
  { id: 'movie-90s', title: '📼 Classiques des Années 90', mediaType: 'movie', params: { 'primary_release_date.gte': '1990-01-01', 'primary_release_date.lte': '1999-12-31', sort_by: 'popularity.desc', 'vote_count.gte': 300 } },
  { id: 'movie-2000s', title: '📀 Pépites des Années 2000', mediaType: 'movie', params: { 'primary_release_date.gte': '2000-01-01', 'primary_release_date.lte': '2009-12-31', sort_by: 'popularity.desc', 'vote_count.gte': 300 } },
  { id: 'movie-toprated', title: '🏆 Chefs-d’œuvre Mieux Notés', mediaType: 'movie', params: { sort_by: 'vote_average.desc', 'vote_count.gte': 1500 } },
  { id: 'in-romance', title: '🇮🇳 Romances Bollywood', mediaType: 'movie', params: { with_origin_country: 'IN', with_genres: '10749', sort_by: 'popularity.desc' } },
  { id: 'movie-blockbusters', title: '💥 Plus Gros Succès Box-Office', mediaType: 'movie', params: { sort_by: 'revenue.desc' } },
];

export const TV_ROW_RECIPES: CatalogRowRecipe[] = [
  ...CULTURAL_TV_RECIPES,
  { id: 'tr-tv', title: '🇹🇷 Séries Turques (T-Drama)', mediaType: 'tv', params: { with_origin_country: 'TR', sort_by: 'popularity.desc' } },
  { id: 'jp-tv', title: '🇯🇵 J-Drama & Séries Japonaises', mediaType: 'tv', params: { with_origin_country: 'JP', sort_by: 'popularity.desc' } },
  { id: 'gb-tv', title: '🇬🇧 Séries Britanniques', mediaType: 'tv', params: { with_origin_country: 'GB', sort_by: 'popularity.desc' } },
  { id: 'es-tv', title: '🇪🇸 Séries Espagnoles', mediaType: 'tv', params: { with_origin_country: 'ES', sort_by: 'popularity.desc' } },
  { id: 'fr-tv', title: '🇫🇷 Séries Françaises', mediaType: 'tv', params: { with_origin_country: 'FR', sort_by: 'popularity.desc' } },
  { id: 'cn-tv', title: '🇨🇳 C-Drama & Séries Chinoises', mediaType: 'tv', params: { with_origin_country: 'CN', sort_by: 'popularity.desc' } },
  { id: 'tv-animation', title: '🎌 Séries d’Animation', mediaType: 'tv', params: { with_genres: '16', sort_by: 'popularity.desc' } },
  { id: 'tv-family', title: '👨‍👩‍👧‍👦 Séries Familiales', mediaType: 'tv', params: { with_genres: '10751', sort_by: 'popularity.desc' } },
  { id: 'tv-war-politics', title: '🏛️ Drames Politiques & Guerre', mediaType: 'tv', params: { with_genres: '10768', sort_by: 'popularity.desc' } },
  { id: 'tv-toprated', title: '🏆 Séries les Mieux Notées', mediaType: 'tv', params: { sort_by: 'vote_average.desc', 'vote_count.gte': 800 } },
  { id: 'kr-romance-tv', title: '🇰🇷 Romances Coréennes', mediaType: 'tv', params: { with_origin_country: 'KR', with_genres: '18|10749', sort_by: 'popularity.desc' }, relaxedFilter: true },
  { id: 'tv-90s-2000s', title: '📺 Séries Cultes (1995–2010)', mediaType: 'tv', params: { 'first_air_date.gte': '1995-01-01', 'first_air_date.lte': '2010-12-31', sort_by: 'popularity.desc', 'vote_count.gte': 200 } },
];

export const HOME_ROW_RECIPES: CatalogRowRecipe[] = [
  CULTURAL_MOVIE_RECIPES[0], // Films Coréens
  CULTURAL_TV_RECIPES[0],    // K-Drama
  CULTURAL_MOVIE_RECIPES[1], // Cinéma Indien & Bollywood
  CULTURAL_TV_RECIPES[1],    // Séries Indiennes
  CULTURAL_MOVIE_RECIPES[2], // Cinéma Nollywood
  CULTURAL_TV_RECIPES[2],    // Séries Nollywood
  MOVIE_ROW_RECIPES[3],      // Thrillers Coréens
  TV_ROW_RECIPES[3],         // Séries Turques
  MOVIE_ROW_RECIPES[6],      // Sci-Fi
  TV_ROW_RECIPES[4],         // J-Drama
  MOVIE_ROW_RECIPES[7],      // Horreur
  TV_ROW_RECIPES[5],         // Séries Britanniques
  MOVIE_ROW_RECIPES[8],      // Romance
  MOVIE_ROW_RECIPES[4],      // Cinéma Français
  TV_ROW_RECIPES[6],         // Séries Espagnoles
  MOVIE_ROW_RECIPES[10],     // Mystère
  TV_ROW_RECIPES[12],        // Séries mieux notées
  MOVIE_ROW_RECIPES[14],     // Années 90
  MOVIE_ROW_RECIPES[16],     // Chefs-d'oeuvre
  MOVIE_ROW_RECIPES[18],     // Box-office
  TV_ROW_RECIPES[8],         // C-Drama
  MOVIE_ROW_RECIPES[12],     // Documentaires
  MOVIE_ROW_RECIPES[15],     // Années 2000
];

const normalizeCatalogItem = (raw: any, mediaType: 'movie' | 'tv'): CatalogMediaItem => ({
  ...raw,
  media_type: mediaType,
  poster_path: raw.poster_path || '',
  backdrop_path: raw.backdrop_path || '',
  overview: raw.overview || '',
  vote_average: typeof raw.vote_average === 'number' ? raw.vote_average : 0,
});

export async function fetchCatalogPage(
  recipe: CatalogRowRecipe,
  page: number,
  language: string = getTmdbLanguage(),
): Promise<{ items: CatalogMediaItem[]; totalPages: number }> {
  if (!TMDB_API_KEY) return { items: [], totalPages: 1 };
  const endpoint = `https://api.themoviedb.org/3/discover/${recipe.mediaType}`;
  const res = await axios.get(endpoint, {
    params: {
      api_key: TMDB_API_KEY,
      language,
      include_adult: false,
      page,
      ...recipe.params,
    },
  });

  const results: any[] = Array.isArray(res.data?.results) ? res.data.results : [];
  const totalPages: number = Math.min(Number(res.data?.total_pages) || 1, 500);
  const items = results
    .filter((item) => Boolean(item?.poster_path) && (recipe.relaxedFilter || Boolean(item?.overview && String(item.overview).trim() !== '')))
    .map((item) => normalizeCatalogItem(item, recipe.mediaType));

  return { items, totalPages };
}

/**
 * Fetches the next batch of vertical carousel rows. When `cursor` wraps past
 * `recipes.length`, it increments the starting TMDB `page` so scrolling down
 * continues surfacing deeper pages endlessly instead of stopping or repeating page 1.
 */
export async function fetchInfiniteCatalogBatch(
  recipes: CatalogRowRecipe[],
  cursor: number,
  batchSize: number,
): Promise<{ rows: InfiniteCatalogRow[]; nextCursor: number }> {
  const lang = getTmdbLanguage();
  const tasks: Array<Promise<InfiniteCatalogRow | null>> = [];

  for (let i = 0; i < batchSize; i++) {
    const absIdx = cursor + i;
    const recipe = recipes[absIdx % recipes.length];
    const cycle = Math.floor(absIdx / recipes.length);
    const startPage = cycle + 1;
    const rowId = cycle === 0 ? recipe.id : `${recipe.id}-cycle-${cycle}`;
    const displayTitle = cycle === 0 ? recipe.title : `${recipe.title} · Découverte ${cycle + 1}`;

    tasks.push(
      fetchCatalogPage(recipe, startPage, lang)
        .then(({ items, totalPages }) => {
          if (items.length < 3) return null;
          return {
            id: rowId,
            recipe,
            title: displayTitle,
            items,
            nextPage: startPage + 1,
            hasMore: startPage < totalPages,
            isLoadingMore: false,
          } satisfies InfiniteCatalogRow;
        })
        .catch(() => null),
    );
  }

  const settled = await Promise.all(tasks);
  return {
    rows: settled.filter((r): r is InfiniteCatalogRow => r !== null),
    nextCursor: cursor + batchSize,
  };
}
