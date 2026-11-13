import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Layers, Dices, Film, Tv2, Star, Sparkles, Filter, Calendar, Flame,
  RefreshCw, ChevronRight, Mic, Globe, Heart, Zap, Ghost, Rocket, Clapperboard
} from 'lucide-react';
import axios from 'axios';
import { TMDB_API_KEY, TMDB_API_URL } from '../config/config';
import { getTmdbLanguage } from '../i18n';
import { SearchGridCard } from '../components/SearchCard';
import DawgerRouletteModal from '../components/DawgerRouletteModal';

interface CategoryTab {
  id: string;
  label: string;
  icon: React.ReactNode;
  color: string;
  badge?: string;
  movieParams: Record<string, any>;
  tvParams: Record<string, any>;
}

const CATEGORY_TABS: CategoryTab[] = [
  {
    id: 'standup',
    label: 'Stand-up & Humoristes',
    icon: <Mic size={15} />,
    color: 'from-amber-500 to-orange-600',
    badge: 'Nouveau',
    movieParams: { with_keywords: '9716', sort_by: 'popularity.desc' },
    tvParams: { with_keywords: '9716', sort_by: 'popularity.desc' },
  },
  {
    id: 'korean',
    label: 'K-Drama & Coréen',
    icon: <Sparkles size={15} />,
    color: 'from-pink-500 to-rose-600',
    movieParams: { with_original_language: 'ko', sort_by: 'popularity.desc' },
    tvParams: { with_original_language: 'ko', sort_by: 'popularity.desc' },
  },
  {
    id: 'japanese',
    label: 'Japon & J-Drama',
    icon: <Flame size={15} />,
    color: 'from-red-500 to-amber-600',
    movieParams: { with_original_language: 'ja', sort_by: 'popularity.desc' },
    tvParams: { with_original_language: 'ja', sort_by: 'popularity.desc' },
  },
  {
    id: 'hollywood',
    label: 'Hollywood & USA',
    icon: <Clapperboard size={15} />,
    color: 'from-blue-600 to-indigo-600',
    movieParams: { with_origin_country: 'US', sort_by: 'popularity.desc' },
    tvParams: { with_origin_country: 'US', sort_by: 'popularity.desc' },
  },
  {
    id: 'french',
    label: 'Cinéma Français',
    icon: <Globe size={15} />,
    color: 'from-cyan-500 to-blue-600',
    movieParams: { with_original_language: 'fr', sort_by: 'popularity.desc' },
    tvParams: { with_original_language: 'fr', sort_by: 'popularity.desc' },
  },
  {
    id: 'bollywood',
    label: 'Bollywood (Inde)',
    icon: <Star size={15} />,
    color: 'from-yellow-500 to-amber-600',
    movieParams: { with_original_language: 'hi', sort_by: 'popularity.desc' },
    tvParams: { with_original_language: 'hi', sort_by: 'popularity.desc' },
  },
  {
    id: 'nollywood',
    label: 'Nollywood & Afrique',
    icon: <Globe size={15} />,
    color: 'from-emerald-500 to-teal-600',
    movieParams: { with_origin_country: 'NG', sort_by: 'popularity.desc' },
    tvParams: { with_origin_country: 'NG', sort_by: 'popularity.desc' },
  },
  {
    id: 'action',
    label: 'Action & Aventure',
    icon: <Zap size={15} />,
    color: 'from-orange-500 to-red-600',
    movieParams: { with_genres: '28,12', sort_by: 'popularity.desc' },
    tvParams: { with_genres: '10759', sort_by: 'popularity.desc' },
  },
  {
    id: 'thriller',
    label: 'Thriller & Mystère',
    icon: <Layers size={15} />,
    color: 'from-purple-600 to-indigo-700',
    movieParams: { with_genres: '53,9648', sort_by: 'popularity.desc' },
    tvParams: { with_genres: '9648', sort_by: 'popularity.desc' },
  },
  {
    id: 'romance',
    label: 'Romance & Sentiments',
    icon: <Heart size={15} />,
    color: 'from-rose-500 to-pink-600',
    movieParams: { with_genres: '10749', sort_by: 'popularity.desc' },
    tvParams: { with_genres: '10766', sort_by: 'popularity.desc' },
  },
  {
    id: 'horror',
    label: 'Horreur & Frissons',
    icon: <Ghost size={15} />,
    color: 'from-emerald-600 to-zinc-900',
    movieParams: { with_genres: '27', sort_by: 'popularity.desc' },
    tvParams: { with_genres: '9648', sort_by: 'popularity.desc' },
  },
  {
    id: 'scifi',
    label: 'Sci-Fi & Cyberpunk',
    icon: <Rocket size={15} />,
    color: 'from-violet-500 to-cyan-600',
    movieParams: { with_genres: '878,14', sort_by: 'popularity.desc' },
    tvParams: { with_genres: '10765', sort_by: 'popularity.desc' },
  },
];

const PERIODS = [
  { label: 'Toutes les époques', gte: '', lte: '' },
  { label: '2024 - 2026', gte: '2024-01-01', lte: '2026-12-31' },
  { label: '2020 - 2023', gte: '2020-01-01', lte: '2023-12-31' },
  { label: 'Années 2010', gte: '2010-01-01', lte: '2019-12-31' },
  { label: 'Années 2000', gte: '2000-01-01', lte: '2009-12-31' },
  { label: 'Classiques (< 2000)', gte: '1960-01-01', lte: '1999-12-31' },
];

const SORTS = [
  { id: 'popularity.desc', label: '🔥 Popularité' },
  { id: 'vote_average.desc', label: '⭐ Mieux notés' },
  { id: 'primary_release_date.desc', label: '📅 Nouveautés' },
];

export const Categories: React.FC = () => {
  const { t } = useTranslation();

  // Selection state
  const [activeTabId, setActiveTabId] = useState<string>('standup');
  const [mediaTypeFilter, setMediaTypeFilter] = useState<'all' | 'movie' | 'tv'>('all');
  const [selectedPeriodIdx, setSelectedPeriodIdx] = useState(0);
  const [selectedSort, setSelectedSort] = useState('popularity.desc');

  // Items & pagination state
  const [items, setItems] = useState<any[]>([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Sentinel ref for infinite scroll
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  // Roulette Modal state
  const [isRouletteOpen, setIsRouletteOpen] = useState(false);

  const activeTab = CATEGORY_TABS.find((tab) => tab.id === activeTabId) || CATEGORY_TABS[0];

  // Fetch logic
  const fetchItems = useCallback(
    async (targetPage = 1, append = false) => {
      setIsLoading(true);
      setError(null);

      try {
        const period = PERIODS[selectedPeriodIdx];
        const lang = getTmdbLanguage();

        const buildParams = (baseParams: Record<string, any>, isMovie: boolean) => {
          const p: Record<string, any> = {
            api_key: TMDB_API_KEY,
            language: lang,
            page: targetPage,
            sort_by: selectedSort,
            'vote_count.gte': selectedSort === 'vote_average.desc' ? 120 : 15,
            ...baseParams,
          };

          if (isMovie) {
            if (period.gte) p['primary_release_date.gte'] = period.gte;
            if (period.lte) p['primary_release_date.lte'] = period.lte;
          } else {
            if (period.gte) p['first_air_date.gte'] = period.gte;
            if (period.lte) p['first_air_date.lte'] = period.lte;
          }

          return p;
        };

        let collected: any[] = [];

        if (mediaTypeFilter === 'all' || mediaTypeFilter === 'movie') {
          const movieParams = buildParams(activeTab.movieParams, true);
          try {
            const res = await axios.get(`${TMDB_API_URL}/discover/movie`, { params: movieParams });
            const movies = (res.data?.results || []).map((m: any) => ({ ...m, media_type: 'movie' }));
            collected.push(...movies);
          } catch {
            // pass
          }
        }

        if (mediaTypeFilter === 'all' || mediaTypeFilter === 'tv') {
          const tvParams = buildParams(activeTab.tvParams, false);
          try {
            const res = await axios.get(`${TMDB_API_URL}/discover/tv`, { params: tvParams });
            const shows = (res.data?.results || []).map((s: any) => ({ ...s, media_type: 'tv' }));
            collected.push(...shows);
          } catch {
            // pass
          }
        }

        // Clean: require poster & overview
        collected = collected.filter((item) => item.poster_path && item.id);

        // Sort collected if mixed
        if (selectedSort === 'popularity.desc') {
          collected.sort((a, b) => (b.popularity || 0) - (a.popularity || 0));
        } else if (selectedSort === 'vote_average.desc') {
          collected.sort((a, b) => (b.vote_average || 0) - (a.vote_average || 0));
        }

        if (append) {
          setItems((prev) => {
            const existingIds = new Set(prev.map((i) => `${i.media_type}-${i.id}`));
            const fresh = collected.filter((i) => !existingIds.has(`${i.media_type}-${i.id}`));
            return [...prev, ...fresh];
          });
        } else {
          setItems(collected);
        }

        setHasMore(collected.length > 0 && targetPage < 10);
      } catch (err) {
        console.error('Failed to load categories content:', err);
        setError('Impossible de charger le contenu. Veuillez vérifier votre connexion.');
      } finally {
        setIsLoading(false);
      }
    },
    [activeTab, mediaTypeFilter, selectedPeriodIdx, selectedSort]
  );

  // Trigger fetch on tab or filter change
  useEffect(() => {
    setPage(1);
    fetchItems(1, false);
  }, [fetchItems]);

  const handleLoadMore = useCallback(() => {
    if (isLoading || !hasMore) return;
    const nextPage = page + 1;
    setPage(nextPage);
    fetchItems(nextPage, true);
  }, [isLoading, hasMore, page, fetchItems]);

  // Automatic Infinite Scroll Observer
  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && !isLoading && hasMore) {
          handleLoadMore();
        }
      },
      { rootMargin: '450px' }
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [handleLoadMore, isLoading, hasMore]);

  return (
    <div className="min-h-screen bg-[#07070a] text-white pt-20 pb-24 px-3 sm:px-6 md:px-8 max-w-[1600px] mx-auto">
      {/* Hero Banner with Dawger Roulette CTA */}
      <div className="relative mb-8 rounded-3xl overflow-hidden border border-white/10 bg-gradient-to-r from-purple-900/30 via-zinc-900/60 to-zinc-900/40 p-6 sm:p-8 backdrop-blur-xl shadow-[0_10px_40px_rgba(0,0,0,0.6)]">
        <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="space-y-2 max-w-xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 border border-white/15 text-xs font-semibold text-white/80">
              <Sparkles size={13} className="text-white/70" />
              <span>Exploration Immense</span>
            </div>
            <h1 className="text-3xl sm:text-4xl font-black text-white tracking-tight">
              Catalogue par <span className="text-white">Catégories</span>
            </h1>
            <p className="text-sm text-white/60 leading-relaxed">
              Stand-up, K-Drama, Cinéma Japonais, Hollywood, Nollywood, Français ou genres combinés : explorez des milliers de titres triés sur le volet.
            </p>
          </div>

          {/* Roulette Button with genuine Liquid Glass - Pure White */}
          <button
            type="button"
            onClick={() => setIsRouletteOpen(true)}
            className="group relative px-6 py-3.5 rounded-2xl text-white flex items-center gap-3.5 transition-all duration-300 hover:scale-[1.03] active:scale-95 cursor-pointer shadow-lg shrink-0"
            style={{
              background: 'linear-gradient(160deg, rgba(255,255,255,0.12) 0%, rgba(255,255,255,0.04) 55%, rgba(0,0,0,0.06) 100%)',
              backdropFilter: 'blur(20px) saturate(180%)',
              WebkitBackdropFilter: 'blur(20px) saturate(180%)',
              borderTop: '1px solid rgba(255,255,255,0.28)',
              borderLeft: '1px solid rgba(255,255,255,0.16)',
              borderRight: '1px solid rgba(255,255,255,0.07)',
              borderBottom: '1px solid rgba(0,0,0,0.22)',
              boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.22), inset 0 -1px 0 rgba(0,0,0,0.10), 0 4px 14px rgba(0,0,0,0.28)',
            }}
          >
            <div className="w-10 h-10 rounded-xl bg-white/10 border border-white/20 flex items-center justify-center shadow-inner">
              <Dices size={22} className="text-white group-hover:rotate-45 transition-transform duration-300" />
            </div>
            <div className="text-left">
              <div className="text-[11px] font-medium text-white/60 leading-none">Pas d'idée ce soir ?</div>
              <div className="text-sm font-black tracking-wide text-white">Dawger Spin (Roulette)</div>
            </div>
          </button>
        </div>
      </div>

      {/* Categories Tabs Scrollable Bar with pure Liquid Glass - Pure White */}
      <div className="mb-6">
        <div className="flex items-center gap-2 overflow-x-auto pb-3 scrollbar-none -mx-3 px-3 sm:mx-0 sm:px-0">
          {CATEGORY_TABS.map((tab) => {
            const isActive = tab.id === activeTabId;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTabId(tab.id)}
                className={`flex-shrink-0 flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-medium transition-all duration-200 cursor-pointer active:scale-95 ${
                  isActive ? 'text-white' : 'text-white/70 hover:text-white'
                }`}
                style={{
                  background: isActive
                    ? 'linear-gradient(160deg, rgba(255,255,255,0.22) 0%, rgba(255,255,255,0.08) 60%, rgba(0,0,0,0.06) 100%)'
                    : 'linear-gradient(160deg, rgba(255,255,255,0.12) 0%, rgba(255,255,255,0.04) 55%, rgba(0,0,0,0.06) 100%)',
                  backdropFilter: 'blur(20px) saturate(180%)',
                  WebkitBackdropFilter: 'blur(20px) saturate(180%)',
                  borderTop: isActive ? '1px solid rgba(255,255,255,0.40)' : '1px solid rgba(255,255,255,0.28)',
                  borderLeft: isActive ? '1px solid rgba(255,255,255,0.22)' : '1px solid rgba(255,255,255,0.16)',
                  borderRight: '1px solid rgba(255,255,255,0.07)',
                  borderBottom: '1px solid rgba(0,0,0,0.22)',
                  boxShadow: isActive
                    ? 'inset 0 1px 0 rgba(255,255,255,0.35), inset 0 -1px 0 rgba(0,0,0,0.12), 0 4px 16px rgba(0,0,0,0.40)'
                    : 'inset 0 1px 0 rgba(255,255,255,0.22), inset 0 -1px 0 rgba(0,0,0,0.10), 0 4px 14px rgba(0,0,0,0.28)',
                }}
              >
                <span className={isActive ? 'text-white' : 'text-white/60'}>{tab.icon}</span>
                <span className={isActive ? 'text-white font-semibold' : 'text-white/80'}>{tab.label}</span>
                {tab.badge && (
                  <span className="px-1.5 py-0.5 rounded-full bg-white/20 border border-white/25 text-white text-[10px] font-bold uppercase tracking-wide">
                    {tab.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Filter Row: Type, Period, Sort */}
      <div className="mb-8 p-4 rounded-2xl bg-white/[0.02] border border-white/10 flex flex-wrap items-center justify-between gap-4">
        {/* Media type toggle */}
        <div className="flex items-center gap-1.5 bg-black/40 p-1 rounded-xl border border-white/5">
          {[
            { id: 'all', label: 'Tous' },
            { id: 'movie', label: 'Films' },
            { id: 'tv', label: 'Séries' },
          ].map((type) => (
            <button
              key={type.id}
              type="button"
              onClick={() => setMediaTypeFilter(type.id as any)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                mediaTypeFilter === type.id
                  ? 'bg-white/15 text-white shadow-sm'
                  : 'text-white/50 hover:text-white'
              }`}
            >
              {type.label}
            </button>
          ))}
        </div>

        {/* Period Selector */}
        <div className="flex items-center gap-2">
          <Calendar size={14} className="text-white/40" />
          <select
            value={selectedPeriodIdx}
            onChange={(e) => setSelectedPeriodIdx(Number(e.target.value))}
            className="bg-black/60 text-white text-xs font-medium px-3 py-1.5 rounded-xl border border-white/10 focus:border-white/30 outline-none cursor-pointer"
          >
            {PERIODS.map((period, idx) => (
              <option key={period.label} value={idx} className="bg-zinc-900 text-white">
                {period.label}
              </option>
            ))}
          </select>
        </div>

        {/* Sort Selector */}
        <div className="flex items-center gap-2">
          <Filter size={14} className="text-white/40" />
          <select
            value={selectedSort}
            onChange={(e) => setSelectedSort(e.target.value)}
            className="bg-black/60 text-white text-xs font-medium px-3 py-1.5 rounded-xl border border-white/10 focus:border-white/30 outline-none cursor-pointer"
          >
            {SORTS.map((s) => (
              <option key={s.id} value={s.id} className="bg-zinc-900 text-white">
                {s.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Grid of Results */}
      {items.length > 0 ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 sm:gap-4">
          {items.map((item, idx) => (
            <SearchGridCard
              key={`${item.media_type}-${item.id}-${idx}`}
              item={item}
              index={idx}
              movieLabel="Film"
              serieLabel="Série"
            />
          ))}
        </div>
      ) : !isLoading ? (
        <div className="text-center py-20 space-y-3">
          <div className="text-4xl">🎬</div>
          <h3 className="text-base font-bold text-white">Aucun titre trouvé avec ces filtres</h3>
          <p className="text-xs text-white/50">Essaie de changer la période ou le format pour afficher plus de résultats.</p>
        </div>
      ) : null}

      {/* Loading Skeleton */}
      {isLoading && (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 sm:gap-4 mt-4">
          {Array.from({ length: 12 }).map((_, i) => (
            <div
              key={i}
              className="aspect-[2/3] rounded-2xl bg-white/[0.04] animate-pulse border border-white/5"
            />
          ))}
        </div>
      )}

      {/* Sentinel pour le scroll infini automatique (sans bouton) */}
      {hasMore && (
        <div ref={sentinelRef} className="w-full py-10 flex items-center justify-center">
          {isLoading && (
            <div className="flex items-center gap-2.5 px-4 py-2 rounded-xl bg-white/[0.04] border border-white/10 text-white/60 text-xs font-semibold backdrop-blur-md">
              <RefreshCw size={15} className="animate-spin text-white/70" />
              <span>Chargement automatique de la suite...</span>
            </div>
          )}
        </div>
      )}

      {/* Dawger Roulette Modal */}
      <DawgerRouletteModal isOpen={isRouletteOpen} onClose={() => setIsRouletteOpen(false)} />
    </div>
  );
};

export default Categories;
