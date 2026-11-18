import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Star, Film, Tv2, Layers, Trash2, Play, Search, X, Sparkles } from 'lucide-react';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import { encodeId } from '../utils/idEncoder';
import { SearchGridCard } from '../components/SearchCard';

interface WatchlistEntry {
  id: number;
  type: 'movie' | 'tv' | 'collection';
  title?: string;
  name?: string;
  poster_path?: string;
  backdrop_path?: string;
  overview?: string;
  vote_average?: number;
  release_date?: string;
  first_air_date?: string;
  addedAt?: string;
}

function readAllWatchlist(): WatchlistEntry[] {
  const results: WatchlistEntry[] = [];
  const keys: Array<{ key: string; defaultType: 'movie' | 'tv' | 'collection' }> = [
    { key: 'watchlist_movie', defaultType: 'movie' },
    { key: 'watchlist_tv', defaultType: 'tv' },
    { key: 'watchlist_collections', defaultType: 'collection' },
  ];

  for (const { key, defaultType } of keys) {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) continue;
      const arr = JSON.parse(raw);
      if (!Array.isArray(arr)) continue;
      for (const item of arr) {
        if (item && typeof item.id === 'number') {
          results.push({
            ...item,
            type: item.type === 'tv' || item.type === 'collection' || item.type === 'movie' ? item.type : defaultType,
            title: item.title || item.name || 'Sans titre',
          });
        }
      }
    } catch {
      // ignore malformed JSON
    }
  }

  return results.sort((a, b) => {
    const tA = a.addedAt ? new Date(a.addedAt).getTime() : 0;
    const tB = b.addedAt ? new Date(b.addedAt).getTime() : 0;
    return tB - tA;
  });
}

const MyListPage: React.FC = () => {
  const navigate = useNavigate();
  const [items, setItems] = useState<WatchlistEntry[]>(() => readAllWatchlist());
  const [filter, setFilter] = useState<'all' | 'movie' | 'tv' | 'collection'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const refresh = useCallback(() => {
    setItems(readAllWatchlist());
  }, []);

  useEffect(() => {
    document.title = 'Ma Liste — Dawger';
    window.addEventListener('watchlist_updated', refresh);
    window.addEventListener('storage', refresh);
    return () => {
      window.removeEventListener('watchlist_updated', refresh);
      window.removeEventListener('storage', refresh);
    };
  }, [refresh]);

  const removeItem = useCallback((entry: WatchlistEntry) => {
    const key =
      entry.type === 'collection'
        ? 'watchlist_collections'
        : entry.type === 'tv'
          ? 'watchlist_tv'
          : 'watchlist_movie';
    try {
      const raw = localStorage.getItem(key) || '[]';
      const list = JSON.parse(raw);
      const next = Array.isArray(list) ? list.filter((m: any) => m.id !== entry.id) : [];
      localStorage.setItem(key, JSON.stringify(next));
      window.dispatchEvent(new CustomEvent('watchlist_updated'));
      refresh();
      toast.success(`${entry.title || entry.name} retiré de Ma liste`, { duration: 2000 });
    } catch {
      // ignore
    }
  }, [refresh]);

  const clearAll = useCallback(() => {
    localStorage.setItem('watchlist_movie', '[]');
    localStorage.setItem('watchlist_tv', '[]');
    localStorage.setItem('watchlist_collections', '[]');
    window.dispatchEvent(new CustomEvent('watchlist_updated'));
    refresh();
    toast.success('Ma liste a été vidée', { duration: 2000 });
  }, [refresh]);

  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      if (filter !== 'all' && item.type !== filter) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const label = (item.title || item.name || '').toLowerCase();
        if (!label.includes(q)) return false;
      }
      return true;
    });
  }, [items, filter, searchQuery]);

  const counts = useMemo(() => {
    return {
      all: items.length,
      movie: items.filter((i) => i.type === 'movie').length,
      tv: items.filter((i) => i.type === 'tv').length,
      collection: items.filter((i) => i.type === 'collection').length,
    };
  }, [items]);

  return (
    <div className="min-h-screen bg-black text-white px-4 sm:px-6 lg:px-10 py-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-white/10">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-yellow-500/15 border border-yellow-400/30 flex items-center justify-center text-yellow-400 shadow-lg shadow-yellow-500/10">
            <Star className="w-6 h-6" fill="currentColor" />
          </div>
          <div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white flex items-center gap-2.5">
              <span>Ma Liste</span>
              <span className="text-xs font-mono px-2.5 py-0.5 rounded-full bg-yellow-500/15 border border-yellow-400/30 text-yellow-300">
                {counts.all} {counts.all > 1 ? 'œuvres' : 'œuvre'}
              </span>
            </h1>
            <p className="text-xs sm:text-sm text-zinc-400 mt-0.5">
              Retrouvez tous vos films, séries et sagas mis en favoris avec l'étoile ⭐
            </p>
          </div>
        </div>

        {/* Search & Clear */}
        <div className="flex items-center gap-2.5">
          <div className="relative flex-1 sm:w-64">
            <Search className="w-4 h-4 text-zinc-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Rechercher dans Ma liste..."
              className="w-full pl-9 pr-8 py-2 rounded-xl bg-white/[0.04] border border-white/10 text-xs sm:text-sm text-white placeholder:text-zinc-500 focus:outline-none focus:border-yellow-400/40"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-white"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {counts.all > 0 && (
            <button
              type="button"
              onClick={clearAll}
              className="px-3.5 py-2 rounded-xl bg-red-500/10 hover:bg-red-500/20 border border-red-500/25 text-red-300 text-xs font-semibold flex items-center gap-1.5 transition-colors shrink-0"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Tout vider</span>
            </button>
          )}
        </div>
      </div>

      {/* Filter Pills */}
      <div className="flex items-center gap-2 overflow-x-auto py-5 no-scrollbar">
        <button
          type="button"
          onClick={() => setFilter('all')}
          className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold flex items-center gap-2 border transition-all shrink-0 ${
            filter === 'all'
              ? 'bg-yellow-500/20 border-yellow-400/40 text-yellow-300 shadow-sm'
              : 'bg-white/[0.03] border-white/10 text-zinc-400 hover:text-white hover:bg-white/[0.06]'
          }`}
        >
          <Star className="w-4 h-4" fill={filter === 'all' ? 'currentColor' : 'none'} />
          <span>Tout ({counts.all})</span>
        </button>

        <button
          type="button"
          onClick={() => setFilter('movie')}
          className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold flex items-center gap-2 border transition-all shrink-0 ${
            filter === 'movie'
              ? 'bg-emerald-500/20 border-emerald-400/40 text-emerald-300 shadow-sm'
              : 'bg-white/[0.03] border-white/10 text-zinc-400 hover:text-white hover:bg-white/[0.06]'
          }`}
        >
          <Film className="w-4 h-4" />
          <span>Films ({counts.movie})</span>
        </button>

        <button
          type="button"
          onClick={() => setFilter('tv')}
          className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold flex items-center gap-2 border transition-all shrink-0 ${
            filter === 'tv'
              ? 'bg-cyan-500/20 border-cyan-400/40 text-cyan-300 shadow-sm'
              : 'bg-white/[0.03] border-white/10 text-zinc-400 hover:text-white hover:bg-white/[0.06]'
          }`}
        >
          <Tv2 className="w-4 h-4" />
          <span>Séries & Animés ({counts.tv})</span>
        </button>

        <button
          type="button"
          onClick={() => setFilter('collection')}
          className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold flex items-center gap-2 border transition-all shrink-0 ${
            filter === 'collection'
              ? 'bg-purple-500/20 border-purple-400/40 text-purple-300 shadow-sm'
              : 'bg-white/[0.03] border-white/10 text-zinc-400 hover:text-white hover:bg-white/[0.06]'
          }`}
        >
          <Layers className="w-4 h-4" />
          <span>Sagas ({counts.collection})</span>
        </button>
      </div>

      {/* Grid or Empty State */}
      {filteredItems.length === 0 ? (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-8 rounded-3xl border border-white/10 bg-white/[0.02] p-8 sm:p-12 text-center max-w-xl mx-auto space-y-4"
        >
          <div className="w-16 h-16 rounded-2xl bg-yellow-500/10 border border-yellow-400/25 text-yellow-400 flex items-center justify-center mx-auto">
            <Star className="w-8 h-8" />
          </div>
          <h2 className="text-lg sm:text-xl font-bold text-white">
            {counts.all === 0 ? 'Votre liste est vide pour le moment' : 'Aucun résultat pour ce filtre'}
          </h2>
          <p className="text-xs sm:text-sm text-zinc-400 leading-relaxed">
            Cliquez sur une affiche dans le catalogue puis sur le bouton <strong className="text-yellow-300">« Ma liste »</strong> (ou directement sur l'étoile ⭐ en haut à droite d'une jaquette) pour conserver vos films, séries et animés préférés ici.
          </p>
          <div className="pt-2 flex flex-wrap items-center justify-center gap-3">
            <button
              type="button"
              onClick={() => navigate('/movies')}
              className="px-5 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black font-bold text-xs sm:text-sm transition-colors"
            >
              Explorer les Films
            </button>
            <button
              type="button"
              onClick={() => navigate('/tv-shows')}
              className="px-5 py-2.5 rounded-xl bg-white/10 hover:bg-white/15 border border-white/15 text-white font-semibold text-xs sm:text-sm transition-colors"
            >
              Explorer les Séries
            </button>
            <button
              type="button"
              onClick={() => navigate('/anime')}
              className="px-5 py-2.5 rounded-xl bg-white/10 hover:bg-white/15 border border-white/15 text-white font-semibold text-xs sm:text-sm flex items-center gap-1.5 transition-colors"
            >
              <Sparkles className="w-4 h-4 text-purple-400" />
              <span>Animés</span>
            </button>
          </div>
        </motion.div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 sm:gap-5">
          {filteredItems.map((entry, idx) => {
            if (entry.type === 'collection') {
              const detailPath = `/collection/${encodeId(entry.id)}`;
              return (
                <div
                  key={`collection-${entry.id}`}
                  onClick={() => navigate(detailPath)}
                  className="relative group rounded-xl overflow-hidden bg-white/5 border border-white/10 hover:border-white/25 transition-all cursor-pointer"
                >
                  <span className="absolute top-2 left-2 z-10 px-2 py-1 rounded-lg bg-black/70 text-[10px] font-semibold uppercase tracking-wider text-purple-300">
                    Saga
                  </span>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      removeItem(entry);
                    }}
                    className="absolute top-2 right-2 z-20 p-2 rounded-full bg-yellow-500/25 border border-yellow-400/40 text-yellow-400 hover:bg-red-500/30 hover:border-red-400/50 hover:text-red-300 transition-colors"
                    title="Retirer de Ma liste"
                  >
                    <Star className="w-4 h-4" fill="currentColor" />
                  </button>
                  <img
                    src={entry.poster_path ? `https://image.tmdb.org/t/p/w500${entry.poster_path}` : ''}
                    alt={entry.title || entry.name}
                    className="w-full aspect-[2/3] object-cover rounded-xl"
                  />
                  <div className="absolute inset-x-0 bottom-0 p-3 bg-gradient-to-t from-black via-black/80 to-transparent">
                    <h3 className="text-sm font-bold text-white line-clamp-1">
                      {entry.title || entry.name}
                    </h3>
                    <div className="mt-2 inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-400">
                      <Play className="w-3.5 h-3.5 fill-current" />
                      <span>Ouvrir la saga</span>
                    </div>
                  </div>
                </div>
              );
            }

            return (
              <SearchGridCard
                key={`${entry.type}-${entry.id}`}
                index={idx}
                movieLabel="Film"
                serieLabel="Série"
                item={{
                  id: entry.id,
                  title: entry.title || entry.name,
                  name: entry.name || entry.title,
                  media_type: entry.type,
                  poster_path: entry.poster_path || '',
                  backdrop_path: entry.backdrop_path,
                  release_date: entry.release_date,
                  first_air_date: entry.first_air_date,
                  vote_average: entry.vote_average || 0,
                  overview: entry.overview,
                }}
              />
            );
          })}
        </div>
      )}
    </div>
  );
};

export default MyListPage;
