import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Search, User, Star, Film, Sparkles } from 'lucide-react';
import { PrefetchLink as Link } from '@/routing/PrefetchLink';
import { TMDB_API_KEY, TMDB_API_URL } from '../config/config';
import { getTmdbLanguage } from '../i18n';
import SEO from '../components/SEO';
import GridSkeleton from '../components/skeletons/GridSkeleton';

interface PopularPerson {
  id: number;
  name: string;
  profile_path: string | null;
  known_for_department: string;
  known_for: {
    id: number;
    title?: string;
    name?: string;
    media_type: string;
  }[];
  popularity: number;
}

const ActeursPage: React.FC = () => {
  const [people, setPeople] = useState<PopularPerson[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [page, setPage] = useState<number>(1);

  useEffect(() => {
    const fetchPopularPeople = async () => {
      try {
        setLoading(true);
        const lang = getTmdbLanguage();
        const url = searchTerm
          ? `${TMDB_API_URL}/search/person?api_key=${TMDB_API_KEY}&language=${lang}&query=${encodeURIComponent(searchTerm)}&page=${page}`
          : `${TMDB_API_URL}/person/popular?api_key=${TMDB_API_KEY}&language=${lang}&page=${page}`;

        const res = await axios.get(url);
        setPeople(res.data.results || []);
      } catch (err) {
        console.error('Erreur chargement acteurs:', err);
      } finally {
        setLoading(false);
      }
    };

    const timer = setTimeout(() => {
      fetchPopularPeople();
    }, searchTerm ? 400 : 0);

    return () => clearTimeout(timer);
  }, [searchTerm, page]);

  return (
    <>
      <SEO
        title="Acteurs & Réalisateurs · DAWGER"
        description="Explorez les acteurs, actrices et réalisateurs les plus populaires du cinéma et de la télévision."
        canonical="/acteurs"
      />

      <div className="min-h-screen bg-[#08080c] text-white pt-24 pb-20 px-4 sm:px-6">
        <div className="max-w-7xl mx-auto">
          
          {/* Header */}
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-10">
            <div>
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 mb-3">
                <Sparkles className="w-3.5 h-3.5" />
                Célébrités du 7ème Art
              </span>
              <h1 className="text-3xl sm:text-4xl font-black tracking-tight text-white">
                Acteurs & Réalisateurs
              </h1>
              <p className="mt-2 text-xs sm:text-sm text-zinc-400 max-w-xl">
                Découvrez les personnalités marquantes du cinéma, leur biographie complète et leur filmographie intégrale disponible sur Dawger.
              </p>
            </div>

            {/* Barre de recherche */}
            <div className="relative w-full md:w-80">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  setPage(1);
                }}
                placeholder="Rechercher un acteur, réalisateur..."
                className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-emerald-500/60 transition-colors"
              />
            </div>
          </div>

          {/* Grille de personnes */}
          {loading ? (
            <GridSkeleton />
          ) : people.length === 0 ? (
            <div className="text-center py-20 text-zinc-400 text-sm">
              Aucune personnalité trouvée pour cette recherche.
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4 sm:gap-6">
              {people.map((p) => {
                const imgUrl = p.profile_path
                  ? `https://image.tmdb.org/t/p/w342${p.profile_path}`
                  : null;

                const knownTitles = (p.known_for || [])
                  .map((k) => k.title || k.name)
                  .filter(Boolean)
                  .slice(0, 2)
                  .join(', ');

                return (
                  <Link
                    key={p.id}
                    to={`/person/${p.id}`}
                    className="group flex flex-col rounded-2xl bg-white/[0.03] hover:bg-white/[0.07] border border-white/[0.06] hover:border-emerald-500/40 overflow-hidden transition-all duration-300 hover:-translate-y-1 shadow-lg"
                  >
                    <div className="aspect-[2/3] w-full bg-zinc-900 relative overflow-hidden">
                      {imgUrl ? (
                        <img
                          src={imgUrl}
                          alt={p.name}
                          loading="lazy"
                          className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-zinc-600">
                          <User className="w-12 h-12" />
                        </div>
                      )}
                      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-80" />
                    </div>

                    <div className="p-3.5 flex flex-col flex-grow">
                      <h3 className="font-bold text-sm text-white group-hover:text-emerald-400 transition-colors line-clamp-1">
                        {p.name}
                      </h3>
                      <p className="text-[11px] text-emerald-400/80 font-mono mt-0.5">
                        {p.known_for_department === 'Acting'
                          ? 'Interprétation'
                          : p.known_for_department === 'Directing'
                          ? 'Réalisation'
                          : p.known_for_department}
                      </p>
                      {knownTitles && (
                        <p className="text-[11px] text-zinc-400 line-clamp-1 mt-1.5 flex items-center gap-1">
                          <Film className="w-3 h-3 shrink-0 opacity-60" />
                          <span>{knownTitles}</span>
                        </p>
                      )}
                    </div>
                  </Link>
                );
              })}
            </div>
          )}

          {/* Pagination simplifiée */}
          <div className="mt-12 flex items-center justify-center gap-3">
            <button
              onClick={() => setPage((prev) => Math.max(prev - 1, 1))}
              disabled={page === 1}
              className="px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-xs font-semibold hover:bg-white/10 disabled:opacity-40 transition-colors"
            >
              Page précédente
            </button>
            <span className="text-xs font-mono text-zinc-400 px-3">
              Page {page}
            </span>
            <button
              onClick={() => setPage((prev) => prev + 1)}
              className="px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-xs font-semibold hover:bg-white/10 transition-colors"
            >
              Page suivante
            </button>
          </div>

        </div>
      </div>
    </>
  );
};

export default ActeursPage;
