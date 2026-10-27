import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Calendar, Film, Tv, Sparkles, Star } from 'lucide-react';
import { PrefetchLink as Link } from '@/routing/PrefetchLink';
import { TMDB_API_KEY, TMDB_API_URL } from '../config/config';
import { getTmdbLanguage } from '../i18n';
import SEO from '../components/SEO';
import GridSkeleton from '../components/skeletons/GridSkeleton';

interface UpcomingItem {
  id: number;
  title?: string;
  name?: string;
  poster_path: string | null;
  release_date?: string;
  first_air_date?: string;
  overview: string;
  vote_average: number;
  media_type: 'movie' | 'tv';
}

const ProchainementPage: React.FC = () => {
  const [items, setItems] = useState<UpcomingItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [filter, setFilter] = useState<'all' | 'movie' | 'tv'>('all');

  useEffect(() => {
    const fetchUpcoming = async () => {
      try {
        setLoading(true);
        const lang = getTmdbLanguage();

        const [moviesRes, tvRes] = await Promise.all([
          axios.get(`${TMDB_API_URL}/movie/upcoming?api_key=${TMDB_API_KEY}&language=${lang}&page=1`),
          axios.get(`${TMDB_API_URL}/tv/on_the_air?api_key=${TMDB_API_KEY}&language=${lang}&page=1`)
        ]);

        const movies: UpcomingItem[] = (moviesRes.data.results || []).map((m: any) => ({
          ...m,
          media_type: 'movie'
        }));

        const tvShows: UpcomingItem[] = (tvRes.data.results || []).map((t: any) => ({
          ...t,
          media_type: 'tv'
        }));

        // Sort by date if available
        const combined = [...movies, ...tvShows].sort((a, b) => {
          const dateA = a.release_date || a.first_air_date || '';
          const dateB = b.release_date || b.first_air_date || '';
          return dateA.localeCompare(dateB);
        });

        setItems(combined);
      } catch (err) {
        console.error('Erreur chargement sorties prochaines:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchUpcoming();
  }, []);

  const filteredItems = items.filter((item) => {
    if (filter === 'all') return true;
    return item.media_type === filter;
  });

  return (
    <>
      <SEO
        title="Prochainement · DAWGER"
        description="Découvrez les prochaines sorties de films et séries les plus attendues."
        canonical="/prochainement"
      />

      <div className="min-h-screen bg-[#08080c] text-white pt-24 pb-20 px-4 sm:px-6">
        <div className="max-w-7xl mx-auto">
          
          {/* Header */}
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-10">
            <div>
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 mb-3">
                <Sparkles className="w-3.5 h-3.5" />
                Sorties à venir
              </span>
              <h1 className="text-3xl sm:text-4xl font-black tracking-tight text-white">
                Prochainement
              </h1>
              <p className="mt-2 text-xs sm:text-sm text-zinc-400 max-w-xl">
                Les films et séries qui arrivent bientôt sur les écrans et sur Dawger. Marquez-les dans vos listes pour ne rien manquer.
              </p>
            </div>

            {/* Onglets Filtres */}
            <div className="flex items-center gap-1.5 bg-white/5 border border-white/10 p-1 rounded-2xl w-fit">
              <button
                onClick={() => setFilter('all')}
                className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all ${
                  filter === 'all'
                    ? 'bg-emerald-400 text-black shadow-lg shadow-emerald-500/20'
                    : 'text-zinc-400 hover:text-white'
                }`}
              >
                Tout voir
              </button>
              <button
                onClick={() => setFilter('movie')}
                className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all flex items-center gap-1.5 ${
                  filter === 'movie'
                    ? 'bg-emerald-400 text-black shadow-lg shadow-emerald-500/20'
                    : 'text-zinc-400 hover:text-white'
                }`}
              >
                <Film className="w-3.5 h-3.5" />
                <span>Films</span>
              </button>
              <button
                onClick={() => setFilter('tv')}
                className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all flex items-center gap-1.5 ${
                  filter === 'tv'
                    ? 'bg-emerald-400 text-black shadow-lg shadow-emerald-500/20'
                    : 'text-zinc-400 hover:text-white'
                }`}
              >
                <Tv className="w-3.5 h-3.5" />
                <span>Séries</span>
              </button>
            </div>
          </div>

          {/* Grille */}
          {loading ? (
            <GridSkeleton />
          ) : filteredItems.length === 0 ? (
            <div className="text-center py-20 text-zinc-400 text-sm">
              Aucune sortie trouvée pour cette catégorie.
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 sm:gap-6">
              {filteredItems.map((item) => {
                const title = item.title || item.name;
                const dateStr = item.release_date || item.first_air_date;
                const formattedDate = dateStr
                  ? new Date(dateStr).toLocaleDateString('fr-FR', {
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric'
                    })
                  : 'Bientôt';

                const targetUrl = item.media_type === 'movie' ? `/movie/${item.id}` : `/tv/${item.id}`;
                const posterUrl = item.poster_path
                  ? `https://image.tmdb.org/t/p/w500${item.poster_path}`
                  : null;

                return (
                  <Link
                    key={`${item.media_type}-${item.id}`}
                    to={targetUrl}
                    className="group flex flex-col rounded-2xl bg-white/[0.03] hover:bg-white/[0.07] border border-white/[0.06] hover:border-emerald-500/40 overflow-hidden transition-all duration-300 hover:-translate-y-1 shadow-lg"
                  >
                    <div className="aspect-[2/3] w-full bg-zinc-900 relative overflow-hidden">
                      {posterUrl ? (
                        <img
                          src={posterUrl}
                          alt={title}
                          loading="lazy"
                          className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-zinc-600">
                          <Film className="w-12 h-12" />
                        </div>
                      )}
                      
                      {/* Date Badge */}
                      <div className="absolute top-2.5 left-2.5 px-2 py-1 rounded-lg bg-black/80 backdrop-blur-md border border-white/10 text-[10px] font-semibold text-emerald-300 flex items-center gap-1 shadow-md">
                        <Calendar className="w-3 h-3 text-emerald-400" />
                        <span>{formattedDate}</span>
                      </div>

                      <div className="absolute bottom-2.5 right-2.5 px-2 py-0.5 rounded-md bg-black/70 backdrop-blur-md text-[10px] uppercase font-bold text-zinc-300 border border-white/10">
                        {item.media_type === 'movie' ? 'Film' : 'Série'}
                      </div>
                    </div>

                    <div className="p-3.5 flex flex-col flex-grow">
                      <h3 className="font-bold text-sm text-white group-hover:text-emerald-400 transition-colors line-clamp-1">
                        {title}
                      </h3>
                      {item.overview && (
                        <p className="text-[11px] text-zinc-400 line-clamp-2 mt-1 leading-relaxed">
                          {item.overview}
                        </p>
                      )}
                    </div>
                  </Link>
                );
              })}
            </div>
          )}

        </div>
      </div>
    </>
  );
};

export default ProchainementPage;
