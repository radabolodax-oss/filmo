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

import EmbedPlayerChrome from '../../components/EmbedPlayerChrome';

import { formatPlayerDisplayName } from '../../utils/hosterRegistry';

import FrameRedirectWatch from '../../components/FrameRedirectWatch';

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

import { detectHoster, toCanonicalHosterDomain, getHosterDisplayName } from '../../utils/hosterRegistry';
import { runExtractionPass } from '../../utils/runExtractionPass';

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



const getCleanMainApi = () => {

  if (typeof window !== 'undefined') {

    const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';

    let custom = (window as any).__DAWGER_API__ || localStorage.getItem('dawger_server_url');

    if (custom && typeof custom === 'string') {

      if (

        custom.includes('metropolitan-seat') ||

        custom.includes('billy-affairs') ||

        custom.includes('pichunter-linda') ||

        (isLocal && custom.includes('trycloudflare.com'))

      ) {

        try { localStorage.removeItem('dawger_server_url'); } catch {}

        custom = null;

      } else {

        return custom.replace(/\/+$/, '');

      }

    }

    if (isLocal) return 'http://localhost:25565';

  }

  const envApi = (import.meta.env.VITE_MAIN_API as string || '').replace(/\/+$/, '');

  if (envApi && !envApi.includes('pichunter-linda') && !envApi.includes('metropolitan-seat') && !envApi.includes('billy-affairs')) {

    return envApi;

  }

  return 'http://localhost:25565';

};

const MAIN_API = getCleanMainApi();

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

  id?: string;
  hosterId?: string; // Unique identifier for comparison

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




// Resolves TMDB season & episode numbers to animeData seasons & episodes,
// handling both standard ("Saison 1", "Saison 2") and continuous series ("Avec Fillers" 500 eps, "Sans Fillers", etc.).
const resolveAnimeSeasonAndEpisode = (
  animeDataObj: AnimeData,
  seasonStr: string,
  episodeStr: string,
  tmdbSeasons?: Array<{ season_number: number; episode_count: number }>
): { season: AnimeSeason | null; episode: AnimeEpisode | null; resolvedSeasonName?: string; resolvedEpisodeNumber?: number } => {
  const seasonNum = Number(seasonStr);
  const episodeNum = Number(episodeStr);

  // 1. Direct match by season name if seasons are named "Saison 1", "Saison 2", etc.
  let matchedSeason = animeDataObj.seasons.find(s =>
    s.name.toLowerCase().includes(`saison ${seasonNum}`) ||
    s.name.toLowerCase() === `saison ${seasonNum}` ||
    s.name.toLowerCase() === `season ${seasonNum}`
  ) || null;

  if (matchedSeason) {
    const epIdx = episodeNum - 1;
    const matchedEp = (epIdx >= 0 && epIdx < matchedSeason.episodes.length)
      ? matchedSeason.episodes[epIdx]
      : matchedSeason.episodes.find(e => e.index === episodeNum) || null;
    return {
      season: matchedSeason,
      episode: matchedEp,
      resolvedSeasonName: matchedSeason.name,
      resolvedEpisodeNumber: episodeNum
    };
  }

  // 2. Continuous anime season mapping (e.g. Naruto Shippuden, Bleach, One Piece)
  // When Anime-Sama groups episodes continuously under "Avec Fillers" or similar:
  let absoluteEpisode = episodeNum;
  if (Array.isArray(tmdbSeasons) && seasonNum > 1) {
    let sum = 0;
    for (const s of tmdbSeasons) {
      if (s.season_number > 0 && s.season_number < seasonNum) {
        sum += (s.episode_count || 0);
      }
    }
    absoluteEpisode = sum + episodeNum;
  }

  const continuousSeason = animeDataObj.seasons.find(s =>
    s.name.toLowerCase().includes('avec fillers') ||
    s.name.toLowerCase().includes('fillers') ||
    s.name.toLowerCase().includes('épisodes') ||
    s.name.toLowerCase().includes('episodes')
  ) || (animeDataObj.seasons.length > 0
    ? [...animeDataObj.seasons].sort((a, b) => (b.episodes?.length || 0) - (a.episodes?.length || 0))[0]
    : null);

  if (continuousSeason) {
    const absIdx = absoluteEpisode - 1;
    const matchedEp = (absIdx >= 0 && absIdx < continuousSeason.episodes.length)
      ? continuousSeason.episodes[absIdx]
      : continuousSeason.episodes.find(e => e.index === absoluteEpisode) || null;

    if (matchedEp) {
      return {
        season: continuousSeason,
        episode: matchedEp,
        resolvedSeasonName: continuousSeason.name,
        resolvedEpisodeNumber: absoluteEpisode
      };
    }
  }

  // 3. Fallback to array index
  const seasonIdx = seasonNum - 1;
  if (seasonIdx >= 0 && seasonIdx < animeDataObj.seasons.length) {
    const s = animeDataObj.seasons[seasonIdx];
    const epIdx = episodeNum - 1;
    const matchedEp = (epIdx >= 0 && epIdx < s.episodes.length)
      ? s.episodes[epIdx]
      : s.episodes.find(e => e.index === episodeNum) || null;
    return {
      season: s,
      episode: matchedEp,
      resolvedSeasonName: s.name,
      resolvedEpisodeNumber: episodeNum
    };
  }

  return { season: null, episode: null };
};

const getNextEpisodeInfo = (
  animeDataObj: AnimeData | null,
  seasonStr: string,
  episodeStr: string,
  tmdbSeasons?: any[]
): { seasonNumber: number; episodeNumber: number; name?: string } | undefined => {
  if (!seasonStr || !episodeStr) return undefined;
  const currentSeasonNum = Number(seasonStr) || 1;
  const currentEpisodeNum = Number(episodeStr) || 1;

  if (Array.isArray(tmdbSeasons) && tmdbSeasons.length > 0) {
    const currentTmdb = tmdbSeasons.find(s => s.season_number === currentSeasonNum);
    if (currentTmdb && currentEpisodeNum < (currentTmdb.episode_count || 0)) {
      return {
        seasonNumber: currentSeasonNum,
        episodeNumber: currentEpisodeNum + 1,
        name: `Épisode ${currentEpisodeNum + 1}`
      };
    }
    const nextTmdb = tmdbSeasons.find(s => s.season_number === currentSeasonNum + 1);
    if (nextTmdb && (nextTmdb.episode_count || 0) > 0) {
      return {
        seasonNumber: currentSeasonNum + 1,
        episodeNumber: 1,
        name: `Épisode 1`
      };
    }
  }

  if (animeDataObj) {
    const resolved = resolveAnimeSeasonAndEpisode(animeDataObj, seasonStr, episodeStr, tmdbSeasons);
    if (resolved.season && resolved.episode) {
      const epIdx = resolved.season.episodes.findIndex(e => e === resolved.episode);
      if (epIdx >= 0 && epIdx + 1 < resolved.season.episodes.length) {
        return {
          seasonNumber: currentSeasonNum,
          episodeNumber: currentEpisodeNum + 1,
          name: resolved.season.episodes[epIdx + 1]?.name
        };
      }
    }
  }

  // Fallback: toujours permettre d'aller à l'épisode suivant
  return {
    seasonNumber: currentSeasonNum,
    episodeNumber: currentEpisodeNum + 1,
    name: `Épisode ${currentEpisodeNum + 1}`
  };
};

const getPreviousEpisodeInfo = (
  animeDataObj: AnimeData | null,
  seasonStr: string,
  episodeStr: string,
  tmdbSeasons?: any[]
): { seasonNumber: number; episodeNumber: number } | undefined => {
  if (!seasonStr || !episodeStr) return undefined;
  const currentSeasonNum = Number(seasonStr) || 1;
  const currentEpisodeNum = Number(episodeStr) || 1;

  if (currentEpisodeNum > 1) {
    return {
      seasonNumber: currentSeasonNum,
      episodeNumber: currentEpisodeNum - 1
    };
  }

  if (currentSeasonNum > 1 && Array.isArray(tmdbSeasons)) {
    const prevTmdb = tmdbSeasons.find(s => s.season_number === currentSeasonNum - 1);
    if (prevTmdb && (prevTmdb.episode_count || 0) > 0) {
      return {
        seasonNumber: currentSeasonNum - 1,
        episodeNumber: prevTmdb.episode_count
      };
    }
  }

  return undefined;
};

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

  useEffect(() => {
    if (initialSeason && initialSeason !== season) {
      setSeason(initialSeason);
    }
  }, [initialSeason]);

  useEffect(() => {
    if (initialEpisode && initialEpisode !== episode) {
      setEpisode(initialEpisode);
    }
  }, [initialEpisode]);

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

  // Se souvenir automatiquement du choix de fournisseur/langue/lecteur d'un épisode à l'autre pour cet anime.

  const rememberedAnimeLangRef = useRef<string | null>(null);

  const rememberedAnimePlayerNameRef = useRef<string | null>(null);

  const rememberedAnimeIsM3u8Ref = useRef<boolean | null>(null);

  const rememberedAnicloudPlayerNameRef = useRef<string | null>(null);



  const readSavedAnimeChoice = useCallback((animeId: string | null): {

    provider?: 'animesama' | 'wavewatch' | 'anicloud' | 'franime' | 'moviez' | 'vidzy';

    language?: string;

    playerName?: string;

    isM3u8?: boolean;

  } | null => {

    if (!animeId) return null;

    try {

      const raw = localStorage.getItem(`dawger_anime_choice_${animeId}`);

      if (!raw) return null;

      return JSON.parse(raw);

    } catch {

      return null;

    }

  }, []);



  const saveAnimeChoice = useCallback((patch: {

    provider?: 'animesama' | 'wavewatch' | 'anicloud' | 'franime' | 'moviez' | 'vidzy';

    language?: string;

    playerName?: string;

    isM3u8?: boolean;

  }) => {

    if (!id) return;

    try {

      const prev = readSavedAnimeChoice(id) || {};

      const next = { ...prev, ...patch };

      localStorage.setItem(`dawger_anime_choice_${id}`, JSON.stringify(next));

      if (patch.language) rememberedAnimeLangRef.current = patch.language;

      if (patch.playerName) {

        rememberedAnimePlayerNameRef.current = patch.playerName;

        rememberedAnicloudPlayerNameRef.current = patch.playerName;

      }

      if (typeof patch.isM3u8 === 'boolean') {

        rememberedAnimeIsM3u8Ref.current = patch.isM3u8;

      }

    } catch {}

  }, [id, readSavedAnimeChoice]);



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



  // ——— Fournisseur d'anime actif (Anime-Sama prioritaire, Moviez, Vidzy, etc.) ———

  const getInitialAnimeProvider = (): 'animesama' | 'wavewatch' | 'anicloud' | 'franime' | 'moviez' | 'vidzy' => {

    try {

      if (id) {

        const saved = localStorage.getItem(`dawger_anime_choice_${id}`);

        if (saved) {

          const parsed = JSON.parse(saved);

          if (parsed?.provider && ['animesama', 'wavewatch', 'moviez', 'vidzy', 'anicloud', 'franime'].includes(parsed.provider)) {

            return parsed.provider;

          }

        }

      }

      const prefs = getSourcePriorityPrefs();

      const first = (prefs.categories.anime?.sourceOrder || []).find((s) => s.enabled);

      if (first && ['animesama', 'wavewatch', 'moviez', 'vidzy', 'anicloud', 'franime'].includes(first.id)) {

        return first.id as any;

      }

    } catch (_) {}

    return 'animesama';

  };

  const [provider, setProvider] = useState<'animesama' | 'wavewatch' | 'anicloud' | 'franime' | 'moviez' | 'vidzy'>(getInitialAnimeProvider);



  const [sessionEndPref, setSessionEndPref] = useState<boolean>(() => {

    try {

      return localStorage.getItem('dawger_session_end_time') !== 'false';

    } catch {

      return true;

    }

  });



  useEffect(() => {

    const syncPrefs = () => {

      try {

        setSessionEndPref(localStorage.getItem('dawger_session_end_time') !== 'false');

      } catch {}

    };

    window.addEventListener('dawger-player-prefs-changed', syncPrefs);

    window.addEventListener('storage', syncPrefs);

    return () => {

      window.removeEventListener('dawger-player-prefs-changed', syncPrefs);

      window.removeEventListener('storage', syncPrefs);

    };

  }, []);



  const handleBackNav = useCallback(() => {

    if (window.history.length > 1) {

      navigate(-1);

    } else {

      navigate('/anime');

    }

  }, [navigate]);



  // Auto-Fallback & Détection de panne Anime (suit la priorité des sources)

  const handleAutoFallbackNext = useCallback(() => {

    console.log('[WatchAnime] Auto-fallback triggered from provider:', provider);

    try {

      const prefs = getSourcePriorityPrefs();

      const order = (prefs.categories.anime?.sourceOrder || [

        { id: 'animesama', enabled: true },
        { id: 'wavewatch', enabled: true },
        { id: 'moviez', enabled: true },

        { id: 'vidzy', enabled: true },

        { id: 'anicloud', enabled: true },

        { id: 'franime', enabled: true },

      ]).filter((s) => s.enabled).map((s) => s.id);



      const currentIdx = order.indexOf(provider as any);

      if (currentIdx >= 0 && currentIdx < order.length - 1) {

        setProvider(order[currentIdx + 1] as any);

      } else {

        setProvider((order[0] as any) || 'animesama');

      }

    } catch (_) {

      setProvider('moviez');

    }

  }, [provider]);

  // Moviez Anime provider states

  const [moviezAnimeData, setMoviezAnimeData] = useState<any>(null);

  const [loadingMoviezAnime, setLoadingMoviezAnime] = useState<boolean>(false);

  const [moviezAnimeLang, setMoviezAnimeLang] = useState<'vf' | 'vostfr'>('vostfr');

  const [moviezAnimePlayerIdx, setMoviezAnimePlayerIdx] = useState<number>(0);

  const [moviezAnimeError, setMoviezAnimeError] = useState<string | null>(null);



  // Vidzy Anime provider states

  const [vidzyAnimeData, setVidzyAnimeData] = useState<any>(null);

  const [loadingVidzyAnime, setLoadingVidzyAnime] = useState<boolean>(false);

  const [vidzyAnimeLang, setVidzyAnimeLang] = useState<'vf' | 'vostfr'>('vostfr');

  const [vidzyAnimePlayerIdx, setVidzyAnimePlayerIdx] = useState<number>(0);

  const [vidzyAnimeError, setVidzyAnimeError] = useState<string | null>(null);



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

      // Se souvenir automatiquement du lecteur choisi sur un épisode précédent du même anime.

      const savedChoice = readSavedAnimeChoice(id);

      const remembered = rememberedAnicloudPlayerNameRef.current || savedChoice?.playerName || null;

      const rememberedIdx = remembered ? players.findIndex((p: any) => p.player_name?.toLowerCase() === remembered.toLowerCase()) : -1;

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



  // Reset et restaure le choix mémorisé pour cet anime quand l'id change

  useEffect(() => {

    setMoviezAnimeData(null);

    setMoviezAnimeError(null);

    setVidzyAnimeData(null);

    setVidzyAnimeError(null);

    const saved = readSavedAnimeChoice(id);

    if (saved) {

      if (saved.provider && ['animesama', 'wavewatch', 'moviez', 'vidzy', 'anicloud', 'franime'].includes(saved.provider)) {

        setProvider(saved.provider);

      }

      if (saved.language) {

        rememberedAnimeLangRef.current = saved.language;

        const l = saved.language.toLowerCase();

        if (l === 'vf' || l === 'vostfr') {

          setMoviezAnimeLang(l);

          setVidzyAnimeLang(l);

          setAnicloudLang(l);

        }

        setFranimeLang(l);

      }

      if (saved.playerName) {

        rememberedAnimePlayerNameRef.current = saved.playerName;

        rememberedAnicloudPlayerNameRef.current = saved.playerName;

      }

      if (typeof saved.isM3u8 === 'boolean') {

        rememberedAnimeIsM3u8Ref.current = saved.isM3u8;

      }

    } else {

      rememberedAnimeLangRef.current = null;

      rememberedAnimePlayerNameRef.current = null;

      rememberedAnimeIsM3u8Ref.current = null;

      rememberedAnicloudPlayerNameRef.current = null;

    }

  }, [id, readSavedAnimeChoice]);



  // Charge Moviez quand le fournisseur moviez est actif ou quand saison/épisode change

  useEffect(() => {

    if (provider !== 'moviez') return;

    if (!id) return;

    let cancelled = false;

    setLoadingMoviezAnime(true);

    setMoviezAnimeError(null);

    const epUrl = isMovieMode

      ? `${MAIN_API}/api/moviez/movie/${id}`

      : `${MAIN_API}/api/moviez/tv/${id}/season/${season}/episode/${episode}`;



    axios.get(epUrl)

      .then(res => {

        if (cancelled) return;

        const data = res.data;

        setMoviezAnimeData(data);

        const saved = readSavedAnimeChoice(id);

        const prefLang = (saved?.language?.toLowerCase() === 'vf' || saved?.language?.toLowerCase() === 'vostfr')

          ? (saved.language.toLowerCase() as 'vf' | 'vostfr')

          : moviezAnimeLang;

        const effectiveLang: 'vf' | 'vostfr' = data?.players?.[prefLang]?.length > 0

          ? prefLang

          : (data?.players?.vostfr?.length > 0 ? 'vostfr' : 'vf');

        setMoviezAnimeLang(effectiveLang);

        const list = data?.players?.[effectiveLang] || [];

        const remName = (saved?.playerName || rememberedAnimePlayerNameRef.current || '').toLowerCase();

        const matchIdx = remName ? list.findIndex((p: any) => (p.name || '').toLowerCase() === remName) : -1;

        setMoviezAnimePlayerIdx(matchIdx >= 0 ? matchIdx : 0);

      })

      .catch(() => {

        if (!cancelled) setMoviezAnimeError('Anime/Épisode non trouvé sur Moviez');
        try { localStorage.removeItem(`dawger_anime_choice_${id}`); } catch (_) {}
        setProvider('animesama');

      })

      .finally(() => {

        if (!cancelled) setLoadingMoviezAnime(false);

      });

    return () => { cancelled = true; };

  }, [provider, id, season, episode, isMovieMode]);



  // Charge Vidzy quand le fournisseur vidzy est actif ou quand saison/épisode change

  useEffect(() => {

    if (provider !== 'vidzy') return;

    if (!id) return;

    let cancelled = false;

    setLoadingVidzyAnime(true);

    setVidzyAnimeError(null);

    const epUrl = isMovieMode

      ? `${MAIN_API}/api/vidzy/movie/${id}`

      : `${MAIN_API}/api/vidzy/tv/${id}/season/${season}/episode/${episode}`;



    axios.get(epUrl)

      .then(res => {

        if (cancelled) return;

        const data = res.data;

        setVidzyAnimeData(data);

        const saved = readSavedAnimeChoice(id);

        const prefLang = (saved?.language?.toLowerCase() === 'vf' || saved?.language?.toLowerCase() === 'vostfr')

          ? (saved.language.toLowerCase() as 'vf' | 'vostfr')

          : vidzyAnimeLang;

        const effectiveLang: 'vf' | 'vostfr' = data?.players?.[prefLang]?.length > 0

          ? prefLang

          : (data?.players?.vostfr?.length > 0 ? 'vostfr' : 'vf');

        setVidzyAnimeLang(effectiveLang);

        const list = data?.players?.[effectiveLang] || [];

        const remName = (saved?.playerName || rememberedAnimePlayerNameRef.current || '').toLowerCase();

        const matchIdx = remName ? list.findIndex((p: any) => (p.name || '').toLowerCase() === remName) : -1;

        setVidzyAnimePlayerIdx(matchIdx >= 0 ? matchIdx : 0);

      })

      .catch(() => {

        if (!cancelled) setVidzyAnimeError('Anime/Épisode non trouvé sur Vidzy');
        try { localStorage.removeItem(`dawger_anime_choice_${id}`); } catch (_) {}
        setProvider('animesama');

      })

      .finally(() => {

        if (!cancelled) setLoadingVidzyAnime(false);

      });

    return () => { cancelled = true; };

  }, [provider, id, season, episode, isMovieMode]);



  // Désactiver showHLSPlayer et effacer l'erreur Anime-Sama si on bascule sur un provider externe

  useEffect(() => {

    if (provider !== 'animesama') {

      setShowHLSPlayer(false);

      setError(null);

    }

  }, [provider]);



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

        } else {

          // Anime-Sama indisponible ou pas de saisons trouvées -> bascule selon l'ordre de priorité utilisateur

          handleAutoFallbackNext();

          setLoading(false);

        }

      } else {

        // Anime-Sama recherche sans résultat -> bascule selon l'ordre de priorité utilisateur

        handleAutoFallbackNext();

        setLoading(false);

      }

    } catch (error) {

      console.error('Error loading anime data:', error);

      handleAutoFallbackNext();

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
      const resolved = resolveAnimeSeasonAndEpisode(animeData, season, episode, showDetails?.seasons);
      const finalSeason = resolved.season;
      const currentEpisode = resolved.episode;

      if (finalSeason && currentEpisode) {
        console.log(`[WatchAnime] Resolved season: ${finalSeason.name}, episode: ${currentEpisode.name} (abs: ${resolved.resolvedEpisodeNumber})`);
        const availLangs = currentEpisode.streaming_links.map(link => link.language);
        setAvailableLanguages(availLangs);

        const savedChoice = readSavedAnimeChoice(id);
        const remembered = rememberedAnimeLangRef.current || savedChoice?.language || null;
        const matchingLang = remembered
          ? availLangs.find(l => l.toLowerCase() === remembered.toLowerCase())
          : undefined;

        if (matchingLang) {
          setSelectedLanguage(matchingLang);
        } else {
          const picked = pickAutoSelectedLanguage(availLangs);
          if (picked) {
            setSelectedLanguage(picked);
          } else if (availLangs.length > 0) {
            setSelectedLanguage(availLangs[0]);
          }
        }
      } else {
        const availableSeasons = animeData.seasons.map(s => `${s.name} (${s.episodes?.length || 0} ép.)`).join(', ');
        setError(t('watch.episodeNotFoundInSeason', { episode, season, maxEpisodes: finalSeason?.episodes?.length || 0 }) || `Épisode non trouvé. Saisons dispos: ${availableSeasons}`);
        setLoading(false);
      }
    }
  }, [animeData, season, episode, showDetails?.seasons]);

  // Process video sources
  useEffect(() => {
    if (animeData && season && episode) {
      const resolved = resolveAnimeSeasonAndEpisode(animeData, season, episode, showDetails?.seasons);
      if (resolved.episode) {
        if (isInitialLoad || !selectedSource) {
          processVideoSources(resolved.episode);
        }
      }
    }
  }, [animeData, season, episode, isInitialLoad, selectedSource, showDetails?.seasons]);

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
    const requestKey = `${id}-${season}-${episode}`;
    const sources: VideoSource[] = [];
    const detectPrefs = getSourcePriorityPrefs();

    for (const streamingLink of animeEpisode.streaming_links) {
      const players = streamingLink.players;

      for (const playerUrl of players) {
        const playerUrlString = typeof playerUrl === 'string' ? playerUrl : String(playerUrl);

        if (playerUrlString.includes('anime-sama.fr') || playerUrlString.includes('anime-sama.to')) {
          continue;
        }

        const hoster = detectHoster(playerUrlString, {
          patternOverrides: detectPrefs.patternOverrides,
          customHosters: detectPrefs.customHosters,
        });

        if (hoster === 'vidmoly') {
          const vidmolyUrl = /vidmoly\.to/i.test(playerUrlString)
            ? toCanonicalHosterDomain(playerUrlString, 'vidmoly')
            : playerUrlString;
          const displayName = getHosterDisplayName(vidmolyUrl, 'vidmoly');

          sources.push({
            language: streamingLink.language,
            quality: 'Auto',
            url: vidmolyUrl,
            player: displayName,
            hosterId: 'vidmoly',
            label: `${streamingLink.language.toUpperCase()} - ${displayName}`,
            id: `vidmoly-${streamingLink.language}-${vidmolyUrl}`
          });
        } else if (hoster === 'sibnet') {
          sources.push({
            language: streamingLink.language,
            quality: 'Auto',
            url: playerUrlString,
            player: 'Sibnet',
            hosterId: 'sibnet',
            label: `${streamingLink.language.toUpperCase()} - Sibnet`,
            id: `sibnet-${streamingLink.language}-${playerUrlString}`
          });
        } else if (hoster === 'oneupload') {
          sources.push({
            language: streamingLink.language,
            quality: 'Auto',
            url: playerUrlString,
            player: 'OneUpload',
            hosterId: 'oneupload',
            label: `${streamingLink.language.toUpperCase()} - OneUpload`,
            id: `oneupload-${streamingLink.language}-${playerUrlString}`
          });
        } else {
          let playerName = hoster ? getHosterDisplayName(playerUrlString, hoster as any) : 'Unknown';
          if (!hoster || playerName === 'Unknown') {
            try {
              const url = new URL(playerUrlString);
              const domainParts = url.hostname.replace(/^www\./, '').split('.');
              if (domainParts.length >= 2) {
                playerName = domainParts[domainParts.length - 2];
                playerName = playerName.charAt(0).toUpperCase() + playerName.slice(1);
              }
            } catch {
              const domainMatch = playerUrlString.match(/https?:\/\/(?:www\.)?([^/]+)/i);
              if (domainMatch && domainMatch[1]) {
                const domain = domainMatch[1].split('.')[0];
                playerName = domain.charAt(0).toUpperCase() + domain.slice(1);
              }
            }
          }

          sources.push({
            language: streamingLink.language,
            quality: 'Auto',
            url: playerUrlString,
            player: playerName,
            hosterId: hoster || playerName.toLowerCase(),
            label: `${streamingLink.language.toUpperCase()} - ${playerName}`,
            id: `${(hoster || playerName).toLowerCase()}-${streamingLink.language}-${playerUrlString}`
          });
        }
      }
    }

    // Extraction pass
    const embedSources = [...sources];
    if (embedSources.length > 0) {
      setLoadingVidmolyExtraction(true);
      setLoadingSibnetExtraction(true);
      setExtractionProgress(t('watch.extractingSources', { provider: 'Anime' }));

      try {
        const animePass = await runExtractionPass(
          embedSources.map(source => ({
            url: source.url,
            label: source.label,
            language: source.language,
            player: source.player,
            meta: { language: source.language, displayName: source.player, hosterId: source.hosterId },
          })),
          MAIN_API,
          {
            origin: 'anime-sama',
            context: { category: 'anime' },
            allowedHosters: getSourcePriorityPrefs().categories.anime.hosterOrder,
          },
        );

        for (const extracted of [...animePass.hls, ...animePass.file]) {
          const language = typeof extracted.meta?.language === 'string' ? extracted.meta.language : '';
          if (!language) continue;
          const hosterId = typeof extracted.meta?.hosterId === 'string' && extracted.meta.hosterId
            ? extracted.meta.hosterId
            : extracted.source.split('-')[0];
          const playerName = typeof extracted.meta?.displayName === 'string' && extracted.meta.displayName
            ? extracted.meta.displayName
            : hosterId.charAt(0).toUpperCase() + hosterId.slice(1);

          sources.push({
            language,
            quality: 'Auto',
            url: extracted.url,
            player: playerName,
            label: `${language.toUpperCase()} - ${playerName} HLS`,
            isM3u8: true,
            hosterId,
            id: `${hosterId}-hls-${language}-${extracted.url}`,
          });
        }
      } catch (err) {
        console.warn('[WatchAnime] runExtractionPass error:', err);
      } finally {
        setLoadingVidmolyExtraction(false);
        setLoadingSibnetExtraction(false);
      }
    }

    // Sort by priority
    const annotated = sources.map((s) => {
      if (s.hosterId) return { source: s, type: s.hosterId };
      const detected = detectHoster(s.url, {
        patternOverrides: detectPrefs.patternOverrides,
        customHosters: detectPrefs.customHosters,
      });
      return { source: s, type: detected ?? s.player.toLowerCase() };
    });
    const sorted = sortHostersByPriority(annotated, {
      category: 'anime',
      topLevel: selectedLanguage,
    });
    const sortedSources = sorted.map((a) => a.source);

    if (currentRequestKeyRef.current !== requestKey) return;

    setVideoSources(sortedSources);
    setExtractionProgress('');
  };

  // Auto-selection of best source
  const selectBestSource = useCallback(() => {
    if (videoSources.length === 0) return;

    const filteredSources = videoSources.filter(source =>
      source.language?.toLowerCase() === selectedLanguage.toLowerCase()
    );

    const sourcesToSearch = filteredSources.length > 0 ? filteredSources : videoSources;
    let sourceToSelect: VideoSource | null = null;

    const savedChoice = readSavedAnimeChoice(id);
    const remPlayer = (rememberedAnimePlayerNameRef.current || savedChoice?.playerName || '').toLowerCase();
    const remIsM3u8 = rememberedAnimeIsM3u8Ref.current ?? savedChoice?.isM3u8;

    if (remPlayer) {
      if (typeof remIsM3u8 === 'boolean') {
        sourceToSelect = sourcesToSearch.find(source =>
          source.player?.toLowerCase() === remPlayer && Boolean(source.isM3u8) === remIsM3u8
        ) || null;
      }
      if (!sourceToSelect) {
        sourceToSelect = sourcesToSearch.find(source =>
          source.player?.toLowerCase() === remPlayer
        ) || null;
      }
    }

    if (!sourceToSelect && sourcesToSearch.length > 0) {
      sourceToSelect = sourcesToSearch.find(s => s.isM3u8) || sourcesToSearch[0];
    }

    if (sourceToSelect) {
      console.log('[WatchAnime] Auto-selected source:', sourceToSelect.label);
      handleSelectSource(sourceToSelect);
    }
  }, [videoSources, selectedLanguage, id]);

  useEffect(() => {
    if (videoSources.length > 0 && isInitialLoad) {
      selectBestSource();
      setIsInitialLoad(false);
    }
  }, [videoSources, isInitialLoad, selectBestSource]);

  // Handle source selection

  const handleSelectSource = (source: VideoSource) => {
    setIsInitialLoad(false);
    setSelectedSource(source);

    saveAnimeChoice({

      provider: 'animesama',

      language: source.language || selectedLanguage,

      playerName: source.player,

      isM3u8: Boolean(source.isM3u8),

    });



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



  // Handle next episode
  const handleNextEpisode = () => {
    if (!id) return;
    const next = getNextEpisodeInfo(animeData, season, episode, showDetails?.seasons);
    if (next) {
      setSeason(String(next.seasonNumber));
      setEpisode(String(next.episodeNumber));
    }
  };

  // Handle previous episode
  const handlePreviousEpisode = () => {
    if (!id) return;
    const prev = getPreviousEpisodeInfo(animeData, season, episode, showDetails?.seasons);
    if (prev) {
      setSeason(String(prev.seasonNumber));
      setEpisode(String(prev.episodeNumber));
    }
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



      {/* Barre de navigation d'épisodes extraite hors du lecteur */}

      {!isMovieMode && (

        <div className="mb-3 relative z-[10500] flex flex-wrap items-center justify-center gap-2 sm:gap-3">

          {!(Number(season) === 1 && Number(episode) === 1) && (

            <button

              onClick={handlePreviousEpisode}

              className="flex items-center gap-2 px-3.5 py-2 rounded-xl text-white text-sm font-medium bg-white/[0.05] hover:bg-emerald-500/15 border border-white/10 hover:border-emerald-500/40 transition-all duration-200 shadow-lg"

              title={`Épisode précédent (S${Number(season)}:${String(Math.max(1, Number(episode) - 1)).padStart(2, '0')})`}

            >

              <svg className="w-4 h-4 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">

                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" />

              </svg>

              <span>

                {Number(episode) > 1

                  ? `S${Number(season)}:${String(Number(episode) - 1).padStart(2, '0')}`

                  : Number(season) > 1

                    ? `S${Number(season) - 1}:01`

                    : `S1:01`}

              </span>

            </button>

          )}



          <button

            onClick={() => setShowEpisodesMenu(!showEpisodesMenu)}

            className={`flex items-center gap-2.5 px-4 py-2 rounded-xl text-sm font-semibold transition-all duration-200 shadow-lg border ${

              showEpisodesMenu

                ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-300'

                : 'bg-white/[0.06] hover:bg-emerald-500/15 border-white/15 hover:border-emerald-500/40 text-white'

            }`}

            title={t('watch.episodes')}

          >

            <svg className="w-4 h-4 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">

              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h7" />

            </svg>

            <span>Saison {season} • Ép. {episode}</span>

            <span className="text-white/50 hidden sm:inline">— {t('watch.episodes')}</span>

            <svg className={`w-4 h-4 text-white/60 transition-transform duration-200 ${showEpisodesMenu ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">

              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />

            </svg>

          </button>



          {(() => {
            const nextInfo = getNextEpisodeInfo(animeData, season, episode, showDetails?.seasons);
            if (!nextInfo) return null;
            const nextLabel = `S${nextInfo.seasonNumber}:${String(nextInfo.episodeNumber).padStart(2, '0')}`;

            return (
              <button
                onClick={handleNextEpisode}
                className="flex items-center gap-2 px-3.5 py-2 rounded-xl text-white text-sm font-medium bg-white/[0.05] hover:bg-emerald-500/15 border border-white/10 hover:border-emerald-500/40 transition-all duration-200 shadow-lg"
                title={`Épisode suivant (${nextLabel})`}
              >
                <span>{nextLabel}</span>
                <svg className="w-4 h-4 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
                </svg>
              </button>
            );
          })()}



          {/* Menu déroulant des saisons et épisodes Anime (optimisé et compact) */}

          <AnimatePresence>

            {showEpisodesMenu && (

              <motion.div

                initial={{ opacity: 0, y: -10 }}

                animate={{ opacity: 1, y: 0 }}

                exit={{ opacity: 0, y: -10 }}

                transition={{ duration: 0.18 }}

                className="absolute top-full mt-2 left-1/2 -translate-x-1/2 z-[12000] bg-neutral-950/95 backdrop-blur-xl border border-white/15 rounded-2xl shadow-2xl w-[min(92vw,24rem)] max-h-[65vh] overflow-hidden flex flex-col"

              >

                <div className="p-3 border-b border-white/10 flex items-center gap-2">

                  <div className="relative flex-1">

                    <button

                      onClick={() => setShowSeasonDropdown(!showSeasonDropdown)}

                      className="w-full flex items-center justify-between bg-white/[0.06] hover:bg-white/[0.1] border border-white/10 rounded-xl px-3.5 py-2 text-sm text-white transition-colors duration-200"

                    >

                      <span className="font-semibold truncate">

                        {animeData?.seasons[displayedSeasonNumber - 1]?.name || t('watch.seasonN', { n: displayedSeasonNumber })}

                      </span>

                      <motion.div

                        animate={{ rotate: showSeasonDropdown ? 180 : 0 }}

                        transition={{ duration: 0.2 }}

                        className="ml-2 flex-shrink-0 text-emerald-400"

                      >

                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">

                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />

                        </svg>

                      </motion.div>

                    </button>



                    <AnimatePresence>

                      {showSeasonDropdown && (

                        <motion.div

                          initial={{ opacity: 0, y: -8 }}

                          animate={{ opacity: 1, y: 0 }}

                          exit={{ opacity: 0, y: -8 }}

                          transition={{ duration: 0.15 }}

                          className="absolute top-full left-0 right-0 mt-1 bg-neutral-900 border border-white/15 rounded-xl shadow-xl max-h-56 overflow-y-auto z-20 custom-scrollbar"

                          data-lenis-prevent

                        >

                          {(animeData?.seasons || [{ name: `Saison ${season}`, episodes: Array.from({ length: 24 }) }]).map((s: any, index: number) => (

                            <button

                              key={index}

                              onClick={() => {

                                setDisplayedSeasonNumber(index + 1);

                                setShowSeasonDropdown(false);

                              }}

                              className={`w-full text-left px-3.5 py-2.5 text-sm flex items-center justify-between transition-colors duration-150 ${displayedSeasonNumber === index + 1

                                ? 'bg-emerald-900/40 text-emerald-300 font-semibold'

                                : 'text-gray-200 hover:bg-white/10'

                                }`}

                            >

                              <span className="truncate">{s.name}</span>

                              <span className="text-xs text-gray-400 ml-2 flex-shrink-0">{s.episodes?.length || 24} ép.</span>

                            </button>

                          ))}

                        </motion.div>

                      )}

                    </AnimatePresence>

                  </div>



                  <button

                    onClick={() => setShowEpisodesMenu(false)}

                    className="text-gray-400 hover:text-white p-2 rounded-xl hover:bg-white/10 transition-colors flex-shrink-0"

                    title="Fermer"

                  >

                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">

                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />

                    </svg>

                  </button>

                </div>



                <div className="flex-1 overflow-y-auto p-2 custom-scrollbar" data-lenis-prevent>

                  <div className="flex flex-col gap-1">

                    {(animeData?.seasons[displayedSeasonNumber - 1]?.episodes || Array.from({ length: 24 }, (_, i) => ({ name: `Épisode ${i + 1}` }))).map((ep: any, index: number) => {

                      const epNum = index + 1;

                      const isCurrent = Number(episode) === epNum && displayedSeasonNumber === Number(season);

                      const rawName = (ep.name || '').trim();

                      const cleanName = rawName.replace(new RegExp(`^(?:épisode|episode|ep\\.?)\\s*${epNum}\\s*[:\\-–]?\\s*`, 'i'), '').trim();

                      const displayTitle = cleanName || `Épisode ${epNum}`;

                      return (

                        <button

                          key={index}

                          onClick={() => {

                            if (!id) return;

                            setSeason(String(displayedSeasonNumber));

                            setEpisode(String(epNum));

                            setShowEpisodesMenu(false);

                          }}

                          className={`flex items-center gap-3 px-3 py-2 rounded-xl text-left transition-all duration-150 ${isCurrent

                            ? 'bg-emerald-500/15 border border-emerald-500/40 text-emerald-300'

                            : 'hover:bg-white/[0.06] border border-transparent text-gray-200 hover:text-white'

                            }`}

                        >

                          <span className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 text-xs font-bold ${isCurrent

                            ? 'bg-emerald-500 text-black'

                            : 'bg-white/[0.07] text-emerald-400'

                            }`}>

                            {epNum}

                          </span>

                          <span className="flex-1 text-sm font-medium truncate">

                            {displayTitle}

                          </span>

                        </button>

                      );

                    })}

                  </div>

                </div>

              </motion.div>

            )}

          </AnimatePresence>

        </div>

      )}



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

      ) : (loading && provider === 'animesama') ? (

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

      ) : (error && provider === 'animesama') && fallbackEmbedSource && id ? (

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

      ) : (error && provider === 'animesama') ? (

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
                  <button
                    className="bg-emerald-600 hover:bg-emerald-500 text-white font-medium px-4 py-2 rounded-md transition-colors"
                    onClick={() => {
                      setProvider('wavewatch');
                      saveAnimeChoice({ provider: 'wavewatch' });
                    }}
                  >
                    Wavewatch (Multi)
                  </button>
                  <button style={{display: "none"}}

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

        <div className="relative w-full h-full">

          {/* Source Selection Panel */}

          <AnimatePresence>

            {showEmbedQuality && (

              <div onClick={() => setShowEmbedQuality(false)} className="fixed inset-0 z-[12000] bg-black/60 flex justify-start pointer-events-auto">

                <motion.div

                  key="embed-quality-menu"

                  initial={{ opacity: 0, x: -300 }}

                  animate={{ opacity: 1, x: 0 }}

                  exit={{ opacity: 0, x: -300 }}

                  transition={{ duration: 0.3, ease: 'easeOut' }}

                  onClick={(e) => e.stopPropagation()}

                  className="bg-black/95 border-r border-gray-800 shadow-2xl w-full max-w-md h-full overflow-y-auto pointer-events-auto"

                  data-lenis-prevent

                >

                  <div className="flex justify-between items-center p-4 border-b border-gray-700/60 sticky top-0 bg-black/95 z-10">

                    <h3 className="text-white text-lg font-bold">{t('watch.sourcesAndLanguages')}</h3>

                    <button

                      onClick={() => setShowEmbedQuality(false)}

                      className="text-gray-400 hover:text-emerald-400 transition-colors text-2xl font-bold focus:outline-none"

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



                    {/* Fournisseur — Anime-Sama / Moviez / Vidzy / AniCloud / FRAnime */}

                    <div className="mb-6">

                      <h4 className="text-white text-md font-semibold mb-3">Fournisseur</h4>

                      <div className="space-y-2">

                        {(() => {

                          const prefs = getSourcePriorityPrefs();

                          const order = (prefs.categories.anime?.sourceOrder || []).filter(s => s.enabled).map(s => s.id);

                          const allProviders = [
                            { key: 'animesama', label: 'Anime-Sama', badge: 'Prioritaire' },
                            { key: 'wavewatch', label: 'Wavewatch (Multi/VOSTFR)' },
                            { key: 'moviez', label: 'Moviez (Ultra HD)' },

                            { key: 'vidzy', label: 'Vidzy Direct' },

                            { key: 'anicloud', label: 'AniCloud' },

                            { key: 'franime', label: 'FRAnime' },

                          ];

                          return allProviders.sort((a, b) => {

                            const idxA = order.indexOf(a.key as any);

                            const idxB = order.indexOf(b.key as any);

                            if (idxA === -1 && idxB === -1) return 0;

                            if (idxA === -1) return 1;

                            if (idxB === -1) return -1;

                            return idxA - idxB;

                          });

                        })().map(p => (

                          <button

                            key={p.key}

                            onClick={() => { setProvider(p.key as any); saveAnimeChoice({ provider: p.key as any }); }}

                            className={`w-full px-4 py-3 text-sm text-left rounded-lg flex justify-between items-center transition-all duration-200 ${provider === p.key

                              ? 'bg-gray-800 border-l-4 border-emerald-500 pl-3 font-medium text-emerald-400'

                              : 'bg-gray-900/60 hover:bg-gray-800/80 text-gray-200 hover:text-white'

                              }`}

                          >

                            <span className="flex items-center gap-2">

                              {p.label}

                              {'badge' in p && (

                                <span className="text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">

                                  {p.badge}

                                </span>

                              )}

                            </span>

                            {provider === p.key && (

                              <span className="text-xs px-2 py-1 bg-emerald-600 text-white rounded-full">{t('watch.active')}</span>

                            )}

                          </button>

                        ))}

                      </div>

                    </div>



                    {/* Moviez API — langue + lecteurs */}

                    {provider === 'wavewatch' && (
                      <div className="mb-6 p-4 rounded-xl bg-gray-900/60 border border-gray-800 text-sm text-gray-300">
                        <p className="font-semibold text-emerald-400 mb-1">Lecteur Wavewatch Multilingue</p>
                        <p className="text-xs text-gray-400">Audio (VF/VO) et sous-titres (VOSTFR) sont sélectionnables directement dans les options du lecteur intégré ci-dessous.</p>
                      </div>
                    )}

                    {provider === 'moviez' && (

                      <div className="mb-6">

                        {loadingMoviezAnime ? (

                          <div className="flex items-center justify-center py-6">

                            <svg className="animate-spin h-6 w-6 text-indigo-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">

                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />

                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />

                            </svg>

                          </div>

                        ) : moviezAnimeError || !moviezAnimeData ? (

                          <p className="text-gray-400 text-sm">{moviezAnimeError ?? 'Non disponible sur Moviez'}</p>

                        ) : (

                          <>

                            <h4 className="text-white text-md font-semibold mb-3">{t('watch.versionLabel')}</h4>

                            <div className="grid grid-cols-2 gap-2 mb-4">

                              {(['vf', 'vostfr'] as const).map(lang => {

                                const hasLang = moviezAnimeData.players?.[lang]?.length > 0;

                                if (!hasLang) return null;

                                return (

                                  <button key={lang} onClick={() => { setMoviezAnimeLang(lang); setMoviezAnimePlayerIdx(0); saveAnimeChoice({ provider: 'moviez', language: lang, playerName: moviezAnimeData.players?.[lang]?.[0]?.name }); }}

                                    className={`px-3 py-2 rounded-lg text-sm transition-all duration-200 ${moviezAnimeLang === lang ? 'bg-gray-800 border-l-4 border-emerald-500 pl-3 font-medium text-emerald-400' : 'bg-gray-900/60 hover:bg-gray-800/80 text-gray-200'}`}>

                                    {lang.toUpperCase()}

                                  </button>

                                );

                              })}

                            </div>

                            {moviezAnimeData.players?.[moviezAnimeLang]?.length > 0 && (

                              <>

                                <h4 className="text-white text-md font-semibold mb-3">{t('watch.playersLabel')}</h4>

                                <div className="space-y-2">

                                  {moviezAnimeData.players[moviezAnimeLang].map((p: any, i: number) => (

                                    <button key={`m-${i}`} onClick={() => { setMoviezAnimePlayerIdx(i); saveAnimeChoice({ provider: 'moviez', language: moviezAnimeLang, playerName: p.name }); setShowEmbedQuality(false); }}

                                      className={`w-full px-4 py-3 text-sm text-left rounded-lg flex justify-between items-center ${moviezAnimePlayerIdx === i ? 'bg-gray-800 border-l-4 border-emerald-500 pl-3 font-medium text-emerald-400' : 'bg-gray-900/60 hover:bg-gray-800/80 text-gray-200 hover:text-white'}`}>

                                      {formatPlayerDisplayName(p.name)}

                                      {moviezAnimePlayerIdx === i && (

                                        <span className="text-xs px-2 py-1 bg-emerald-600 text-white rounded-full">{t('watch.active')}</span>

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



                    {/* Vidzy Direct — langue + lecteurs */}

                    {provider === 'vidzy' && (

                      <div className="mb-6">

                        {loadingVidzyAnime ? (

                          <div className="flex items-center justify-center py-6">

                            <svg className="animate-spin h-6 w-6 text-cyan-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">

                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />

                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />

                            </svg>

                          </div>

                        ) : vidzyAnimeError || !vidzyAnimeData ? (

                          <p className="text-gray-400 text-sm">{vidzyAnimeError ?? 'Non disponible sur Vidzy'}</p>

                        ) : (

                          <>

                            <h4 className="text-white text-md font-semibold mb-3">{t('watch.versionLabel')}</h4>

                            <div className="grid grid-cols-2 gap-2 mb-4">

                              {(['vf', 'vostfr'] as const).map(lang => {

                                const hasLang = vidzyAnimeData.players?.[lang]?.length > 0;

                                if (!hasLang) return null;

                                return (

                                  <button key={lang} onClick={() => { setVidzyAnimeLang(lang); setVidzyAnimePlayerIdx(0); saveAnimeChoice({ provider: 'vidzy', language: lang, playerName: vidzyAnimeData.players?.[lang]?.[0]?.name }); }}

                                    className={`px-3 py-2 rounded-lg text-sm transition-all duration-200 ${vidzyAnimeLang === lang ? 'bg-gray-800 border-l-4 border-emerald-500 pl-3 font-medium text-emerald-400' : 'bg-gray-900/60 hover:bg-gray-800/80 text-gray-200'}`}>

                                    {lang.toUpperCase()}

                                  </button>

                                );

                              })}

                            </div>

                            {vidzyAnimeData.players?.[vidzyAnimeLang]?.length > 0 && (

                              <>

                                <h4 className="text-white text-md font-semibold mb-3">{t('watch.playersLabel')}</h4>

                                <div className="space-y-2">

                                  {vidzyAnimeData.players[vidzyAnimeLang].map((p: any, i: number) => (

                                    <button key={`v-${i}`} onClick={() => { setVidzyAnimePlayerIdx(i); saveAnimeChoice({ provider: 'vidzy', language: vidzyAnimeLang, playerName: p.name }); setShowEmbedQuality(false); }}

                                      className={`w-full px-4 py-3 text-sm text-left rounded-lg flex justify-between items-center ${vidzyAnimePlayerIdx === i ? 'bg-gray-800 border-l-4 border-emerald-500 pl-3 font-medium text-emerald-400' : 'bg-gray-900/60 hover:bg-gray-800/80 text-gray-200 hover:text-white'}`}>

                                      {formatPlayerDisplayName(p.name)}

                                      {vidzyAnimePlayerIdx === i && (

                                        <span className="text-xs px-2 py-1 bg-emerald-600 text-white rounded-full">{t('watch.active')}</span>

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

                                <button key={lang} onClick={() => { setAnicloudLang(lang); saveAnimeChoice({ provider: 'anicloud', language: lang }); }}

                                  className={`px-3 py-2 rounded-lg text-sm transition-all duration-200 ${anicloudLang === lang ? 'bg-gray-800 border-l-4 border-emerald-500 pl-3 font-medium text-emerald-400' : 'bg-gray-900/60 hover:bg-gray-800/80 text-gray-200'}`}>

                                  {lang.toUpperCase()}

                                </button>

                              ))}

                            </div>

                            {anicloudPlayers.length > 0 && (

                              <>

                                <h4 className="text-white text-md font-semibold mb-3">{t('watch.playersLabel')}</h4>

                                <div className="space-y-2">

                                  {anicloudPlayers.map((p, i) => (

                                    <button key={p.id} onClick={() => { setAnicloudPlayerIdx(i); rememberedAnicloudPlayerNameRef.current = p.player_name; saveAnimeChoice({ provider: 'anicloud', language: anicloudLang, playerName: p.player_name }); setShowEmbedQuality(false); }}

                                      className={`w-full px-4 py-3 text-sm text-left rounded-lg flex justify-between items-center ${anicloudPlayerIdx === i ? 'bg-gray-800 border-l-4 border-emerald-500 pl-3 font-medium text-emerald-400' : 'bg-gray-900/60 hover:bg-gray-800/80 text-gray-200 hover:text-white'}`}>

                                      {formatPlayerDisplayName(p.player_name)}

                                      {anicloudPlayerIdx === i && (

                                        <span className="text-xs px-2 py-1 bg-emerald-600 text-white rounded-full">{t('watch.active')}</span>

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

                                <button key={lang} onClick={() => { setFranimeLang(lang); saveAnimeChoice({ provider: 'franime', language: lang }); setShowEmbedQuality(false); }}

                                  className={`px-3 py-2 rounded-lg text-sm transition-all duration-200 ${franimeLang === lang ? 'bg-gray-800 border-l-4 border-emerald-500 pl-3 font-medium text-emerald-400' : 'bg-gray-900/60 hover:bg-gray-800/80 text-gray-200'}`}>

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

                          <svg className="w-5 h-5 mr-2 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">

                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 5h12M9 3v2m1.048 9.5A18.022 18.022 0 016.412 9m6.088 9h7M11 21l5-10 5 10M12.751 5C11.783 10.77 8.07 15.61 3 18.129" />

                          </svg>

                          {t('watch.versionLabel')}

                        </h4>

                        <div className="grid grid-cols-2 gap-2 mb-4">

                          {availableLanguages.map(lang => (

                            <div

                              key={lang}

                              className={`relative flex items-center rounded-lg transition-all duration-200 ${selectedLanguage === lang

                                ? 'bg-gray-800 border-l-4 border-emerald-500 pl-3 font-medium text-emerald-400'

                                : 'bg-gray-900/60 hover:bg-gray-800/80 text-gray-200 hover:text-white'

                                }`}

                            >

                              <button

                                className="flex-1 px-3 py-2 flex items-center justify-center"

                                onClick={() => {

                                  setSelectedLanguage(lang);

                                  rememberedAnimeLangRef.current = lang;

                                  saveAnimeChoice({ provider: 'animesama', language: lang });

                                  const matchingInLang = videoSources.filter(s => s.language?.toLowerCase() === lang.toLowerCase());

                                  if (matchingInLang.length > 0) {

                                    const remP = rememberedAnimePlayerNameRef.current?.toLowerCase();

                                    const nextSrc = (remP && matchingInLang.find(s => s.player?.toLowerCase() === remP)) || matchingInLang[0];

                                    if (nextSrc) handleSelectSource(nextSrc);

                                  }

                                }}

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

                        <svg className="w-5 h-5 mr-2 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">

                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />

                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />

                        </svg>

                        {t('watch.playersLabel')}

                      </h4>



                      {/* Current Selected Source Info */}

                      {selectedSource && (

                        <div className="bg-gray-800/60 rounded-lg p-3 mb-4 border-l-4 border-emerald-500">

                          <div className="flex items-center justify-between">

                            <div>

                              <p className="text-emerald-400 text-sm font-medium">{t('watch.currentSource')}</p>

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

                                ? 'bg-gray-800 border-l-4 border-emerald-500 pl-3'

                                : 'bg-gray-900/60 text-white'

                                }`}

                            >

                              <div className="flex flex-col">

                                <span className={selectedSource?.id === source.id ? 'text-emerald-400 font-medium' : 'text-white'}>

                                  {source.player}

                                </span>

                                <span className="text-xs text-gray-400">

                                  {source.language?.toUpperCase()} • {source.quality}

                                  {source.isM3u8 && <span className="ml-1 text-green-400">HLS</span>}

                                </span>

                              </div>

                              {selectedSource?.id === source.id && (

                                <span className="text-xs px-2 py-1 bg-emerald-600 text-white rounded-full">{t('watch.active')}</span>

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



          {provider === 'animesama' && showHLSPlayer && hlsPlayerSrc ? (

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

              nextEpisode={getNextEpisodeInfo(animeData, season, episode, showDetails?.seasons)}

            />

          ) : (

            <EmbedPlayerChrome

              onBack={handleBackNav}

              onChangeSource={() => setShowEmbedQuality(true)}

              onFallbackNext={handleAutoFallbackNext}

              onNextEpisode={handleNextEpisode}

              currentSourceLabel={provider === 'animesama' ? (selectedSource?.player || 'Anime-Sama') : provider}

              runtimeMinutes={24}

            >

              {provider === 'animesama' && (

                <>

                  <div

                    ref={playerRef}

                    className={`w-full h-full ${!embedUrl && !showHLSPlayer ? 'block' : 'hidden'}`}

                  ></div>

                  {embedUrl && !showHLSPlayer ? (

                    <iframe

                      src={embedUrl.replace(/uqload\.[a-z0-9-]+/gi, 'uqload.is')}

                      className="w-full h-full border-0"

                      allowFullScreen

                      referrerPolicy="no-referrer"

                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"

                    ></iframe>

                  ) : null}

                </>

              )}



              {provider === 'wavewatch' && (() => {
                const wavewatchUrl = isMovieMode
                  ? `https://wwembed.wavewatch.top/api/v1/streaming/ww-movie-${id}`
                  : `https://wwembed.wavewatch.top/api/v1/streaming/ww-tv-${id}-s${season}-e${episode}`;
                return (
                  <iframe
                    key={`wavewatch-${season}-${episode}`}
                    src={wavewatchUrl}
                    className="w-full h-full border-0"
                    allowFullScreen
                    allow="autoplay; fullscreen; encrypted-media; picture-in-picture"
                    title={`${showDetails?.name || 'Anime'} S${season}E${episode} - Wavewatch`}
                  />
                );
              })()}

              {provider === 'moviez' && (() => {

                if (loadingMoviezAnime) return (

                  <div className="w-full h-full flex items-center justify-center bg-black">

                    <svg className="animate-spin h-10 w-10 text-emerald-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">

                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />

                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />

                    </svg>

                  </div>

                );

                if (moviezAnimeError || !moviezAnimeData) return (

                  <div className="w-full h-full flex flex-col items-center justify-center bg-black text-gray-400 gap-3">

                    <span className="text-sm">{moviezAnimeError ?? 'Aucun lecteur Moviez disponible'}</span>

                  </div>

                );

                const players = moviezAnimeData.players?.[moviezAnimeLang] || moviezAnimeData.players?.vostfr || moviezAnimeData.players?.vf || [];

                const currentPlayer = players[moviezAnimePlayerIdx] || players[0];

                return currentPlayer ? (

                  <iframe

                    key={`moviez-${season}-${episode}-${moviezAnimeLang}-${moviezAnimePlayerIdx}`}

                    src={currentPlayer.url}

                    className="w-full h-full border-0"

                    allowFullScreen

                    allow="autoplay; fullscreen; encrypted-media; picture-in-picture"

                    title={`${showDetails?.name} S${season}E${episode} - Moviez`}

                  />

                ) : (

                  <div className="w-full h-full flex items-center justify-center bg-black text-gray-400 text-sm">

                    Aucun lecteur disponible pour cette langue

                  </div>

                );

              })()}



              {provider === 'vidzy' && (() => {

                if (loadingVidzyAnime) return (

                  <div className="w-full h-full flex items-center justify-center bg-black">

                    <svg className="animate-spin h-10 w-10 text-emerald-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">

                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />

                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />

                    </svg>

                  </div>

                );

                if (vidzyAnimeError || !vidzyAnimeData) return (

                  <div className="w-full h-full flex flex-col items-center justify-center bg-black text-gray-400 gap-3">

                    <span className="text-sm">{vidzyAnimeError ?? 'Aucun lecteur Vidzy disponible'}</span>

                  </div>

                );

                const players = vidzyAnimeData.players?.[vidzyAnimeLang] || vidzyAnimeData.players?.vostfr || vidzyAnimeData.players?.vf || [];

                const currentPlayer = players[vidzyAnimePlayerIdx] || players[0];

                return currentPlayer ? (

                  <iframe

                    key={`vidzy-${season}-${episode}-${vidzyAnimeLang}-${vidzyAnimePlayerIdx}`}

                    src={currentPlayer.url}

                    className="w-full h-full border-0"

                    allowFullScreen

                    allow="autoplay; fullscreen; encrypted-media; picture-in-picture"

                    title={`${showDetails?.name} S${season}E${episode} - Vidzy`}

                  />

                ) : (

                  <div className="w-full h-full flex items-center justify-center bg-black text-gray-400 text-sm">

                    Aucun lecteur disponible pour cette langue

                  </div>

                );

              })()}



              {provider === 'anicloud' && (() => {

                if (loadingAnicloud) return (

                  <div className="w-full h-full flex items-center justify-center bg-black">

                    <svg className="animate-spin h-10 w-10 text-emerald-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">

                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />

                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />

                    </svg>

                  </div>

                );

                if (anicloudError) return (

                  <div className="w-full h-full flex flex-col items-center justify-center bg-black text-gray-400 gap-3">

                    <span className="text-sm">{anicloudError}</span>

                  </div>

                );

                const currentPlayer = anicloudPlayers[anicloudPlayerIdx];

                return currentPlayer ? (

                  <iframe

                    key={`anicloud-${season}-${episode}-${anicloudLang}-${anicloudPlayerIdx}`}

                    src={currentPlayer.player_url}

                    className="w-full h-full border-0"

                    allowFullScreen

                    allow="autoplay; fullscreen; encrypted-media"

                    title={`${showDetails?.name} S${season}E${episode}`}

                  />

                ) : (

                  <div className="w-full h-full flex items-center justify-center bg-black text-gray-400 text-sm">

                    Aucun lecteur disponible

                  </div>

                );

              })()}



              {provider === 'franime' && (() => {

                if (franimeLoading) return (

                  <div className="w-full h-full flex items-center justify-center bg-black">

                    <svg className="animate-spin h-10 w-10 text-emerald-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">

                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />

                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />

                    </svg>

                  </div>

                );

                if (franimeError || !franimeLookup) return (

                  <div className="w-full h-full flex flex-col items-center justify-center bg-black text-gray-400 gap-3">

                    <span className="text-sm">{franimeError ?? 'Anime non trouvé sur FRAnime'}</span>

                  </div>

                );

                const franimeSrc = `https://franime.fr/anime/${franimeLookup.slug}?anime_id=${franimeLookup.animeId}&lang=${franimeLang}&ep=${episode ?? 1}`;

                return (

                  <div className="w-full h-full overflow-hidden relative">

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

            </EmbedPlayerChrome>

          )}

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

