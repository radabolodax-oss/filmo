import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { GLASS_BTN_STYLE } from '../../utils/glassStyles';
import { Play } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import axios from 'axios';
import { motion, AnimatePresence } from 'framer-motion';
import useWatchStatus from '../../hooks/useWatchStatus';
import { searchWithFallback, getSearchNameForId, getAnimeMatcherForId, getAnimeMatchTerms } from '../../utils/searchUtils';
import { encodeId } from '../../utils/idEncoder';
import HLSPlayer from '../../components/HLSPlayer';
import { useAdFreePopup } from '../../context/AdFreePopupContext';
import AdFreePlayerAds from '../../components/AdFreePlayerAds';
import {
  extractVidmolyM3u8, extractSibnetM3u8, extractOneUploadSources,
  extractVoeM3u8, extractUqloadFile, extractVidzyM3u8, extractFsvidM3u8,
  extractDoodStreamFile, extractSeekStreamingM3u8, extractDarkiboxSources,
  isVoeEmbed, isDoodStreamEmbed, isSeekStreamingEmbed,
} from '../../utils/extractM3u8';
import { pickAutoSelectedLanguage, sortHostersByPriority } from '../../utils/sourceAutoSelect';
import { getRememberLastPlayer } from '../../utils/lastPlayerPref';
import { detectHoster } from '../../utils/hosterRegistry';
import {
  getSourcePriorityPrefs,
  subscribeToPriorityChanges,
  pinLanguage,
  unpinLanguage,
} from '../../utils/sourcePriorityPrefs';
import { PinButton } from '../../components/ui/PinButton';
import { useWrappedTracker } from '../../hooks/useWrappedTracker';
import { getTmdbLanguage } from '../../i18n';
import { isContentAllowed, getClassificationLabel } from '../../utils/certificationUtils';

const MAIN_API = import.meta.env.VITE_MAIN_API;
const TMDB_API_KEY = import.meta.env.VITE_TMDB_API_KEY || '';

// Interfaces
interface AnimeShow {
  name: string;
  overview: string;
  poster_path: string;
  first_air_date: string;
  vote_average: number;
  genres: { id: number; name: string }[];
  episode_run_time?: number[];
  backdrop_path?: string;
}

interface EpisodeDetails {
  name: string;
  overview: string;
  air_date: string;
  still_path?: string | null;
  vote_average: number;
  episode_number: number;
  season_number: number;
}

interface AnimeEpisode {
  name: string;
  serie_name: string;
  season_name: string;
  index: number;
  streaming_links: Array<{
    language: string;
    players: string[];
  }>;
}

interface AnimeSeason {
  name: string;
  serie_name: string;
  url: string;
  episodes: AnimeEpisode[];
}

interface AnimeData {
  name: string;
  url: string;
  seasons: AnimeSeason[];
}

interface VideoSource {
  language: string;
  quality: string;
  url: string;
  player: string;
  label: string;
  isM3u8?: boolean;
  id?: string; // Unique identifier for comparison
}

// Empêche une extraction bloquée côté backend (proxy indisponible/lent) de figer
// tout le pipeline : au-delà du délai, on traite l'extraction comme un échec et
// on passe à la source suivante au lieu de rester en "Chargement de l'épisode..." infini.
const EXTRACTION_TIMEOUT_MS = 5000;
function withTimeout<T>(promise: Promise<T>, ms: number = EXTRACTION_TIMEOUT_MS): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => {
      setTimeout(() => reject(new Error(`Extraction timed out after ${ms}ms`)), ms);
    }),
  ]);
}

interface ContinueWatchingTvEntry {
  id: number;
  currentEpisode?: {
    season: number;
    episode: number;
  };
  lastAccessed?: string;
  [key: string]: unknown;
}

interface ContinueWatchingStore {
  movies: unknown[];
  tv: ContinueWatchingTvEntry[];
}


/**
 * Calculates similarity between two titles to avoid false positives in anime matching
 * @param title1 First title
 * @param title2 Second title
 * @returns Similarity score between 0 and 1
 */
const calculateTitleSimilarity = (title1: string, title2: string): number => {
  if (!title1 || !title2) return 0;

  const t1 = title1.toLowerCase();
  const t2 = title2.toLowerCase();

  // Normalize titles (remove accents, etc.)
  const normalize = (str: string) => str.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const norm1 = normalize(t1);
  const norm2 = normalize(t2);

  // Exact match gets highest priority
  if (norm1 === norm2) {
    return 1.0;
  }

  // Check for inclusion (one title contains the other)
  if (norm2.includes(norm1) || norm1.includes(norm2)) {
    if (norm1.length < norm2.length && norm2.includes(norm1)) {
      const lengthRatio = norm1.length / norm2.length;
      return 0.9 * lengthRatio;
    } else if (norm2.length < norm1.length && norm1.includes(norm2)) {
      const lengthRatio = norm2.length / norm1.length;
      return 0.85 * lengthRatio;
    }
    return 0.8; // Score for partial inclusion
  }

  // Split into words and filter short words (articles, etc.)
  const filterShortWords = (words: string[]) => words.filter(w => w.length > 3);
  const words1 = filterShortWords(norm1.split(/\s+/));
  const words2 = filterShortWords(norm2.split(/\s+/));

  // If no significant words, use original words
  const finalWords1 = words1.length ? words1 : norm1.split(/\s+/);
  const finalWords2 = words2.length ? words2 : norm2.split(/\s+/);

  // Calculate percentage of matching words with higher weight for order
  let matches = 0;
  let orderBonus = 0;

  finalWords1.forEach((word, index) => {
    const matchIndex = finalWords2.findIndex(w => w === word);
    if (matchIndex !== -1) {
      matches++;
      // Bonus for words in similar positions
      if (Math.abs(index - matchIndex) <= 1) {
        orderBonus += 0.1;
      }
    }
  });

  const wordSimilarity = matches / Math.max(finalWords1.length, finalWords2.length);
  const totalSimilarity = wordSimilarity + orderBonus;

  return Math.min(totalSimilarity, 1.0);
};

interface WatchAnimeProps {
  id: string | null;
  initialSeason: string;
  initialEpisode: string;
  headerTitle?: string;
  headerYear?: number;
  headerVoteAverage?: number;
  headerCertification?: string;
  headerSeasonsCount?: number;
  recommendations?: any[];
  // Appelé quand aucun provider anime (AnimeSama/AniCloud/FrAnime) n'a trouvé ce titre —
  // le parent (WatchTv/WatchMovie) retombe alors sur le lecteur classique (FStream,
  // Wiflix, etc.) au lieu d'afficher un écran d'erreur avec des embeds tiers (Videasy/Peachify).
  onNoSourceFallback?: () => void;
  // Film d'animation (invoqué depuis WatchMovie) plutôt qu'une série — pas de navigation
  // saison/épisode, la saison "Film" du catalogue AnimeSama est résolue automatiquement.
  isMovieMode?: boolean;
}

const WatchAnime: React.FC<WatchAnimeProps> = ({
  id, initialSeason, initialEpisode,
  headerTitle, headerYear, headerVoteAverage, headerCertification, headerSeasonsCount,
  recommendations = [],
  onNoSourceFallback,
  isMovieMode = false,
}) => {
  // Saison/épisode ne viennent plus de l'URL (rendu comme sous-composant de WatchTv,
  // route unique /tv/:id) — state interne, mis à jour par les handlers de navigation
  // d'épisode au lieu d'un rechargement complet de page.
  const [season, setSeason] = useState(initialSeason);
  const [episode, setEpisode] = useState(initialEpisode);
  const navigate = useNavigate();
  const { t } = useTranslation();
  // Compte/profils supprimés — plus de restriction d'âge par profil (toujours 0).
  const currentProfile: { ageRestriction: number } | null = null;
  const playerRef = useRef<HTMLDivElement>(null);
  // Clé de l'épisode le plus récemment demandé (id-saison-episode). processVideoSources
  // est asynchrone (extraction Vidmoly/Sibnet/etc, plusieurs secondes) ; si l'utilisateur
  // clique "épisode suivant" avant la fin de l'extraction en cours, une extraction pour
  // un épisode déjà quitté peut se terminer APRÈS celle du nouvel épisode et écraser
  // videoSources avec des données obsolètes — l'épisode suivant semble alors "bloqué".
  const currentRequestKeyRef = useRef<string>('');

  // Basic state
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  // Sources de secours (VOSTFR, iframe direct via TMDB id) proposées quand aucun
  // provider anime dédié (AnimeSama/AniCloud/FrAnime) n'a de lien pour ce titre.
  const [fallbackEmbedSource, setFallbackEmbedSource] = useState<'videasy' | 'peachify' | null>(null);
  const [contentCert, setContentCert] = useState<string>('');
  const [isBlocked, setIsBlocked] = useState(false);
  const [showDetails, setShowDetails] = useState<AnimeShow | null>(null);
  const [episodeDetails] = useState<EpisodeDetails | null>(null);

  // Anime specific state
  const [animeData, setAnimeData] = useState<AnimeData | null>(null);
  const [availableLanguages, setAvailableLanguages] = useState<string[]>([]);
  const [selectedLanguage, setSelectedLanguage] = useState<string>('vostfr'); // Default to VOSTFR
  // Se souvenir du choix manuel de langue/lecteur d'un épisode à l'autre (même anime), si le
  // réglage global "se souvenir du dernier lecteur" est actif.
  const rememberedAnimeLangRef = useRef<string | null>(null);
  const rememberedAnicloudPlayerNameRef = useRef<string | null>(null);

  // Milestone 4 — PinButton cross-UI : reflète l'id épinglé (anime.pinnedLanguage)
  // en live, sync cross-onglets via `subscribeToPriorityChanges` (storage event).
  const [pinnedLang, setPinnedLang] = useState<string | null>(() =>
    getSourcePriorityPrefs().categories.anime.pinnedLanguage?.id ?? null,
  );
  useEffect(
    () => subscribeToPriorityChanges((p) => {
      setPinnedLang(p.categories.anime.pinnedLanguage?.id ?? null);
    }),
    [],
  );

  // Video player state
  const [videoSources, setVideoSources] = useState<VideoSource[]>([]);
  const [selectedSource, setSelectedSource] = useState<VideoSource | null>(null);

  // ——— Fournisseur d'anime actif — Anime-Sama (par défaut, celui déjà porté) plus
  // AniCloud et FRAnime, portés depuis l'ancien TVDetails.tsx (appels directs navigateur,
  // pas via Mainapi pour AniCloud). ———
  const [provider, setProvider] = useState<'animesama' | 'anicloud' | 'franime'>('animesama');

  // AniCloud states
  const [anicloudSlug, setAnicloudSlug] = useState<string | null>(null);
  const [anicloudSections, setAnicloudSections] = useState<any[]>([]);
  const [anicloudPlayers, setAnicloudPlayers] = useState<{ id: number; player_name: string; player_url: string }[]>([]);
  const [anicloudPlayerIdx, setAnicloudPlayerIdx] = useState(0);
  const [anicloudLang, setAnicloudLang] = useState<'vf' | 'vostfr'>('vf');
  const [loadingAnicloud, setLoadingAnicloud] = useState(false);
  const [anicloudError, setAnicloudError] = useState<string | null>(null);

  // FRAnime states
  const [franimeLookup, setFranimeLookup] = useState<{ slug: string; animeId: string; langs: string[] } | null>(null);
  const [franimeLang, setFranimeLang] = useState<string>('vf');
  const [franimeLoading, setFranimeLoading] = useState(false);
  const [franimeError, setFranimeError] = useState<string | null>(null);

  const loadAnicloudEpisode = useCallback(async (lang: 'vf' | 'vostfr' = 'vf') => {
    if (!season || !episode) return;
    setLoadingAnicloud(true);
    setAnicloudError(null);
    setAnicloudPlayers([]);
    try {
      let slug = anicloudSlug;
      if (!slug && showDetails?.name) {
        const searchRes = await axios.get(`https://anicloud.top/api/search?q=${encodeURIComponent(showDetails.name)}`);
        const results: any[] = searchRes.data?.data ?? [];
        const titleLower = showDetails.name.toLowerCase();
        const match = results.find((r: any) => r.name?.toLowerCase() === titleLower) ?? results[0];
        if (!match) { setAnicloudError('Anime non trouvé sur AniCloud'); return; }
        slug = match.slug as string;
        setAnicloudSlug(slug);
      }
      if (!slug) { setAnicloudError('Slug introuvable'); return; }

      let sections = anicloudSections;
      if (!sections.length) {
        const loaderRes = await axios.get(`https://anicloud.top/api/anime-loader?slug=${slug}`);
        sections = loaderRes.data?.sections ?? [];
        setAnicloudSections(sections);
      }

      const mainSection = sections.find((s: any) => s.section_type === 'saison' || s.section_type === 'film') ?? sections[0];
      if (!mainSection) { setAnicloudError('Aucune section disponible'); return; }

      const epsRes = await axios.get(`https://anicloud.top/api/anime-episodes?sectionId=${mainSection.id}`);
      const episodes: any[] = epsRes.data?.episodes ?? [];
      const target = episodes.find((e: any) => e.episode_number === Number(episode) && e.language === lang);
      if (!target) { setAnicloudError(`Épisode ${episode} indisponible en ${lang.toUpperCase()}`); return; }

      const playersRes = await axios.get(`https://anicloud.top/api/anime-players?episodeId=${target.id}`);
      const players = playersRes.data?.players ?? [];
      setAnicloudPlayers(players);
      // Se souvenir du lecteur choisi manuellement sur un épisode précédent du même anime.
      const remembered = getRememberLastPlayer() ? rememberedAnicloudPlayerNameRef.current : null;
      const rememberedIdx = remembered ? players.findIndex((p: any) => p.player_name === remembered) : -1;
      setAnicloudPlayerIdx(rememberedIdx >= 0 ? rememberedIdx : 0);
    } catch {
      setAnicloudError('Erreur lors du chargement AniCloud');
    } finally {
      setLoadingAnicloud(false);
    }
  }, [showDetails?.name, season, episode, anicloudSlug, anicloudSections]);

  // Reset AniCloud slug/sections quand on change d'anime
  useEffect(() => {
    setAnicloudSlug(null);
    setAnicloudSections([]);
    setAnicloudPlayers([]);
    setAnicloudError(null);
  }, [id]);

  // Déclenche le fetch AniCloud quand le fournisseur/l'épisode change
  useEffect(() => {
    if (provider !== 'anicloud') return;
    loadAnicloudEpisode(anicloudLang);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [provider, season, episode, anicloudLang]);

  // Reset FRAnime lookup quand on change d'anime
  useEffect(() => {
    setFranimeLookup(null);
    setFranimeError(null);
  }, [id]);

  // Charge le lookup FRAnime quand le fournisseur est sélectionné
  useEffect(() => {
    if (provider !== 'franime') return;
    if (franimeLookup || franimeLoading) return;
    if (!showDetails?.name) return;
    let cancelled = false;
    setFranimeLoading(true);
    setFranimeError(null);
    axios.get(`${MAIN_API}/api/franime/lookup?q=${encodeURIComponent(showDetails.name)}`)
      .then(res => {
        if (cancelled) return;
        const data = res.data as { slug: string; animeId: string; langs: string[] };
        setFranimeLookup(data);
        if (data.langs?.length) {
          setFranimeLang(data.langs.includes('vf') ? 'vf' : data.langs[0]);
        }
      })
      .catch(() => { if (!cancelled) setFranimeError('Anime non trouvé sur FRAnime'); })
      .finally(() => { if (!cancelled) setFranimeLoading(false); });
    return () => { cancelled = true; };
  }, [provider, showDetails?.name, franimeLookup, franimeLoading]);

  // Loading states for extractions
  const [loadingVidmolyExtraction, setLoadingVidmolyExtraction] = useState<boolean>(false);
  const [loadingSibnetExtraction, setLoadingSibnetExtraction] = useState<boolean>(false);
  const [loadingOneUploadExtraction, setLoadingOneUploadExtraction] = useState<boolean>(false);
  const [loadingVoeExtraction, setLoadingVoeExtraction] = useState<boolean>(false);
  const [loadingUqloadExtraction, setLoadingUqloadExtraction] = useState<boolean>(false);
  const [loadingVidzyExtraction, setLoadingVidzyExtraction] = useState<boolean>(false);
  const [loadingFsvidExtraction, setLoadingFsvidExtraction] = useState<boolean>(false);
  const [loadingDoodStreamExtraction, setLoadingDoodStreamExtraction] = useState<boolean>(false);
  const [loadingSeekStreamingExtraction, setLoadingSeekStreamingExtraction] = useState<boolean>(false);
  const [loadingDarkiboxExtraction, setLoadingDarkiboxExtraction] = useState<boolean>(false);
  const [extractionProgress, setExtractionProgress] = useState<string>('');

  // For HLS player
  const [showHLSPlayer, setShowHLSPlayer] = useState<boolean>(false);
  const [hlsPlayerSrc, setHlsPlayerSrc] = useState<string>('');


  // For iframe embed display
  const [embedUrl, setEmbedUrl] = useState<string | null>(null);
  const [showEmbedQuality, setShowEmbedQuality] = useState(false);

  // Episode progress tracking
  const { isWatched, toggleWatched } = useWatchStatus({
    id: id ? Number(id) : 0,
    type: 'tv',
    title: showDetails?.name || '',
    poster_path: showDetails?.poster_path || '',
    episodeInfo: {
      season: Number(season),
      episode: Number(episode)
    }
  });

  // Ad-free popup context
  const {
    showPopupForPlayer
  } = useAdFreePopup();

  // État pour le menu d'épisodes
  const [showEpisodesMenu, setShowEpisodesMenu] = useState(false);
  const [displayedSeasonNumber, setDisplayedSeasonNumber] = useState(Number(season)); // State for the season shown in the menu
  const [showSeasonDropdown, setShowSeasonDropdown] = useState(false); // State for custom dropdown visibility

  // État pour suivre si c'est la première sélection automatique
  const [isInitialLoad, setIsInitialLoad] = useState<boolean>(true);

  const updateAnimeContinueWatching = useCallback(() => {
    if (localStorage.getItem('settings_disable_history') === 'true') return;

    const showIdInt = id ? parseInt(id) : NaN;
    const seasonNumber = Number(season);
    const episodeNumber = Number(episode);

    if (!Number.isFinite(showIdInt) || !Number.isFinite(seasonNumber) || !Number.isFinite(episodeNumber)) {
      return;
    }

    let continueWatching: ContinueWatchingStore;
    try {
      continueWatching = JSON.parse(localStorage.getItem('continueWatching') || '{"movies": [], "tv": []}') as ContinueWatchingStore;
    } catch {
      continueWatching = { movies: [], tv: [] };
    }

    if (!Array.isArray(continueWatching.movies)) continueWatching.movies = [];
    if (!Array.isArray(continueWatching.tv)) continueWatching.tv = [];

    const existingShow = continueWatching.tv.find((tvShow) => tvShow.id === showIdInt);
    const updatedShow = {
      ...(existingShow || {}),
      id: showIdInt,
      currentEpisode: {
        season: seasonNumber,
        episode: episodeNumber
      },
      lastAccessed: new Date().toISOString()
    };

    continueWatching.tv = continueWatching.tv.filter((tvShow) => tvShow.id !== showIdInt);
    continueWatching.tv.unshift(updatedShow);
    continueWatching.tv = continueWatching.tv.slice(0, 20);
    localStorage.setItem('continueWatching', JSON.stringify(continueWatching));
  }, [id, season, episode]);

  // Movix Wrapped 2026 - Track anime viewing time
  useWrappedTracker({
    mode: 'viewing',
    viewingData: id ? {
      contentType: 'anime',
      contentId: id,
      seasonNumber: Number(season),
      episodeNumber: Number(episode),
    } : undefined,
    isActive: !loading && !!id,
  });

  // Load TMDB show/movie details — endpoint et mapping de champs différents en mode film
  // (WatchMovie a déjà fait sa propre vérif d'âge en amont, mais on la refait ici aussi
  // par cohérence/sécurité si ce composant est monté avant que ce check ne soit terminé).
  useEffect(() => {
    const fetchShowDetails = async () => {
      try {
        const response = await axios.get(`https://api.themoviedb.org/3/${isMovieMode ? 'movie' : 'tv'}/${id}`, {
          params: {
            api_key: TMDB_API_KEY,
            language: getTmdbLanguage()
          }
        });
        setShowDetails(isMovieMode ? {
          name: response.data.title,
          overview: response.data.overview,
          poster_path: response.data.poster_path,
          first_air_date: response.data.release_date,
          vote_average: response.data.vote_average,
          genres: response.data.genres,
          episode_run_time: response.data.runtime ? [response.data.runtime] : undefined,
          backdrop_path: response.data.backdrop_path,
        } : response.data);

        // Age restriction check
        const profileAge = currentProfile?.ageRestriction ?? 0;
        if (profileAge > 0) {
          try {
            const certResponse = isMovieMode
              ? await axios.get(`https://api.themoviedb.org/3/movie/${id}/release_dates`, {
                params: { api_key: TMDB_API_KEY },
              })
              : await axios.get(`https://api.themoviedb.org/3/tv/${id}/content_ratings`, {
                params: { api_key: TMDB_API_KEY },
              });
            let cert = '';
            if (isMovieMode) {
              const results = certResponse.data.results;
              const fr = results.find((r: any) => r.iso_3166_1 === 'FR');
              const theatrical = fr?.release_dates?.find((rd: any) => rd.type === 3 || rd.type === 2);
              if (theatrical?.certification) cert = theatrical.certification;
              if (!cert) {
                const us = results.find((r: any) => r.iso_3166_1 === 'US');
                const found = us?.release_dates?.find((rd: any) => rd.certification !== '');
                if (found?.certification) cert = found.certification;
              }
            } else {
              const ratings = certResponse.data.results;
              const fr = ratings.find((r: any) => r.iso_3166_1 === 'FR');
              if (fr?.rating) cert = fr.rating;
              if (!cert) {
                const us = ratings.find((r: any) => r.iso_3166_1 === 'US');
                if (us?.rating) cert = us.rating;
              }
            }
            if (cert && !isContentAllowed(cert, profileAge)) {
              setContentCert(cert);
              setIsBlocked(true);
              return;
            }
          } catch (e) {
            console.log('Could not fetch certifications for age check');
          }
        }

      } catch (error) {
        console.error('Error fetching show details:', error);
        setError(t('watch.cannotLoadAnimeDetails'));
        setLoading(false);
      }
    };

    if (id) {
      fetchShowDetails();
    }
  }, [id, isMovieMode]);

  useEffect(() => {
    updateAnimeContinueWatching();
  }, [updateAnimeContinueWatching]);

  // Pas de fetch TMDB pour les détails d'épisode anime - le numérotage ne correspond pas

  // Load anime data with special character handling
  const loadAnimeData = useCallback(async () => {
    if (!showDetails?.name) return;

    try {
      // Use the new utility function for search name logic
      const searchName = getSearchNameForId(id || '', showDetails.name);

      // Use the new fallback search logic
      const searchFunction = async (term: string) => {
        const response = await axios.get(`${MAIN_API}/anime/search/${encodeURIComponent(term)}?includeSeasons=true&includeEpisodes=true`);
        return response.data || [];
      };

      const results = await searchWithFallback(searchFunction, searchName, 'WatchAnime');
      // --- PATCH SPECIAL ANIMES ---
      if (results.length > 0) {
        type AnimeResult = {
          name: string;
          url: string;
          seasons: Array<any>;
          alternative_names?: string[];
        };

        // Type the results properly
        const typedResults = results as AnimeResult[];
        let bestMatch;
        // Utiliser la fonction centralisée pour les cas spéciaux
        const specialMatcher = getAnimeMatcherForId(id || '');
        if (specialMatcher) {
          bestMatch = typedResults.find((anime: AnimeResult) => specialMatcher(anime));
        } else {
          const exactMatchNames = [searchName, showDetails.name]
            .filter((name): name is string => typeof name === 'string' && name.trim().length > 0)
            .map((name) => name.toLowerCase())
            .filter((name, index, arr) => arr.indexOf(name) === index);
          const alternativeMatchTerms = getAnimeMatchTerms(searchName, showDetails.name);

          // First look for exact match using the filtered search name (not the full TMDB title)
          const filteredSearchName = searchName.toLowerCase();
          bestMatch = typedResults.find((anime: AnimeResult) =>
            anime.name.toLowerCase() === filteredSearchName &&
            anime.seasons &&
            anime.seasons.length > 0
          );
          // If no exact match with filtered name, try with full name
          if (!bestMatch) {
            bestMatch = typedResults.find((anime: AnimeResult) =>
              anime.name.toLowerCase() === showDetails.name.toLowerCase() &&
              anime.seasons &&
              anime.seasons.length > 0
            );
          }
          // If still no match, look for exact or inclusion match in alternative_names
          if (!bestMatch) {
            // First try exact match
            bestMatch = typedResults.find((anime: AnimeResult) =>
              Array.isArray(anime.alternative_names) &&
              anime.alternative_names.some(
                (alt: string) => alternativeMatchTerms.includes(alt.toLowerCase())
              ) &&
              anime.seasons && anime.seasons.length > 0
            );
            // If no exact match, try inclusion match (one title contains the other)
            if (!bestMatch) {
              bestMatch = typedResults.find((anime: AnimeResult) =>
                Array.isArray(anime.alternative_names) &&
                anime.alternative_names.some(
                  (alt: string) => {
                    const altLower = alt.toLowerCase();
                    return alternativeMatchTerms.some(
                      (matchTerm) =>
                        altLower.length > 0 &&
                        (altLower.includes(matchTerm) || matchTerm.includes(altLower))
                    );
                  }
                ) &&
                anime.seasons && anime.seasons.length > 0
              );
            }
          }

          // If still no match, try with search variations in alternative_names
          if (!bestMatch) {
            bestMatch = typedResults.find((anime: AnimeResult) =>
              Array.isArray(anime.alternative_names) &&
              anime.alternative_names.some(
                (alt: string) => alternativeMatchTerms.includes(alt.toLowerCase())
              ) &&
              anime.seasons && anime.seasons.length > 0
            );
          }
          // Si toujours aucune correspondance exacte, vérifier la similarité des titres pour éviter les faux positifs
          if (!bestMatch) {
            // Calculer la similarité pour chaque résultat et prendre le meilleur
            // On compare aussi avec les alternative_names pour trouver le meilleur score
            const resultsWithSimilarity = typedResults
              .filter((anime: AnimeResult) => anime.seasons && anime.seasons.length > 0)
              .map((anime: AnimeResult) => {
                let similarity = exactMatchNames.reduce(
                  (bestSimilarity, name) => Math.max(bestSimilarity, calculateTitleSimilarity(name, anime.name)),
                  0
                );
                // Aussi vérifier la similarité avec les noms alternatifs
                if (anime.alternative_names && Array.isArray(anime.alternative_names)) {
                  for (const alt of anime.alternative_names) {
                    for (const matchTerm of alternativeMatchTerms) {
                      const altSimilarity = calculateTitleSimilarity(matchTerm, alt);
                      if (altSimilarity > similarity) {
                        similarity = altSimilarity;
                      }
                    }
                  }
                }
                return { anime, similarity };
              })
              .sort((a, b) => b.similarity - a.similarity);

            // Ne prendre que si la similarité est suffisamment élevée (au moins 0.6)
            if (resultsWithSimilarity.length > 0 && resultsWithSimilarity[0].similarity >= 0.6) {
              bestMatch = resultsWithSimilarity[0].anime;
              console.log(`Correspondance par similarité trouvée: "${bestMatch.name}" (similarité: ${resultsWithSimilarity[0].similarity})`);
            } else if (resultsWithSimilarity.length > 0) {
              console.log(`Aucune correspondance suffisante trouvée. Meilleure similarité: "${resultsWithSimilarity[0].anime.name}" (${resultsWithSimilarity[0].similarity})`);
            }
          }
        }
        // --- FIN PATCH SPECIAL ANIMES ---
        if (bestMatch && bestMatch.seasons && bestMatch.seasons.length > 0) {
          setAnimeData(bestMatch as AnimeData);
        } else if (onNoSourceFallback) {
          onNoSourceFallback();
        } else {
          setError(t('watch.noAnimeSource'));
          setLoading(false);
        }
      } else if (onNoSourceFallback) {
        onNoSourceFallback();
      } else {
        setError(t('watch.noAnimeSource'));
        setLoading(false);
      }
    } catch (error) {
      console.error('Error loading anime data:', error);
      setError(t('watch.animeDataError'));
      setLoading(false);
    }
  }, [id, showDetails?.name]);

  // Load anime data when show details are available
  useEffect(() => {
    if (showDetails) {
      loadAnimeData();
    }
  }, [showDetails, loadAnimeData]);

  // Reset displayed season when URL season changes
  useEffect(() => {
    setDisplayedSeasonNumber(Number(season));
  }, [season]);

  // Mode film : pas de saison/épisode fournis par l'appelant — on cherche la section
  // "Film" dans le catalogue AnimeSama (les films y sont listés comme une "saison" à
  // part, ex: "Film 1") et on s'y positionne automatiquement, épisode 1.
  useEffect(() => {
    if (!isMovieMode || !animeData) return;
    const filmIdx = animeData.seasons.findIndex((s) => /film/i.test(s.name));
    setSeason(String(filmIdx >= 0 ? filmIdx + 1 : 1));
    setEpisode('1');
  }, [isMovieMode, animeData]);

  // Reset initial load flag when episode changes
  useEffect(() => {
    setIsInitialLoad(true);
  }, [id, season, episode]);

  // Clear la source précédente dès le changement d'épisode/anime — sans ça,
  // processVideoSources (async, extraction Vidmoly/Sibnet/etc.) ne réécrit
  // selectedSource/videoSources/hlsPlayerSrc/embedUrl qu'à la toute fin, et
  // l'ancien épisode/anime reste affiché (mélangé avec la nouvelle langue déjà
  // sélectionnée) pendant toute cette fenêtre — d'où le "mauvais VF" signalé.
  useEffect(() => {
    currentRequestKeyRef.current = `${id}-${season}-${episode}`;
    setSelectedSource(null);
    setVideoSources([]);
    setHlsPlayerSrc('');
    setEmbedUrl(null);
    setShowHLSPlayer(false);
  }, [id, season, episode]);

  // Process anime data when available
  useEffect(() => {
    if (animeData && season && episode) {
      // Find the season - since seasons are named instead of numbered, we check if the index in array matches the season number
      const seasonIndex = Number(season) - 1;
      const currentSeason = seasonIndex >= 0 && seasonIndex < animeData.seasons.length
        ? animeData.seasons[seasonIndex]
        : null;

      // If no matching season by index, try to find by name (for cases where "Saison 1" might be in the name)
      let finalSeason = currentSeason;
      if (!finalSeason) {
        finalSeason = animeData.seasons.find(s =>
          s.name.toLowerCase().includes(`saison ${season}`) ||
          s.name.toLowerCase() === `saison ${season}` ||
          s.name.toLowerCase() === `season ${season}`
        ) || null;
      }

      if (finalSeason) {
        console.log(`Found season: ${finalSeason.name}`);
        // Now find the matching episode by index
        const episodeIndex = Number(episode) - 1;
        const currentEpisode = episodeIndex >= 0 && episodeIndex < finalSeason.episodes.length
          ? finalSeason.episodes[episodeIndex]
          : finalSeason.episodes.find(e => e.index === Number(episode));

        if (currentEpisode) {
          console.log(`Found episode: ${currentEpisode.name}`);
          // Get available languages
          const availLangs = currentEpisode.streaming_links.map(link => link.language);
          setAvailableLanguages(availLangs);

          // Se souvenir de la langue choisie manuellement sur un épisode précédent du même
          // anime, si elle est dispo pour cet épisode et si le réglage global est actif.
          const remembered = getRememberLastPlayer() ? rememberedAnimeLangRef.current : null;
          if (remembered && availLangs.includes(remembered)) {
            setSelectedLanguage(remembered);
          } else {
            // Pick selon l'ordre utilisateur (défaut : vf > vostfr > vj > va > vkr > vcn,
            // comportement historique préservé via `buildDefaults` de sourcePriorityPrefs).
            const picked = pickAutoSelectedLanguage(availLangs);
            if (picked) {
              setSelectedLanguage(picked);
            } else if (availLangs.length > 0) {
              setSelectedLanguage(availLangs[0]);
            }
          }

          // Le traitement des sources vidéo est délégué au useEffect dédié ci-dessous
          // pour éviter un double appel qui cause des re-renders infinis
        } else {
          const maxEpisodes = finalSeason.episodes.length;
          setError(t('watch.episodeNotFoundInSeason', { episode, season, maxEpisodes }));
          setLoading(false);
        }
      } else {
        // Debug info
        console.error('Available seasons:', animeData.seasons.map(s => s.name));

        // Generate a more helpful error message with available seasons
        const availableSeasons = animeData.seasons.map(s => s.name).join(', ');
        setError(t('watch.seasonNotFound', { season, availableSeasons }));
        setLoading(false);
      }
    }
  }, [animeData, season, episode]);

  // Process video sources when language changes
  // MODIFIÉ: Ne plus traiter automatiquement les sources quand la langue change
  // L'utilisateur doit maintenant sélectionner manuellement une nouvelle source
  useEffect(() => {
    if (animeData && season && episode) {
      const seasonIndex = Number(season) - 1;
      const currentSeason = seasonIndex >= 0 && seasonIndex < animeData.seasons.length
        ? animeData.seasons[seasonIndex]
        : animeData.seasons.find(s =>
          s.name.toLowerCase().includes(`saison ${season}`) ||
          s.name.toLowerCase() === `saison ${season}` ||
          s.name.toLowerCase() === `season ${season}`
        );

      if (currentSeason) {
        const episodeIndex = Number(episode) - 1;
        const currentEpisode = episodeIndex >= 0 && episodeIndex < currentSeason.episodes.length
          ? currentSeason.episodes[episodeIndex]
          : currentSeason.episodes.find(e => e.index === Number(episode));

        if (currentEpisode) {
          // Ne traiter les sources que si c'est le chargement initial ou si aucune source n'est sélectionnée
          if (isInitialLoad || !selectedSource) {
            processVideoSources(currentEpisode);
          }
          // SUPPRIMÉ: Ne plus traiter les sources automatiquement lors du changement de langue
          // L'utilisateur doit maintenant sélectionner manuellement une nouvelle source
        }
      }
    }
  }, [animeData, season, episode, isInitialLoad, selectedSource]);

  // Check if loading is complete (including extractions)
  useEffect(() => {
    if (
      loading &&
      !loadingVidmolyExtraction && !loadingSibnetExtraction && !loadingOneUploadExtraction &&
      !loadingVoeExtraction && !loadingUqloadExtraction && !loadingVidzyExtraction && !loadingFsvidExtraction &&
      !loadingDoodStreamExtraction && !loadingSeekStreamingExtraction && !loadingDarkiboxExtraction &&
      videoSources.length > 0
    ) {
      setLoading(false);
    }
  }, [
    loading, loadingVidmolyExtraction, loadingSibnetExtraction, loadingOneUploadExtraction,
    loadingVoeExtraction, loadingUqloadExtraction, loadingVidzyExtraction, loadingFsvidExtraction,
    loadingDoodStreamExtraction, loadingSeekStreamingExtraction, loadingDarkiboxExtraction,
    videoSources.length,
  ]);

  // Process video sources from anime episode
  const processVideoSources = async (animeEpisode: AnimeEpisode) => {
    // Capture l'épisode pour lequel cette extraction a été lancée : si l'utilisateur
    // navigue vers un autre épisode avant la fin (extraction multi-hébergeurs lente),
    // currentRequestKeyRef aura changé et on doit ignorer ce résultat obsolète.
    const requestKey = `${id}-${season}-${episode}`;
    const sources: VideoSource[] = [];
    const vidmolySources: VideoSource[] = [];
    const sibnetSources: VideoSource[] = [];
    const oneUploadSources: VideoSource[] = [];
    const voeSources: VideoSource[] = [];
    const uqloadSources: VideoSource[] = [];
    const vidzySources: VideoSource[] = [];
    const fsvidSources: VideoSource[] = [];
    const doodStreamSources: VideoSource[] = [];
    const seekStreamingSources: VideoSource[] = [];
    const darkiboxSources: VideoSource[] = [];

    // Traiter toutes les langues disponibles en une seule fois pour éviter les re-extractions
    for (const streamingLink of animeEpisode.streaming_links) {
      const players = streamingLink.players;

      for (const playerUrl of players) {
        const playerUrlString = typeof playerUrl === 'string' ? playerUrl : String(playerUrl);

        // Check if this is a Vidmoly URL - extract M3U8
        if (playerUrlString.includes('vidmoly.to') || playerUrlString.includes('vidmoly.net')) {
          // Use the URL as-is if it's already .net, otherwise replace .to with .net
          const vidmolyNetUrl = playerUrlString.includes('vidmoly.net')
            ? playerUrlString
            : playerUrlString.replace('vidmoly.to', 'vidmoly.net');

          const vidmolySource = {
            language: streamingLink.language,
            quality: 'Auto',
            url: vidmolyNetUrl,
            player: 'Vidmoly',
            label: `${streamingLink.language.toUpperCase()} - Vidmoly`,
            id: `vidmoly-${streamingLink.language}-${vidmolyNetUrl}`
          };

          vidmolySources.push(vidmolySource);

          // Also add as embed source for fallback
          sources.push(vidmolySource);
        }
        // Check if this is a Sibnet URL - extract M3U8
        else if (playerUrlString.includes('sibnet.ru')) {
          const sibnetSource = {
            language: streamingLink.language,
            quality: 'Auto',
            url: playerUrlString,
            player: 'Sibnet',
            label: `${streamingLink.language.toUpperCase()} - Sibnet`,
            id: `sibnet-${streamingLink.language}-${playerUrlString}`
          };

          sibnetSources.push(sibnetSource);

          // Also add as embed source for fallback
          sources.push(sibnetSource);
        }
        // Check if this is a OneUpload URL - extract M3U8
        else if (playerUrlString.includes('oneupload.to')) {
          const oneUploadSource = {
            language: streamingLink.language,
            quality: 'Auto',
            url: playerUrlString,
            player: 'OneUpload',
            label: `${streamingLink.language.toUpperCase()} - OneUpload`,
            id: `oneupload-${streamingLink.language}-${playerUrlString}`
          };

          oneUploadSources.push(oneUploadSource);

          // Also add as embed source for fallback
          sources.push(oneUploadSource);
        }
        // Check if this is a Voe URL - extract M3U8
        else if (isVoeEmbed(playerUrlString)) {
          const voeSource = {
            language: streamingLink.language,
            quality: 'Auto',
            url: playerUrlString,
            player: 'Voe',
            label: `${streamingLink.language.toUpperCase()} - Voe`,
            id: `voe-${streamingLink.language}-${playerUrlString}`
          };

          voeSources.push(voeSource);

          // Also add as embed source for fallback
          sources.push(voeSource);
        }
        // Check if this is a Uqload URL - extract M3U8
        else if (playerUrlString.toLowerCase().includes('uqload')) {
          const uqloadSource = {
            language: streamingLink.language,
            quality: 'Auto',
            url: playerUrlString,
            player: 'Uqload',
            label: `${streamingLink.language.toUpperCase()} - Uqload`,
            id: `uqload-${streamingLink.language}-${playerUrlString}`
          };

          uqloadSources.push(uqloadSource);

          // Also add as embed source for fallback
          sources.push(uqloadSource);
        }
        // Check if this is a Vidzy URL - extract M3U8
        else if (playerUrlString.toLowerCase().includes('vidzy')) {
          const vidzySource = {
            language: streamingLink.language,
            quality: 'Auto',
            url: playerUrlString,
            player: 'Vidzy',
            label: `${streamingLink.language.toUpperCase()} - Vidzy`,
            id: `vidzy-${streamingLink.language}-${playerUrlString}`
          };

          vidzySources.push(vidzySource);

          // Also add as embed source for fallback
          sources.push(vidzySource);
        }
        // Check if this is a Fsvid URL - extract M3U8
        else if (playerUrlString.toLowerCase().includes('fsvid')) {
          const fsvidSource = {
            language: streamingLink.language,
            quality: 'Auto',
            url: playerUrlString,
            player: 'Fsvid',
            label: `${streamingLink.language.toUpperCase()} - Fsvid`,
            id: `fsvid-${streamingLink.language}-${playerUrlString}`
          };

          fsvidSources.push(fsvidSource);

          // Also add as embed source for fallback
          sources.push(fsvidSource);
        }
        // Check if this is a DoodStream URL - extract M3U8
        else if (isDoodStreamEmbed(playerUrlString)) {
          const doodStreamSource = {
            language: streamingLink.language,
            quality: 'Auto',
            url: playerUrlString,
            player: 'DoodStream',
            label: `${streamingLink.language.toUpperCase()} - DoodStream`,
            id: `doodstream-${streamingLink.language}-${playerUrlString}`
          };

          doodStreamSources.push(doodStreamSource);

          // Also add as embed source for fallback
          sources.push(doodStreamSource);
        }
        // Check if this is a Darkibox URL - extract M3U8
        else if (playerUrlString.toLowerCase().includes('darkibox')) {
          const darkiboxSource = {
            language: streamingLink.language,
            quality: 'Auto',
            url: playerUrlString,
            player: 'Darkibox',
            label: `${streamingLink.language.toUpperCase()} - Darkibox`,
            id: `darkibox-${streamingLink.language}-${playerUrlString}`
          };

          darkiboxSources.push(darkiboxSource);

          // Also add as embed source for fallback
          sources.push(darkiboxSource);
        }
        // Check if this is a SeekStreaming URL - extract M3U8 (pattern le plus large,
        // testé en dernier pour ne pas court-circuiter les autres hosters ci-dessus)
        else if (isSeekStreamingEmbed(playerUrlString)) {
          const seekStreamingSource = {
            language: streamingLink.language,
            quality: 'Auto',
            url: playerUrlString,
            player: 'SeekStreaming',
            label: `${streamingLink.language.toUpperCase()} - SeekStreaming`,
            id: `seekstreaming-${streamingLink.language}-${playerUrlString}`
          };

          seekStreamingSources.push(seekStreamingSource);

          // Also add as embed source for fallback
          sources.push(seekStreamingSource);
        }
        // Skip anime-sama URLs - don't display them as players
        else if (playerUrlString.includes('anime-sama.fr') || playerUrlString.includes('anime-sama.to')) {
          console.log('Skipping anime-sama URL:', playerUrlString);
          continue;
        } else {
          // Extract domain name from URL to use as player name
          let playerName = "Unknown";
          try {
            const url = new URL(playerUrlString);
            const hostname = url.hostname;
            const domainParts = hostname.replace(/^www\./, '').split('.');
            if (domainParts.length >= 2) {
              playerName = domainParts[domainParts.length - 2];
              const domainMappings: Record<string, string> = {
                'vidmoly': 'Vidmoly',
                'sendvid': 'Sendvid',
                'vk': 'VK',
                'vkvideo': 'VKVideo',
                'oneupload': 'OneUpload',
                'smoothpre': 'SmoothPre',
                'video': 'Video'
              };
              playerName = domainMappings[playerName.toLowerCase()] || playerName.charAt(0).toUpperCase() + playerName.slice(1);
            }
          } catch (e) {
            try {
              const domainMatch = playerUrlString.match(/https?:\/\/(?:www\.)?([^\/]+)/i);
              if (domainMatch && domainMatch[1]) {
                const domain = domainMatch[1].split('.')[0];
                playerName = domain.charAt(0).toUpperCase() + domain.slice(1);
              }
            } catch (matchError) {
              console.error("Error extracting domain:", matchError);
              playerName = "Unknown";
            }
          }

          // Add source as embed
          sources.push({
            language: streamingLink.language,
            quality: 'Auto',
            url: playerUrlString,
            player: playerName,
            label: `${streamingLink.language.toUpperCase()} - ${playerName}`,
            id: `${playerName.toLowerCase()}-${streamingLink.language}-${playerUrlString}`
          });
        }
      }
    }

    // Extract M3U8 from Vidmoly sources
    if (vidmolySources.length > 0) {
      console.log('🔍 Extracting M3U8 from Vidmoly sources...');
      setLoadingVidmolyExtraction(true);
      setExtractionProgress(t('watch.extractingSources', { provider: 'Vidmoly' }));

      for (const vidmolySource of vidmolySources) {
        try {
          const extractionResult = await withTimeout(extractVidmolyM3u8(vidmolySource.url, MAIN_API));

          if (extractionResult && extractionResult.success && extractionResult.m3u8Url) {
            console.log('✅ Vidmoly M3U8 extracted:', extractionResult.m3u8Url);

            // Add HLS source
            sources.push({
              language: vidmolySource.language,
              quality: 'Auto',
              url: extractionResult.m3u8Url,
              player: 'Vidmoly',
              label: `${vidmolySource.language.toUpperCase()} - Vidmoly HLS`,
              isM3u8: true,
              id: `vidmoly-hls-${vidmolySource.language}-${extractionResult.m3u8Url}`
            });
          } else {
            console.log('❌ Vidmoly M3U8 extraction failed:', extractionResult?.error);
          }
        } catch (error) {
          console.error('Error extracting Vidmoly M3U8:', error);
        }
      }
      setLoadingVidmolyExtraction(false);
    }

    // Extract M3U8 from Sibnet sources
    if (sibnetSources.length > 0) {
      console.log('🔍 Extracting M3U8 from Sibnet sources...');
      setLoadingSibnetExtraction(true);
      setExtractionProgress(t('watch.extractingSources', { provider: 'Sibnet' }));

      for (const sibnetSource of sibnetSources) {
        try {
          const extractionResult = await withTimeout(extractSibnetM3u8(sibnetSource.url, MAIN_API));

          if (extractionResult && extractionResult.success && extractionResult.m3u8Url) {
            console.log('✅ Sibnet source extracted:', extractionResult.m3u8Url);

            // For Sibnet sources, always mark as HLS for UI consistency (even if MP4)
            // The HLSPlayer will handle MP4 detection internally
            sources.push({
              language: sibnetSource.language,
              quality: 'Auto',
              url: extractionResult.m3u8Url,
              player: 'Sibnet',
              label: `${sibnetSource.language.toUpperCase()} - Sibnet HLS`,
              isM3u8: true, // Always true for Sibnet to show HLS tag
              id: `sibnet-hls-${sibnetSource.language}-${extractionResult.m3u8Url}`
            });
          } else {
            console.log('❌ Sibnet M3U8 extraction failed:', extractionResult?.error);
          }
        } catch (error) {
          console.error('Error extracting Sibnet M3U8:', error);
        }
      }
      setLoadingSibnetExtraction(false);
    }

    // Extract M3U8 from OneUpload sources
    if (oneUploadSources.length > 0) {
      console.log('🔍 Extracting M3U8 from OneUpload sources...');
      setLoadingOneUploadExtraction(true);
      setExtractionProgress(t('watch.extractingSources', { provider: 'OneUpload' }));

      for (const oneUploadSource of oneUploadSources) {
        try {
          const extractionResult = await withTimeout(extractOneUploadSources(oneUploadSource.url));

          if (extractionResult && extractionResult.success && (extractionResult.hlsUrl || extractionResult.m3u8Url)) {
            const extractedUrl = extractionResult.hlsUrl || extractionResult.m3u8Url;
            if (extractedUrl) {
              console.log('✅ OneUpload source extracted:', extractedUrl);

              // Add HLS source (mark as M3U8 for UI consistency, HLSPlayer will handle MP4 detection)
              sources.push({
                language: oneUploadSource.language,
                quality: 'Auto',
                url: extractedUrl,
                player: 'OneUpload',
                label: `${oneUploadSource.language.toUpperCase()} - OneUpload HLS`,
                isM3u8: true,
                id: `oneupload-hls-${oneUploadSource.language}-${extractedUrl}`
              });
            }
          } else {
            console.log('❌ OneUpload M3U8 extraction failed:', extractionResult?.error);
          }
        } catch (error) {
          console.error('Error extracting OneUpload M3U8:', error);
        }
      }
      setLoadingOneUploadExtraction(false);
    }

    // Extract M3U8 from Voe sources
    if (voeSources.length > 0) {
      console.log('🔍 Extracting M3U8 from Voe sources...');
      setLoadingVoeExtraction(true);
      setExtractionProgress(t('watch.extractingSources', { provider: 'Voe' }));

      for (const voeSource of voeSources) {
        try {
          const extractionResult = await withTimeout(extractVoeM3u8(voeSource.url));

          if (extractionResult && extractionResult.success && (extractionResult.hlsUrl || extractionResult.m3u8Url)) {
            const extractedUrl = extractionResult.hlsUrl || extractionResult.m3u8Url;
            if (extractedUrl) {
              console.log('✅ Voe source extracted:', extractedUrl);

              sources.push({
                language: voeSource.language,
                quality: 'Auto',
                url: extractedUrl,
                player: 'Voe',
                label: `${voeSource.language.toUpperCase()} - Voe HLS`,
                isM3u8: true,
                id: `voe-hls-${voeSource.language}-${extractedUrl}`
              });
            }
          } else {
            console.log('❌ Voe M3U8 extraction failed:', extractionResult?.error);
          }
        } catch (error) {
          console.error('Error extracting Voe M3U8:', error);
        }
      }
      setLoadingVoeExtraction(false);
    }

    // Extract M3U8 from Uqload sources
    if (uqloadSources.length > 0) {
      console.log('🔍 Extracting M3U8 from Uqload sources...');
      setLoadingUqloadExtraction(true);
      setExtractionProgress(t('watch.extractingSources', { provider: 'Uqload' }));

      for (const uqloadSource of uqloadSources) {
        try {
          const extractionResult = await withTimeout(extractUqloadFile(uqloadSource.url, MAIN_API));

          if (extractionResult && extractionResult.success && (extractionResult.hlsUrl || extractionResult.m3u8Url)) {
            const extractedUrl = extractionResult.hlsUrl || extractionResult.m3u8Url;
            if (extractedUrl) {
              console.log('✅ Uqload source extracted:', extractedUrl);

              sources.push({
                language: uqloadSource.language,
                quality: 'Auto',
                url: extractedUrl,
                player: 'Uqload',
                label: `${uqloadSource.language.toUpperCase()} - Uqload HLS`,
                isM3u8: true,
                id: `uqload-hls-${uqloadSource.language}-${extractedUrl}`
              });
            }
          } else {
            console.log('❌ Uqload M3U8 extraction failed:', extractionResult?.error);
          }
        } catch (error) {
          console.error('Error extracting Uqload M3U8:', error);
        }
      }
      setLoadingUqloadExtraction(false);
    }

    // Extract M3U8 from Vidzy sources
    if (vidzySources.length > 0) {
      console.log('🔍 Extracting M3U8 from Vidzy sources...');
      setLoadingVidzyExtraction(true);
      setExtractionProgress(t('watch.extractingSources', { provider: 'Vidzy' }));

      for (const vidzySource of vidzySources) {
        try {
          const extractionResult = await withTimeout(extractVidzyM3u8(vidzySource.url, MAIN_API));

          if (extractionResult && extractionResult.success && (extractionResult.hlsUrl || extractionResult.m3u8Url)) {
            const extractedUrl = extractionResult.hlsUrl || extractionResult.m3u8Url;
            if (extractedUrl) {
              console.log('✅ Vidzy source extracted:', extractedUrl);

              sources.push({
                language: vidzySource.language,
                quality: 'Auto',
                url: extractedUrl,
                player: 'Vidzy',
                label: `${vidzySource.language.toUpperCase()} - Vidzy HLS`,
                isM3u8: true,
                id: `vidzy-hls-${vidzySource.language}-${extractedUrl}`
              });
            }
          } else {
            console.log('❌ Vidzy M3U8 extraction failed:', extractionResult?.error);
          }
        } catch (error) {
          console.error('Error extracting Vidzy M3U8:', error);
        }
      }
      setLoadingVidzyExtraction(false);
    }

    // Extract M3U8 from Fsvid sources
    if (fsvidSources.length > 0) {
      console.log('🔍 Extracting M3U8 from Fsvid sources...');
      setLoadingFsvidExtraction(true);
      setExtractionProgress(t('watch.extractingSources', { provider: 'Fsvid' }));

      for (const fsvidSource of fsvidSources) {
        try {
          const extractionResult = await withTimeout(extractFsvidM3u8(fsvidSource.url, MAIN_API));

          if (extractionResult && extractionResult.success && (extractionResult.hlsUrl || extractionResult.m3u8Url)) {
            const extractedUrl = extractionResult.hlsUrl || extractionResult.m3u8Url;
            if (extractedUrl) {
              console.log('✅ Fsvid source extracted:', extractedUrl);

              sources.push({
                language: fsvidSource.language,
                quality: 'Auto',
                url: extractedUrl,
                player: 'Fsvid',
                label: `${fsvidSource.language.toUpperCase()} - Fsvid HLS`,
                isM3u8: true,
                id: `fsvid-hls-${fsvidSource.language}-${extractedUrl}`
              });
            }
          } else {
            console.log('❌ Fsvid M3U8 extraction failed:', extractionResult?.error);
          }
        } catch (error) {
          console.error('Error extracting Fsvid M3U8:', error);
        }
      }
      setLoadingFsvidExtraction(false);
    }

    // Extract M3U8 from DoodStream sources
    if (doodStreamSources.length > 0) {
      console.log('🔍 Extracting M3U8 from DoodStream sources...');
      setLoadingDoodStreamExtraction(true);
      setExtractionProgress(t('watch.extractingSources', { provider: 'DoodStream' }));

      for (const doodStreamSource of doodStreamSources) {
        try {
          const extractionResult = await withTimeout(extractDoodStreamFile(doodStreamSource.url));

          if (extractionResult && extractionResult.success && (extractionResult.hlsUrl || extractionResult.m3u8Url)) {
            const extractedUrl = extractionResult.hlsUrl || extractionResult.m3u8Url;
            if (extractedUrl) {
              console.log('✅ DoodStream source extracted:', extractedUrl);

              // Always mark as HLS for UI consistency (even if MP4) - HLSPlayer handles MP4 internally
              sources.push({
                language: doodStreamSource.language,
                quality: 'Auto',
                url: extractedUrl,
                player: 'DoodStream',
                label: `${doodStreamSource.language.toUpperCase()} - DoodStream HLS`,
                isM3u8: true,
                id: `doodstream-hls-${doodStreamSource.language}-${extractedUrl}`
              });
            }
          } else {
            console.log('❌ DoodStream M3U8 extraction failed:', extractionResult?.error);
          }
        } catch (error) {
          console.error('Error extracting DoodStream M3U8:', error);
        }
      }
      setLoadingDoodStreamExtraction(false);
    }

    // Extract M3U8 from SeekStreaming sources
    if (seekStreamingSources.length > 0) {
      console.log('🔍 Extracting M3U8 from SeekStreaming sources...');
      setLoadingSeekStreamingExtraction(true);
      setExtractionProgress(t('watch.extractingSources', { provider: 'SeekStreaming' }));

      for (const seekStreamingSource of seekStreamingSources) {
        try {
          const extractionResult = await withTimeout(extractSeekStreamingM3u8(seekStreamingSource.url));

          if (extractionResult && extractionResult.success && (extractionResult.hlsUrl || extractionResult.m3u8Url)) {
            const extractedUrl = extractionResult.hlsUrl || extractionResult.m3u8Url;
            if (extractedUrl) {
              console.log('✅ SeekStreaming source extracted:', extractedUrl);

              sources.push({
                language: seekStreamingSource.language,
                quality: 'Auto',
                url: extractedUrl,
                player: 'SeekStreaming',
                label: `${seekStreamingSource.language.toUpperCase()} - SeekStreaming HLS`,
                isM3u8: true,
                id: `seekstreaming-hls-${seekStreamingSource.language}-${extractedUrl}`
              });
            }
          } else {
            console.log('❌ SeekStreaming M3U8 extraction failed:', extractionResult?.error);
          }
        } catch (error) {
          console.error('Error extracting SeekStreaming M3U8:', error);
        }
      }
      setLoadingSeekStreamingExtraction(false);
    }

    // Extract M3U8 from Darkibox sources
    if (darkiboxSources.length > 0) {
      console.log('🔍 Extracting M3U8 from Darkibox sources...');
      setLoadingDarkiboxExtraction(true);
      setExtractionProgress(t('watch.extractingSources', { provider: 'Darkibox' }));

      for (const darkiboxSource of darkiboxSources) {
        try {
          const extractionResult = await withTimeout(extractDarkiboxSources(darkiboxSource.url, MAIN_API));

          if (extractionResult && extractionResult.success && (extractionResult.hlsUrl || extractionResult.m3u8Url)) {
            const extractedUrl = extractionResult.hlsUrl || extractionResult.m3u8Url;
            if (extractedUrl) {
              console.log('✅ Darkibox source extracted:', extractedUrl);

              sources.push({
                language: darkiboxSource.language,
                quality: 'Auto',
                url: extractedUrl,
                player: 'Darkibox',
                label: `${darkiboxSource.language.toUpperCase()} - Darkibox HLS`,
                isM3u8: true,
                id: `darkibox-hls-${darkiboxSource.language}-${extractedUrl}`
              });
            }
          } else {
            console.log('❌ Darkibox M3U8 extraction failed:', extractionResult?.error);
          }
        } catch (error) {
          console.error('Error extracting Darkibox M3U8:', error);
        }
      }
      setLoadingDarkiboxExtraction(false);
    }

    // Tri par priorité hoster selon prefs utilisateur.
    // On annote chaque source avec son `type` détecté (via detectHoster, qui utilise
    // les regex du registre + overrides user), puis on trie avec `sortHostersByPriority`
    // dans le contexte `anime` + langue courante (permet override par langue si défini).
    // Fallback legacy : Vidmoly > Sibnet > OneUpload > autres (préservé via l'ordre
    // par défaut construit dans buildDefaults si aucun override user n'est présent).
    const prefs = getSourcePriorityPrefs();
    // Mapper le nom affiché aux ids du registre pour les hosters anime-specific.
    // Nécessaire pour les sources HLS post-extraction : leur `url` pointe vers le
    // CDN du hoster (pas son domaine d'embed), donc `detectHoster` ne matche plus
    // rien sur ces entrées — on retombe alors sur le nom de `player` qu'on a nous-même
    // posé lors de l'extraction pour retrouver l'id du registre.
    const playerToHosterId: Record<string, string> = {
      vidmoly: 'vidmoly',
      sibnet: 'sibnet',
      oneupload: 'oneupload',
      voe: 'voe',
      uqload: 'uqload',
      vidzy: 'vidzy',
      fsvid: 'fsvid',
      doodstream: 'doodstream',
      seekstreaming: 'seekstreaming',
      darkibox: 'darkibox',
    };
    const annotated = sources.map((s) => {
      const detected = detectHoster(s.url, {
        patternOverrides: prefs.patternOverrides,
        customHosters: prefs.customHosters,
      });
      const type = detected ?? playerToHosterId[s.player.toLowerCase()] ?? s.player.toLowerCase();
      return { source: s, type };
    });
    const sorted = sortHostersByPriority(annotated, {
      category: 'anime',
      topLevel: selectedLanguage,
    });
    const sortedSources = sorted.map((a) => a.source);

    if (currentRequestKeyRef.current !== requestKey) {
      // L'utilisateur a changé d'épisode pendant cette extraction : on jette le résultat
      // obsolète plutôt que d'écraser les sources du nouvel épisode déjà en cours de chargement.
      return;
    }

    setVideoSources(sortedSources);
    setExtractionProgress('');

    // Ne pas changer automatiquement la source sélectionnée si ce n'est pas le chargement initial
    // L'utilisateur doit maintenant sélectionner manuellement une nouvelle source dans la langue choisie
  };

  // Fonction pour sélectionner automatiquement la meilleure source
  const selectBestSource = useCallback(() => {
    if (videoSources.length === 0) return;

    // Filtrer les sources par langue sélectionnée
    const filteredSources = videoSources.filter(source =>
      source.language?.toLowerCase() === selectedLanguage.toLowerCase()
    );

    let sourceToSelect = null;

    console.log('Auto-selecting source. Available sources:', videoSources.map(s => ({
      player: s.player,
      language: s.language,
      isM3u8: s.isM3u8,
      label: s.label
    })));
    console.log('Selected language:', selectedLanguage);
    console.log('Filtered sources for language:', filteredSources.map(s => ({
      player: s.player,
      language: s.language,
      isM3u8: s.isM3u8,
      label: s.label
    })));

    // Utiliser les sources filtrées pour la sélection
    const sourcesToSearch = filteredSources.length > 0 ? filteredSources : videoSources;

    // Priority 1: Vidmoly HLS source in VF (always prioritize VF if available)
    if (!sourceToSelect) {
      sourceToSelect = sourcesToSearch.find(source =>
        source.isM3u8 &&
        source.player === 'Vidmoly' &&
        source.language?.toLowerCase() === 'vf'
      );
      if (sourceToSelect) {
        console.log('Selected Vidmoly VF HLS source:', sourceToSelect.label);
      }
    }

    // Priority 2: Vidmoly HLS source in current language (non-VF)
    if (!sourceToSelect && selectedLanguage && selectedLanguage !== 'vf') {
      sourceToSelect = sourcesToSearch.find(source =>
        source.isM3u8 &&
        source.player === 'Vidmoly' &&
        source.language?.toLowerCase() === selectedLanguage.toLowerCase()
      );
      if (sourceToSelect) {
        console.log('Selected Vidmoly HLS source in current language:', sourceToSelect.label);
      }
    }

    // Priority 3: Sibnet HLS source in VF (always prioritize VF if available)
    if (!sourceToSelect) {
      sourceToSelect = sourcesToSearch.find(source =>
        source.isM3u8 &&
        source.player === 'Sibnet' &&
        source.language?.toLowerCase() === 'vf'
      );
      if (sourceToSelect) {
        console.log('Selected Sibnet VF HLS source:', sourceToSelect.label);
      }
    }

    // Priority 4: Sibnet HLS source in current language (non-VF)
    if (!sourceToSelect && selectedLanguage && selectedLanguage !== 'vf') {
      sourceToSelect = sourcesToSearch.find(source =>
        source.isM3u8 &&
        source.player === 'Sibnet' &&
        source.language?.toLowerCase() === selectedLanguage.toLowerCase()
      );
      if (sourceToSelect) {
        console.log('Selected Sibnet HLS source in current language:', sourceToSelect.label);
      }
    }

    // Priority 5: OneUpload HLS source in VF (always prioritize VF if available)
    if (!sourceToSelect) {
      sourceToSelect = sourcesToSearch.find(source =>
        source.isM3u8 &&
        source.player === 'OneUpload' &&
        source.language?.toLowerCase() === 'vf'
      );
      if (sourceToSelect) {
        console.log('Selected OneUpload VF HLS source:', sourceToSelect.label);
      }
    }

    // Priority 6: OneUpload HLS source in current language (non-VF)
    if (!sourceToSelect && selectedLanguage && selectedLanguage !== 'vf') {
      sourceToSelect = sourcesToSearch.find(source =>
        source.isM3u8 &&
        source.player === 'OneUpload' &&
        source.language?.toLowerCase() === selectedLanguage.toLowerCase()
      );
      if (sourceToSelect) {
        console.log('Selected OneUpload HLS source in current language:', sourceToSelect.label);
      }
    }

    // Priority 7: Any HLS source in VF (always prioritize VF if available)
    if (!sourceToSelect) {
      sourceToSelect = sourcesToSearch.find(source =>
        source.isM3u8 &&
        source.language?.toLowerCase() === 'vf'
      );
      if (sourceToSelect) {
        console.log('Selected VF HLS source:', sourceToSelect.label);
      }
    }

    // Priority 8: Any HLS source in current language
    if (!sourceToSelect && selectedLanguage) {
      sourceToSelect = sourcesToSearch.find(source =>
        source.isM3u8 &&
        source.language?.toLowerCase() === selectedLanguage.toLowerCase()
      );
      if (sourceToSelect) {
        console.log('Selected HLS source in current language:', sourceToSelect.label);
      }
    }

    // Priority 9: Any HLS source
    if (!sourceToSelect) {
      sourceToSelect = sourcesToSearch.find(source => source.isM3u8);
      if (sourceToSelect) {
        console.log('Selected any HLS source:', sourceToSelect.label);
      }
    }

    // Priority 10: First available source in current language
    if (!sourceToSelect && selectedLanguage) {
      sourceToSelect = sourcesToSearch.find(source =>
        source.language?.toLowerCase() === selectedLanguage.toLowerCase()
      );
      if (sourceToSelect) {
        console.log('Selected first source in current language:', sourceToSelect.label);
      }
    }

    // Priority 11: First available source
    if (!sourceToSelect) {
      sourceToSelect = sourcesToSearch[0];
      console.log('Selected first available source:', sourceToSelect.label);
    }

    console.log('Final selected source:', sourceToSelect);
    setSelectedSource(sourceToSelect);

    // Trigger ad popup based on player type for auto-selected source
    const playerType = sourceToSelect.player.toLowerCase();
    if (playerType.includes('vidmoly')) {
      showPopupForPlayer('vidmoly');
    } else if (playerType.includes('sibnet')) {
      showPopupForPlayer('vidmoly'); // Sibnet is treated as vidmoly type
    } else if (playerType.includes('oneupload')) {
      showPopupForPlayer('omega'); // OneUpload is treated as omega type
    } else {
      // For other players, show generic popup
      showPopupForPlayer('adfree');
    }

    if (sourceToSelect.isM3u8) {
      // Use HLS Player for m3u8 sources (including Sibnet sources)
      setHlsPlayerSrc(sourceToSelect.url);
      setShowHLSPlayer(true);
      setEmbedUrl(null);
    } else {
      setEmbedUrl(sourceToSelect.url);
      setShowHLSPlayer(false);
      setHlsPlayerSrc('');
    }
  }, [videoSources, selectedLanguage]);

  // Sélection automatique du premier lecteur disponible (seulement au chargement initial)
  useEffect(() => {
    if (videoSources.length > 0 && isInitialLoad) {
      selectBestSource();
      // Marquer que la sélection initiale est terminée
      setIsInitialLoad(false);
    }
  }, [videoSources, isInitialLoad, selectBestSource]);

  // DÉSACTIVÉ: Ne plus sélectionner automatiquement un lecteur quand on change de langue
  // L'utilisateur doit maintenant choisir manuellement le lecteur dans la langue sélectionnée
  // useEffect(() => {
  //   if (videoSources.length > 0 && !isInitialLoad) {
  //     selectBestSource();
  //   }
  // }, [selectedLanguage, selectBestSource, isInitialLoad]);

  // Handle source selection
  const handleSelectSource = (source: VideoSource) => {
    setSelectedSource(source);

    // Trigger ad popup based on player type
    const playerType = source.player.toLowerCase();
    if (playerType.includes('vidmoly')) {
      showPopupForPlayer('vidmoly');
    } else if (playerType.includes('sibnet')) {
      showPopupForPlayer('vidmoly'); // Sibnet is treated as vidmoly type
    } else if (playerType.includes('oneupload')) {
      showPopupForPlayer('omega'); // OneUpload is treated as omega type
    } else {
      // For other players, show generic popup
      showPopupForPlayer('adfree');
    }

    if (source.isM3u8) {
      // Use HLS Player for m3u8 sources (including Sibnet sources)
      setHlsPlayerSrc(source.url);
      setShowHLSPlayer(true);
      setEmbedUrl(null);
    } else {
      // Use embed for other sources
      setEmbedUrl(source.url);
      setShowHLSPlayer(false);
      setHlsPlayerSrc('');
    }

    setShowEmbedQuality(false);

    // Progress saving functionality removed
  };

  // Listener pour l'événement showSourcesMenu (déclenché par HLSPlayer en cas d'erreur 403)
  useEffect(() => {
    const handleShowSourcesMenu = () => {
      setShowEmbedQuality(true);
    };
    window.addEventListener('showSourcesMenu', handleShowSourcesMenu);
    return () => {
      window.removeEventListener('showSourcesMenu', handleShowSourcesMenu);
    };
  }, []);

  // Watch progress functionality removed


  // Handle page unload to mark episode as watched
  useEffect(() => {
    const handleBeforeUnload = () => {
      if (!isWatched) {
        toggleWatched();
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      handleBeforeUnload();
    };
  }, [isWatched, toggleWatched]);

  // Handle next episode (for HLSPlayer)
  const handleNextEpisodeFromPlayer = (seasonNum: number, episodeNum: number) => {
    if (!id) return;
    setSeason(String(seasonNum));
    setEpisode(String(episodeNum));
  };

  // Handle next episode (for buttons)
  const handleNextEpisode = () => {
    if (!animeData || !season || !episode) return;

    const currentSeasonIndex = Number(season) - 1;
    const currentEpisodeNumber = Number(episode);
    const currentSeason = animeData.seasons[currentSeasonIndex];

    let targetSeason = Number(season);
    let targetEpisode = currentEpisodeNumber + 1;

    if (currentSeason && targetEpisode > currentSeason.episodes.length) {
      // Move to the first episode of the next season if it exists
      if (currentSeasonIndex + 1 < animeData.seasons.length) {
        targetSeason = currentSeasonIndex + 2;
        targetEpisode = 1;
      } else {
        // No next episode/season
        return;
      }
    }

    if (!id) return;
    setSeason(String(targetSeason));
    setEpisode(String(targetEpisode));
  };

  // Handle previous episode
  const handlePreviousEpisode = () => {
    if (!animeData || !season || !episode || !id) return;

    const currentSeasonIndex = Number(season) - 1;
    const currentEpisodeNumber = Number(episode);

    let targetSeason = Number(season);
    let targetEpisode = currentEpisodeNumber - 1;

    if (targetEpisode < 1) {
      // Move to the last episode of the previous season if it exists
      if (currentSeasonIndex > 0) {
        const prevSeason = animeData.seasons[currentSeasonIndex - 1];
        targetSeason = currentSeasonIndex; // Season number is index + 1
        targetEpisode = prevSeason.episodes.length; // Last episode of previous season
      } else {
        // No previous episode/season
        return;
      }
    }
    setSeason(String(targetSeason));
    setEpisode(String(targetEpisode));
  };

  useEffect(() => {
    const setVh = () => {
      document.documentElement.style.setProperty('--vh', `${window.innerHeight * 0.01}px`);
    };
    setVh();
    window.addEventListener('resize', setVh);
    return () => window.removeEventListener('resize', setVh);
  }, []);

  // Age restriction blocking screen
  if (isBlocked) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-gray-900 to-black flex items-center justify-center px-4">
        <div className="text-center max-w-md">
          <div className="w-20 h-20 bg-red-600/20 rounded-full flex items-center justify-center mx-auto mb-6">
            <svg className="w-10 h-10 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-white mb-3">{t('details.contentBlocked')}</h2>
          <p className="text-gray-400 mb-6">
            {t('details.contentBlockedDesc', { rating: getClassificationLabel(contentCert, t), age: currentProfile?.ageRestriction ?? 0 })}
          </p>
          <button
            onClick={() => navigate(-1)}
            className="px-6 py-3 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors font-medium"
          >
            {t('details.goBack')}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-4xl mx-auto my-6">
      {/* En-tête — titre + métadonnées, au-dessus de l'encadré du player */}
      <div className="mb-4 flex flex-col items-center text-center gap-3">
        <h1 className="text-2xl md:text-3xl font-bold text-white">{headerTitle || showDetails?.name}</h1>
        <div className="flex flex-wrap items-center justify-center gap-3">
          {!!headerYear && (
            <span className="flex items-center gap-1.5 text-white/60 text-sm">
              <span>📅</span>
              <span>{headerYear}</span>
            </span>
          )}
          {headerCertification && (
            <span className="px-2 py-0.5 rounded text-xs font-bold bg-gradient-to-r from-green-400 to-purple-500 text-white">
              {getClassificationLabel(headerCertification, t)}
            </span>
          )}
          {!!headerVoteAverage && headerVoteAverage > 0 && (
            <span className="flex items-center gap-1 text-white/60 text-sm">
              <span className="text-yellow-500">⭐</span>
              <span className="font-bold text-white/80">{headerVoteAverage.toFixed(1)}</span>
              <span className="text-xs">/10</span>
            </span>
          )}
          {!!headerSeasonsCount && headerSeasonsCount > 0 && (
            <span className="flex items-center gap-1.5 text-white/60 text-sm">
              <span>🎬</span>
              <span>{headerSeasonsCount} saison{headerSeasonsCount > 1 ? 's' : ''}</span>
            </span>
          )}
        </div>
      </div>

      <div className="relative w-full aspect-video rounded-lg overflow-hidden bg-gray-900">
      <style dangerouslySetInnerHTML={{
        __html: `
          .loading-container {
            --uib-size: 35px;
            --uib-color: white;
            --uib-speed: 1s;
            --uib-stroke: 3.5px;
            display: flex;
            align-items: center;
            justify-content: space-between;
            width: var(--uib-size);
            height: calc(var(--uib-size) * 0.9);
          }

          .loading-bar {
            width: var(--uib-stroke);
            height: 100%;
            background-color: var(--uib-color);
            border-radius: calc(var(--uib-stroke) / 2);
            transition: background-color 0.3s ease;
          }

          .loading-bar:nth-child(1) {
            animation: grow var(--uib-speed) ease-in-out calc(var(--uib-speed) * -0.45) infinite;
          }

          .loading-bar:nth-child(2) {
            animation: grow var(--uib-speed) ease-in-out calc(var(--uib-speed) * -0.3) infinite;
          }

          .loading-bar:nth-child(3) {
            animation: grow var(--uib-speed) ease-in-out calc(var(--uib-speed) * -0.15) infinite;
          }

          .loading-bar:nth-child(4) {
            animation: grow var(--uib-speed) ease-in-out infinite;
          }

          @keyframes grow {
            0%, 100% {
              transform: scaleY(0.3);
            }
            50% {
              transform: scaleY(1);
            }
          }
        `
      }} />
      <div
        hidden
        data-premid-watch-context=""
        data-premid-title={showDetails?.name || undefined}
        data-premid-media-type="anime"
        data-premid-season={season}
        data-premid-episode={episode}
        data-premid-episode-title={episodeDetails?.name || undefined}
        data-premid-source-label={selectedSource?.player || undefined}
        data-premid-source-detail={selectedSource?.label || undefined}
      />
      {!id ? (
        <div className="flex items-center justify-center h-full">
          <div className="max-w-2xl mx-auto bg-gray-800 p-8 rounded-xl shadow-2xl">
            <div className="text-center">
              <h2 className="text-2xl font-bold text-white mb-4">{t('watch.invalidId')}</h2>
              <p className="text-gray-300 mb-6">
                {t('watch.animeInvalidIdDesc')}
              </p>
              <button
                onClick={() => navigate('/anime')}
                className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg transition-colors"
              >
                {t('watch.backToAnimes')}
              </button>
            </div>
          </div>
        </div>
      ) : loading ? (
        <div className="flex flex-col items-center justify-center h-full bg-black">
          <div className="loading-container">
            <div className="loading-bar"></div>
            <div className="loading-bar"></div>
            <div className="loading-bar"></div>
            <div className="loading-bar"></div>
          </div>
          <div className="text-white text-xl font-medium mt-6">{t('watch.loadingEpisode')}</div>
          {extractionProgress && (
            <div className="text-gray-300 text-sm mt-2">{extractionProgress}</div>
          )}
          {(loadingVidmolyExtraction || loadingSibnetExtraction || loadingOneUploadExtraction ||
            loadingVoeExtraction || loadingUqloadExtraction || loadingVidzyExtraction || loadingFsvidExtraction ||
            loadingDoodStreamExtraction || loadingSeekStreamingExtraction || loadingDarkiboxExtraction) && (
            <div className="mt-4 space-y-2">
              {loadingVidmolyExtraction && (
                <div className="flex items-center gap-2 text-blue-400 text-sm">
                  <div className="w-3 h-3 border-2 border-blue-400 border-t-transparent rounded-full animate-spin"></div>
                  {t('watch.extractionPlayer', { player: 'Vidmoly' })}
                </div>
              )}
              {loadingSibnetExtraction && (
                <div className="flex items-center gap-2 text-green-400 text-sm">
                  <div className="w-3 h-3 border-2 border-green-400 border-t-transparent rounded-full animate-spin"></div>
                  {t('watch.extractionPlayer', { player: 'Sibnet' })}
                </div>
              )}
              {loadingOneUploadExtraction && (
                <div className="flex items-center gap-2 text-purple-400 text-sm">
                  <div className="w-3 h-3 border-2 border-purple-400 border-t-transparent rounded-full animate-spin"></div>
                  {t('watch.extractionPlayer', { player: 'OneUpload' })}
                </div>
              )}
              {loadingVoeExtraction && (
                <div className="flex items-center gap-2 text-yellow-400 text-sm">
                  <div className="w-3 h-3 border-2 border-yellow-400 border-t-transparent rounded-full animate-spin"></div>
                  {t('watch.extractionPlayer', { player: 'Voe' })}
                </div>
              )}
              {loadingUqloadExtraction && (
                <div className="flex items-center gap-2 text-orange-400 text-sm">
                  <div className="w-3 h-3 border-2 border-orange-400 border-t-transparent rounded-full animate-spin"></div>
                  {t('watch.extractionPlayer', { player: 'Uqload' })}
                </div>
              )}
              {loadingVidzyExtraction && (
                <div className="flex items-center gap-2 text-pink-400 text-sm">
                  <div className="w-3 h-3 border-2 border-pink-400 border-t-transparent rounded-full animate-spin"></div>
                  {t('watch.extractionPlayer', { player: 'Vidzy' })}
                </div>
              )}
              {loadingFsvidExtraction && (
                <div className="flex items-center gap-2 text-teal-400 text-sm">
                  <div className="w-3 h-3 border-2 border-teal-400 border-t-transparent rounded-full animate-spin"></div>
                  {t('watch.extractionPlayer', { player: 'Fsvid' })}
                </div>
              )}
              {loadingDoodStreamExtraction && (
                <div className="flex items-center gap-2 text-indigo-400 text-sm">
                  <div className="w-3 h-3 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin"></div>
                  {t('watch.extractionPlayer', { player: 'DoodStream' })}
                </div>
              )}
              {loadingSeekStreamingExtraction && (
                <div className="flex items-center gap-2 text-cyan-400 text-sm">
                  <div className="w-3 h-3 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin"></div>
                  {t('watch.extractionPlayer', { player: 'SeekStreaming' })}
                </div>
              )}
              {loadingDarkiboxExtraction && (
                <div className="flex items-center gap-2 text-lime-400 text-sm">
                  <div className="w-3 h-3 border-2 border-lime-400 border-t-transparent rounded-full animate-spin"></div>
                  {t('watch.extractionPlayer', { player: 'Darkibox' })}
                </div>
              )}
            </div>
          )}
        </div>
      ) : error && fallbackEmbedSource && id ? (
        <div className="relative w-full h-full bg-black">
          <div className="absolute top-4 left-4 z-10 flex gap-2">
            <button
              className="bg-gray-800/80 hover:bg-gray-700 text-white text-sm px-3 py-1.5 rounded-md"
              onClick={() => setFallbackEmbedSource(null)}
            >
              {t('watch.back')}
            </button>
          </div>
          <iframe
            src={
              fallbackEmbedSource === 'videasy'
                ? `https://player.videasy.net/tv/${id}/${season || '1'}/${episode || '1'}?autoplay=1`
                : `https://peachify.top/embed/tv/${id}?season=${season || '1'}&episode=${episode || '1'}&sub=French&accent=dc2626`
            }
            className="w-full h-full border-0"
            allowFullScreen
            referrerPolicy="strict-origin-when-cross-origin"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          />
        </div>
      ) : error ? (
        <div className="flex items-center justify-center h-full">
          <div className="max-w-2xl mx-auto bg-gray-800 p-8 rounded-xl shadow-2xl">
            <h2 className="text-2xl font-bold text-red-500 mb-4">{t('watch.errorTitle')}</h2>
            <p className="text-lg mb-6">{error}</p>

            {id && (
              <div className="mb-6">
                <h3 className="text-xl font-semibold mb-3">{t('watch.tryAnotherSource')}</h3>
                <div className="flex flex-wrap gap-3">
                  <button
                    className="bg-emerald-600 hover:bg-emerald-700 px-4 py-2 rounded-md"
                    onClick={() => setFallbackEmbedSource('videasy')}
                  >
                    Videasy (VOSTFR)
                  </button>
                  <button
                    className="bg-orange-600 hover:bg-orange-700 px-4 py-2 rounded-md"
                    onClick={() => setFallbackEmbedSource('peachify')}
                  >
                    Peachify (VOSTFR)
                  </button>
                </div>
              </div>
            )}

            {animeData && (
              <div className="mb-6">
                <h3 className="text-xl font-semibold mb-4">{t('watch.availableSeasons')}</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {animeData.seasons.map((s, idx) => (
                    <div key={idx} className="bg-gray-700 p-4 rounded-lg">
                      <h4 className="text-lg font-medium mb-2">{s.name}</h4>
                      <p className="text-sm text-gray-300 mb-3">{t('watch.episodesCount', { count: s.episodes.length })}</p>
                      <div className="flex flex-wrap gap-2">
                        {[...Array(Math.min(5, s.episodes.length))].map((_, i) => (
                          <button
                            key={i}
                            className="bg-blue-600 hover:bg-blue-700 px-2 py-1 rounded text-sm"
                            onClick={() => { if (id) { setSeason(String(idx + 1)); setEpisode(String(i + 1)); } }}
                          >
                            Ep {i + 1}
                          </button>
                        ))}
                        {s.episodes.length > 5 && (
                          <span className="text-gray-400 self-center">...</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="flex gap-4">
              <button
                className="bg-gray-700 hover:bg-gray-600 px-4 py-2 rounded-md"
                onClick={() => navigate(-1)}
              >
                {t('watch.back')}
              </button>
              {animeData && animeData.seasons.length > 0 && (
                <button
                  className="bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded-md"
                  onClick={() => { if (id) { setSeason('1'); setEpisode('1'); } }}
                >
                  {t('watch.startSeries')}
                </button>
              )}
            </div>
          </div>
        </div>
      ) : (
        <div className="w-full h-full flex flex-col">
          {/* Barre au-dessus du player : Retour / Précédent / Épisodes / Suivant — masquée quand le HLS Player est actif */}
          {!showHLSPlayer && (
          <div className="relative z-50 flex items-center justify-between gap-2 px-4 py-3 flex-shrink-0">
          {/* Back to Info Button */}
            <motion.button
              onClick={() => navigate(`/${isMovieMode ? 'movie' : 'tv'}/${encodeId(id!)}`)}
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2, ease: "easeOut" }}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="flex items-center gap-2 px-3 py-2 rounded-xl text-white"
              style={GLASS_BTN_STYLE}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
              {t('watch.back')}
            </motion.button>

          {/* Navigation buttons (Previous, Episodes, Next) — inutiles pour un film unique */}
          {animeData && !isMovieMode && (
            <motion.div
              className="flex items-center gap-2"
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2, ease: "easeOut" }}
            >
              {/* Previous Episode Button - hide if at first episode of first season */}
              {!(Number(season) === 1 && Number(episode) === 1) && (
                <motion.button
                  onClick={(e) => {
                    e.stopPropagation();
                    handlePreviousEpisode();
                  }}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  className="flex items-center gap-2 px-3 py-2 rounded-xl text-white"
                  style={GLASS_BTN_STYLE}
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" />
                  </svg>
                  <span>
                    {Number(episode) > 1
                      ? `S${Number(season)}:${String(Number(episode) - 1).padStart(2, '0')}`
                      : Number(season) > 1
                        ? `S${Number(season) - 1}:01`
                        : `S1:01`}
                  </span>
                </motion.button>
              )}

              {/* Episodes Button */}
              <motion.button
                onClick={(e) => {
                  e.stopPropagation();
                  setShowEpisodesMenu(!showEpisodesMenu);
                }}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className="flex items-center gap-2 px-3 py-2 rounded-xl text-white"
                style={GLASS_BTN_STYLE}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h7" />
                </svg>
                <span className="hidden sm:inline">{t('watch.episodes')}</span>
              </motion.button>

              {/* Next Episode Button */}
              {animeData && (
                (() => {
                  const nextSeason = animeData.seasons[Number(season) - 1] && Number(episode) < animeData.seasons[Number(season) - 1].episodes.length
                    ? Number(season)
                    : Number(season) < animeData.seasons.length
                      ? Number(season) + 1
                      : null;
                  const nextEpisodeNum = nextSeason === Number(season)
                    ? Number(episode) + 1
                    : nextSeason
                      ? 1
                      : null;

                  return nextSeason && nextEpisodeNum ? (
                    <motion.button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleNextEpisode();
                      }}
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      className="flex items-center gap-2 px-3 py-2 rounded-xl text-white"
                      style={GLASS_BTN_STYLE}
                    >
                      <span>S{nextSeason}:{String(nextEpisodeNum).padStart(2, '0')}</span>
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
                      </svg>
                    </motion.button>
                  ) : null;
                })()
              )}
            </motion.div>
          )}

          {/* Episodes Menu */}
          <AnimatePresence>
            {/* Ensure variables like showEpisodesMenu, animeData etc. are accessible here */}
            {showEpisodesMenu && animeData && (
              <motion.div
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.2 }}
                className="absolute top-full mt-2 right-4 md:right-4 left-4 md:left-auto z-[11000] bg-black/95 border border-gray-800 rounded-lg shadow-2xl md:w-96 w-auto max-h-[80vh] overflow-hidden flex flex-col"
              >
                <div className="p-4 border-b border-gray-800 flex justify-between items-center">
                  <h3 className="text-lg font-semibold text-white">{showDetails?.name}</h3>
                  <button
                    onClick={() => setShowEpisodesMenu(false)}
                    className="text-gray-400 hover:text-white"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>

                {/* Custom Season Dropdown */}
                <div className="p-4 border-b border-gray-800/50">
                  <h4 className="text-sm text-gray-400 mb-2">{t('watch.seasonLabel')}</h4>
                  <div className="relative w-full">
                    <button
                      onClick={() => setShowSeasonDropdown(!showSeasonDropdown)}
                      className="w-full flex items-center justify-between bg-gray-800/50 hover:bg-gray-700/50 rounded-lg p-3 text-white transition-colors duration-200"
                    >
                      {/* Display selected season name */}
                      <span className="font-medium">{animeData.seasons[displayedSeasonNumber - 1]?.name || t('watch.seasonN', { n: displayedSeasonNumber })}</span>
                      <motion.div
                        animate={{ rotate: showSeasonDropdown ? 180 : 0 }}
                        transition={{ duration: 0.2 }}
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                        </svg>
                      </motion.div>
                    </button>

                    {/* Animated Dropdown List */}
                    <AnimatePresence>
                      {showSeasonDropdown && (
                        <motion.div
                          initial={{ opacity: 0, y: -10 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -10 }}
                          transition={{ duration: 0.2, ease: "easeInOut" }}
                          className="absolute top-full left-0 right-0 mt-1 bg-gray-900/95 border border-gray-700 rounded-lg shadow-xl max-h-60 overflow-y-auto z-20 custom-scrollbar"
                          data-lenis-prevent
                        >
                          {animeData.seasons.map((s, index) => (
                            <button
                              key={index}
                              onClick={() => {
                                setDisplayedSeasonNumber(index + 1);
                                setShowSeasonDropdown(false); // Close dropdown on selection
                              }}
                              className={`w-full text-left px-4 py-3 text-sm transition-colors duration-150 ${displayedSeasonNumber === index + 1
                                ? 'bg-red-800/50 text-red-100 font-semibold'
                                : 'text-gray-200 hover:bg-gray-700/50'
                                }`}
                            >
                              {s.name}
                              <span className="text-xs text-gray-400 ml-1">({t('watch.episodesCount', { count: s.episodes.length })})</span>
                            </button>
                          ))}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </div>

                {/* Current Episode (reflects URL, not menu selection) */}
                <div className="p-4 border-b border-gray-800/50">
                  <div className="text-xs text-gray-400 mb-1">
                    {animeData.seasons[Number(season) - 1]?.name} • {t('watch.episodeN', { n: episode })} ({t('watch.watching')})
                  </div>
                  <h4 className="text-white font-medium mb-1">{animeData.seasons[Number(season) - 1]?.episodes[Number(episode) - 1]?.name || t('watch.episodeN', { n: episode })}</h4>
                </div>

                {/* Episodes List (uses displayedSeasonNumber) */}
                <div className="flex-1 overflow-y-auto p-1" data-lenis-prevent>
                  <div className="grid gap-2 p-2">
                    {animeData.seasons[displayedSeasonNumber - 1]?.episodes.map((ep, index) => (
                      <button
                        key={index}
                        onClick={() => {
                          if (!id) return;
                          setSeason(String(displayedSeasonNumber));
                          setEpisode(String(index + 1));
                          setShowEpisodesMenu(false);
                        }}
                        className={`flex items-start gap-3 p-2 rounded-lg transition-colors ${Number(episode) === index + 1 && displayedSeasonNumber === Number(season) // Highlight only if season and episode match URL
                          ? 'bg-red-900/30 border border-red-800/50'
                          : 'hover:bg-gray-800/50'
                          }`}
                      >
                        <div className="w-10 h-10 bg-gray-800 rounded flex items-center justify-center">
                          <span className="text-sm font-medium">{index + 1}</span>
                        </div>
                        <div className="flex-1 text-left">
                          <h5 className="text-sm text-white font-medium line-clamp-1">{ep.name || t('watch.episodeN', { n: index + 1 })}</h5>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
          </div>
          )}

          {/* Zone du player, sous la barre de boutons */}
          <div className="relative flex-1 w-full min-h-0">

          {/* Change Source Button */}
          {!showHLSPlayer && (
            <button
              onClick={() => setShowEmbedQuality(true)}
              className="absolute top-16 right-3 z-[10000] flex items-center gap-2 px-4 py-2 rounded-lg bg-black/90 border border-gray-700 hover:bg-gray-800/80 text-white font-medium text-sm transition-all duration-200"
            >
              <svg className="w-4 h-4 text-red-500" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" /></svg>
              <span>{t('watch.sources')}</span>
            </button>
          )}

          {/* Source Selection Panel */}
          <AnimatePresence>
            {showEmbedQuality && (
              <div className="absolute inset-0 z-[10001] bg-black/50 flex justify-end pointer-events-none">
                <motion.div
                  key="embed-quality-menu"
                  initial={{ opacity: 0, x: 300 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 300 }}
                  transition={{ duration: 0.3, ease: 'easeOut' }}
                  className="bg-black/95 border-l border-gray-800 shadow-2xl w-full max-w-md h-full overflow-y-auto pointer-events-auto"
                  data-lenis-prevent
                >
                  <div className="flex justify-between items-center p-4 border-b border-gray-700/60 sticky top-0 bg-black/95 z-10">
                    <h3 className="text-white text-lg font-bold">{t('watch.sourcesAndLanguages')}</h3>
                    <button
                      onClick={() => setShowEmbedQuality(false)}
                      className="text-gray-400 hover:text-red-500 transition-colors text-2xl font-bold focus:outline-none"
                    >
                      ×
                    </button>
                  </div>

                  <div className="p-4">
                    {/* Current info */}
                    <div className="bg-gray-800/60 rounded-lg p-4 mb-6">
                      <h4 className="text-white text-md font-medium mb-1">{showDetails?.name}</h4>
                      <p className="text-gray-400 text-sm">
                        S{season} E{episode} {episodeDetails?.name ? `- ${episodeDetails.name}` : ''}
                      </p>
                    </div>

                    {/* Fournisseur — Anime-Sama / AniCloud / FRAnime */}
                    <div className="mb-6">
                      <h4 className="text-white text-md font-semibold mb-3">Fournisseur</h4>
                      <div className="space-y-2">
                        {([
                          { key: 'animesama', label: 'Anime-Sama' },
                          { key: 'anicloud', label: 'AniCloud' },
                          { key: 'franime', label: 'FRAnime' },
                        ] as const).map(p => (
                          <button
                            key={p.key}
                            onClick={() => setProvider(p.key)}
                            className={`w-full px-4 py-3 text-sm text-left rounded-lg flex justify-between items-center transition-all duration-200 ${provider === p.key
                              ? 'bg-gray-800 border-l-4 border-red-600 pl-3 font-medium text-red-600'
                              : 'bg-gray-900/60 hover:bg-gray-800/80 text-gray-200 hover:text-white'
                              }`}
                          >
                            {p.label}
                            {provider === p.key && (
                              <span className="text-xs px-2 py-1 bg-red-600 text-white rounded-full">{t('watch.active')}</span>
                            )}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* AniCloud — langue + lecteurs */}
                    {provider === 'anicloud' && (
                      <div className="mb-6">
                        {loadingAnicloud ? (
                          <div className="flex items-center justify-center py-6">
                            <svg className="animate-spin h-6 w-6 text-emerald-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                            </svg>
                          </div>
                        ) : anicloudError ? (
                          <p className="text-gray-400 text-sm">{anicloudError}</p>
                        ) : (
                          <>
                            <h4 className="text-white text-md font-semibold mb-3">{t('watch.versionLabel')}</h4>
                            <div className="grid grid-cols-2 gap-2 mb-4">
                              {(['vf', 'vostfr'] as const).map(lang => (
                                <button key={lang} onClick={() => setAnicloudLang(lang)}
                                  className={`px-3 py-2 rounded-lg text-sm transition-all duration-200 ${anicloudLang === lang ? 'bg-gray-800 border-l-4 border-red-600 pl-3 font-medium' : 'bg-gray-900/60 hover:bg-gray-800/80 text-gray-200'}`}>
                                  {lang.toUpperCase()}
                                </button>
                              ))}
                            </div>
                            {anicloudPlayers.length > 0 && (
                              <>
                                <h4 className="text-white text-md font-semibold mb-3">{t('watch.playersLabel')}</h4>
                                <div className="space-y-2">
                                  {anicloudPlayers.map((p, i) => (
                                    <button key={p.id} onClick={() => { setAnicloudPlayerIdx(i); rememberedAnicloudPlayerNameRef.current = p.player_name; }}
                                      className={`w-full px-4 py-3 text-sm text-left rounded-lg flex justify-between items-center ${anicloudPlayerIdx === i ? 'bg-gray-800 border-l-4 border-red-600 pl-3 font-medium text-red-600' : 'bg-gray-900/60 hover:bg-gray-800/80 text-gray-200 hover:text-white'}`}>
                                      {p.player_name.charAt(0).toUpperCase() + p.player_name.slice(1)}
                                      {anicloudPlayerIdx === i && (
                                        <span className="text-xs px-2 py-1 bg-red-600 text-white rounded-full">{t('watch.active')}</span>
                                      )}
                                    </button>
                                  ))}
                                </div>
                              </>
                            )}
                          </>
                        )}
                      </div>
                    )}

                    {/* FRAnime — langue */}
                    {provider === 'franime' && (
                      <div className="mb-6">
                        {franimeLoading ? (
                          <div className="flex items-center justify-center py-6">
                            <svg className="animate-spin h-6 w-6 text-blue-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                            </svg>
                          </div>
                        ) : franimeError || !franimeLookup ? (
                          <p className="text-gray-400 text-sm">{franimeError ?? 'Anime non trouvé sur FRAnime'}</p>
                        ) : franimeLookup.langs.length > 1 ? (
                          <>
                            <h4 className="text-white text-md font-semibold mb-3">{t('watch.versionLabel')}</h4>
                            <div className="grid grid-cols-2 gap-2 mb-4">
                              {franimeLookup.langs.map(lang => (
                                <button key={lang} onClick={() => setFranimeLang(lang)}
                                  className={`px-3 py-2 rounded-lg text-sm transition-all duration-200 ${franimeLang === lang ? 'bg-gray-800 border-l-4 border-red-600 pl-3 font-medium' : 'bg-gray-900/60 hover:bg-gray-800/80 text-gray-200'}`}>
                                  {lang.toUpperCase()}
                                </button>
                              ))}
                            </div>
                          </>
                        ) : null}
                      </div>
                    )}

                    {/* Language Selector — Anime-Sama */}
                    {provider === 'animesama' && availableLanguages.length > 0 && (
                      <div className="mb-6">
                        <h4 className="text-white text-md font-semibold mb-3 flex items-center">
                          <svg className="w-5 h-5 mr-2 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 5h12M9 3v2m1.048 9.5A18.022 18.022 0 016.412 9m6.088 9h7M11 21l5-10 5 10M12.751 5C11.783 10.77 8.07 15.61 3 18.129" />
                          </svg>
                          {t('watch.versionLabel')}
                        </h4>
                        <div className="grid grid-cols-2 gap-2 mb-4">
                          {availableLanguages.map(lang => (
                            <div
                              key={lang}
                              className={`relative flex items-center rounded-lg transition-all duration-200 ${selectedLanguage === lang
                                ? 'bg-gray-800 border-l-4 border-red-600 pl-3 font-medium'
                                : 'bg-gray-900/60 hover:bg-gray-800/80 text-gray-200 hover:text-white'
                                }`}
                            >
                              <button
                                className="flex-1 px-3 py-2 flex items-center justify-center"
                                onClick={() => { setSelectedLanguage(lang); rememberedAnimeLangRef.current = lang; }}
                              >
                                {lang.toUpperCase()}
                                {pinnedLang === lang && (
                                  <span className="ml-2 text-xs text-amber-400 font-semibold">#1</span>
                                )}
                              </button>
                              <PinButton
                                isPinned={pinnedLang === lang}
                                onToggle={() => (pinnedLang === lang ? unpinLanguage() : pinLanguage(lang))}
                                size={12}
                                className="mr-1"
                              />
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Source Selector — Anime-Sama */}
                    {provider === 'animesama' && (
                    <div className="mb-6">
                      <h4 className="text-white text-md font-semibold mb-3 flex items-center">
                        <svg className="w-5 h-5 mr-2 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        {t('watch.playersLabel')}
                      </h4>

                      {/* Current Selected Source Info */}
                      {selectedSource && (
                        <div className="bg-gray-800/60 rounded-lg p-3 mb-4 border-l-4 border-red-600">
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="text-red-400 text-sm font-medium">{t('watch.currentSource')}</p>
                              <p className="text-white font-semibold">
                                {selectedSource.player}
                              </p>
                              <p className="text-gray-400 text-xs">
                                {selectedSource.language?.toUpperCase()} • {selectedSource.quality}
                                {selectedSource.isM3u8 && <span className="ml-1 text-green-400">• HLS</span>}
                              </p>
                            </div>
                            <div className="text-green-400">
                              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                              </svg>
                            </div>
                          </div>
                        </div>
                      )}

                      <div className="space-y-2">
                        {videoSources
                          .filter(source => source.language?.toLowerCase() === selectedLanguage.toLowerCase())
                          .map((source, index) => (
                            <motion.button
                              key={index}
                              initial={{ opacity: 0, y: 20 }}
                              animate={{ opacity: 1, y: 0 }}
                              exit={{ opacity: 0, y: -10 }}
                              transition={{
                                duration: 0.3,
                                delay: index * 0.05,
                                ease: "easeOut"
                              }}
                              onClick={() => handleSelectSource(source)}
                              className={`w-full px-4 py-3 text-sm text-left hover:bg-gray-800/80 rounded-lg mb-2 flex justify-between items-center ${selectedSource?.id === source.id
                                ? 'bg-gray-800 border-l-4 border-red-600 pl-3'
                                : 'bg-gray-900/60 text-white'
                                }`}
                            >
                              <div className="flex flex-col">
                                <span className={selectedSource?.id === source.id ? 'text-red-600 font-medium' : 'text-white'}>
                                  {source.player}
                                </span>
                                <span className="text-xs text-gray-400">
                                  {source.language?.toUpperCase()} • {source.quality}
                                  {source.isM3u8 && <span className="ml-1 text-green-400">HLS</span>}
                                </span>
                              </div>
                              {selectedSource?.id === source.id && (
                                <span className="text-xs px-2 py-1 bg-red-600 text-white rounded-full">{t('watch.active')}</span>
                              )}
                            </motion.button>
                          ))}
                      </div>
                    </div>
                    )}
                  </div>
                </motion.div>
              </div>
            )}
          </AnimatePresence>

          {provider === 'animesama' && (
            <>
              {/* HLS Player for extracted sources */}
              {showHLSPlayer && hlsPlayerSrc ? (
                <HLSPlayer
                  priorityCategory="anime"
                  src={hlsPlayerSrc}
                  autoPlay={true}
                  controls={true}
                  className="w-full h-full"
                  poster={showDetails?.backdrop_path ? `https://image.tmdb.org/t/p/w1280${showDetails.backdrop_path}` : undefined}
                  tvShow={{
                    name: showDetails?.name || '',
                    backdrop_path: showDetails?.backdrop_path
                  }}
                  tvShowId={id || undefined}
                  seasonNumber={Number(season)}
                  episodeNumber={Number(episode)}
                  title={`${showDetails?.name} - S${season}E${episode}`}
                  onNextEpisode={handleNextEpisodeFromPlayer}
                  onPreviousEpisode={handlePreviousEpisode}
                  onShowEpisodesMenu={() => setShowEpisodesMenu(!showEpisodesMenu)}
                  onShowSources={() => setShowEmbedQuality(true)}
                  isAnime={true}
                  nextEpisode={
                    animeData && Number(season) <= animeData.seasons.length && Number(episode) < animeData.seasons[Number(season) - 1]?.episodes.length
                      ? {
                        seasonNumber: Number(season),
                        episodeNumber: Number(episode) + 1,
                        name: animeData.seasons[Number(season) - 1]?.episodes[Number(episode)]?.name
                      }
                      : animeData && Number(season) < animeData.seasons.length
                        ? {
                          seasonNumber: Number(season) + 1,
                          episodeNumber: 1,
                          name: animeData.seasons[Number(season)]?.episodes[0]?.name
                        }
                        : undefined
                  }
                />
              ) : null}

              {/* Video container for direct MP4 playback */}
              <div
                ref={playerRef}
                className={`w-full h-full ${!embedUrl && !showHLSPlayer ? 'block' : 'hidden'}`}
              ></div>

              {/* Iframe for embed video */}
              {embedUrl && !showHLSPlayer ? (
                <iframe
                  src={embedUrl}
                  className="w-full h-full border-0"
                  allowFullScreen
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                ></iframe>
              ) : null}
            </>
          )}

          {provider === 'anicloud' && (() => {
            if (loadingAnicloud) return (
              <div className="w-full h-[360px] flex items-center justify-center bg-black">
                <svg className="animate-spin h-10 w-10 text-emerald-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
              </div>
            );
            if (anicloudError) return (
              <div className="w-full h-[360px] flex flex-col items-center justify-center bg-black text-gray-400 gap-3">
                <span className="text-sm">{anicloudError}</span>
              </div>
            );
            const currentPlayer = anicloudPlayers[anicloudPlayerIdx];
            return currentPlayer ? (
              <iframe
                key={`anicloud-${season}-${episode}-${anicloudLang}-${anicloudPlayerIdx}`}
                src={currentPlayer.player_url}
                className="w-full h-[56vw] min-h-[200px] sm:h-[360px] md:h-[500px] lg:h-[560px] 2xl:h-[700px]"
                allowFullScreen
                allow="autoplay; fullscreen; encrypted-media"
                style={{ border: 'none', display: 'block' }}
                title={`${showDetails?.name} S${season}E${episode}`}
              />
            ) : (
              <div className="w-full h-[360px] flex items-center justify-center bg-black text-gray-400 text-sm">
                Aucun lecteur disponible
              </div>
            );
          })()}

          {provider === 'franime' && (() => {
            if (franimeLoading) return (
              <div className="w-full h-[360px] flex items-center justify-center bg-black">
                <svg className="animate-spin h-10 w-10 text-blue-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
              </div>
            );
            if (franimeError || !franimeLookup) return (
              <div className="w-full h-[360px] flex flex-col items-center justify-center bg-black text-gray-400 gap-3">
                <span className="text-sm">{franimeError ?? 'Anime non trouvé sur FRAnime'}</span>
              </div>
            );
            const franimeSrc = `https://franime.fr/anime/${franimeLookup.slug}?anime_id=${franimeLookup.animeId}&lang=${franimeLang}&ep=${episode ?? 1}`;
            return (
              <div className="w-full h-[40vw] min-h-[140px] sm:h-[220px] md:h-[360px] lg:h-[420px] 2xl:h-[560px] overflow-hidden relative">
                <iframe
                  key={`franime-${season}-${episode}-${franimeLang}`}
                  src={franimeSrc}
                  allowFullScreen
                  allow="autoplay; fullscreen; encrypted-media"
                  scrolling="no"
                  style={{ border: 'none', display: 'block', position: 'absolute', top: '-140px', left: 0, width: '100%', height: 'calc(100% + 140px)' }}
                  title={`${showDetails?.name} S${season}E${episode}`}
                />
              </div>
            );
          })()}

          </div>
        </div>
      )}

      {/* Ad Free Player Ads Popup */}
      <AdFreePlayerAds />
      </div>

      {/* Encadré infos — synopsis + affiche, sous le player. Parité avec WatchTv.tsx/
          WatchMovie.tsx qui affichent déjà ce bloc ; showDetails est fetch depuis TMDB
          juste au-dessus (poster_path/overview inclus), il manquait juste le rendu. */}
      {showDetails?.overview && (
        <div className="mt-6 rounded-2xl border border-white/10 bg-white/[0.03] p-6 flex flex-col sm:flex-row sm:items-stretch gap-6">
          {showDetails?.poster_path && (
            <div className="relative w-32 sm:w-40 md:w-48 flex-shrink-0 mx-auto sm:mx-0">
              <img
                src={`https://image.tmdb.org/t/p/w342${showDetails.poster_path}`}
                alt={headerTitle || showDetails?.name}
                className="w-full h-auto sm:absolute sm:inset-0 sm:w-full sm:h-full rounded-xl object-cover"
              />
            </div>
          )}
          <div className="flex-1 min-w-0">
            <p className="text-white/60 text-sm md:text-base leading-relaxed">{showDetails.overview}</p>
          </div>
        </div>
      )}

      {/* Animes / Films similaires */}
      {recommendations.length > 0 && (
        <div className="mt-8">
          <div className="mb-4 flex items-center justify-center gap-2">
            <span className="text-[#4ade80] text-xl">🔥</span>
            <h3 className="text-xl font-bold text-white">{isMovieMode ? 'Films similaires' : 'Animes similaires'}</h3>
          </div>
          <div className="flex gap-3 justify-center">
            {recommendations.slice(0, 4).map((rec: any) => (
              <Link
                key={rec.id}
                to={`/${isMovieMode ? 'movie' : 'tv'}/${encodeId(rec.id)}`}
                className="group relative block flex-shrink-0 rounded-[10px] overflow-hidden border border-transparent hover:border-green-400/35 hover:shadow-[0_0_16px_rgba(74,222,128,0.15)] transition-all duration-200"
                style={{ aspectRatio: '2/3', minWidth: 'calc(25% - 9px)', maxWidth: 'calc(25% - 9px)' }}
              >
                <img
                  src={rec.poster_path ? `https://image.tmdb.org/t/p/w342${rec.poster_path}` : 'https://via.placeholder.com/185x278/1F2937/FFFFFF?text=Aucune+image'}
                  alt={rec.name || rec.title}
                  className="w-full h-full object-cover"
                  loading="lazy"
                />
                <div className="absolute inset-0 flex items-center justify-center bg-green-950/0 group-hover:bg-green-950/55 transition-colors duration-200">
                  <div
                    className="w-11 h-11 rounded-full flex items-center justify-center opacity-0 scale-75 group-hover:opacity-100 group-hover:scale-100 transition-all duration-200"
                    style={{ background: 'linear-gradient(135deg, #166534, #4a1d96)', boxShadow: '0 0 20px rgba(74,222,128,0.4)' }}
                  >
                    <Play className="w-5 h-5 text-white ml-0.5" />
                  </div>
                </div>
                <div className="absolute bottom-0 left-0 right-0 p-2 bg-gradient-to-t from-black/90 to-transparent">
                  <p className="text-white text-xs font-medium line-clamp-1">{rec.name || rec.title}</p>
                  {(rec.first_air_date || rec.release_date) && <p className="text-white/40 text-[10px]">{new Date(rec.first_air_date || rec.release_date).getFullYear()}</p>}
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default WatchAnime;
