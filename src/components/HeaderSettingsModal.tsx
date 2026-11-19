import React, { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Settings, X, Instagram, ExternalLink, Layers,
  MessageCircle, Sparkles, RefreshCw, Zap, Shield,
  Palette, ArrowRight, Star, Play, Trash2, Film, Tv2, Maximize2, Gauge
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { encodeId } from '../utils/idEncoder';

export type HeaderSettingsTab = 'mylist' | 'contact' | 'sources' | 'settings';

interface HeaderSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultTab?: HeaderSettingsTab;
}

interface WatchlistPreviewItem {
  id: number;
  type: 'movie' | 'tv' | 'collection';
  title: string;
  poster_path?: string;
  addedAt?: string;
}

function getStoredWatchlistItems(): WatchlistPreviewItem[] {
  const results: WatchlistPreviewItem[] = [];
  const sources: Array<{ key: string; defaultType: 'movie' | 'tv' | 'collection' }> = [
    { key: 'watchlist_movie', defaultType: 'movie' },
    { key: 'watchlist_tv', defaultType: 'tv' },
    { key: 'watchlist_collections', defaultType: 'collection' },
  ];

  for (const { key, defaultType } of sources) {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) continue;
      const arr = JSON.parse(raw);
      if (!Array.isArray(arr)) continue;
      for (const item of arr) {
        if (item && typeof item.id === 'number') {
          results.push({
            id: item.id,
            type: item.type === 'tv' || item.type === 'collection' || item.type === 'movie' ? item.type : defaultType,
            title: item.title || item.name || 'Sans titre',
            poster_path: item.poster_path,
            addedAt: item.addedAt,
          });
        }
      }
    } catch {
      // ignore
    }
  }

  return results.sort((a, b) => {
    const tA = a.addedAt ? new Date(a.addedAt).getTime() : 0;
    const tB = b.addedAt ? new Date(b.addedAt).getTime() : 0;
    return tB - tA;
  });
}

export const HeaderSettingsModal: React.FC<HeaderSettingsModalProps> = ({
  isOpen,
  onClose,
  defaultTab = 'mylist',
}) => {
  const [activeTab, setActiveTab] = useState<HeaderSettingsTab>(defaultTab);
  const [watchlistItems, setWatchlistItems] = useState<WatchlistPreviewItem[]>(() => getStoredWatchlistItems());
  const navigate = useNavigate();

  const refreshWatchlist = useCallback(() => {
    setWatchlistItems(getStoredWatchlistItems());
  }, []);

  // Reset to default tab when opening
  useEffect(() => {
    if (isOpen) {
      setActiveTab(defaultTab);
      refreshWatchlist();
    }
  }, [isOpen, defaultTab, refreshWatchlist]);

  useEffect(() => {
    window.addEventListener('watchlist_updated', refreshWatchlist);
    window.addEventListener('storage', refreshWatchlist);
    return () => {
      window.removeEventListener('watchlist_updated', refreshWatchlist);
      window.removeEventListener('storage', refreshWatchlist);
    };
  }, [refreshWatchlist]);

  const removeFromWatchlist = useCallback((item: WatchlistPreviewItem) => {
    const key =
      item.type === 'collection'
        ? 'watchlist_collections'
        : item.type === 'tv'
          ? 'watchlist_tv'
          : 'watchlist_movie';
    try {
      const list = JSON.parse(localStorage.getItem(key) || '[]');
      const next = Array.isArray(list) ? list.filter((m: any) => m.id !== item.id) : [];
      localStorage.setItem(key, JSON.stringify(next));
      window.dispatchEvent(new CustomEvent('watchlist_updated'));
      refreshWatchlist();
    } catch {
      // ignore
    }
  }, [refreshWatchlist]);

  // Handle Escape key
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return createPortal(
    <AnimatePresence>
      <div className="fixed inset-0 z-[15000] flex items-center justify-center p-3 sm:p-4 md:p-6 overflow-y-auto">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          onClick={onClose}
          className="fixed inset-0 bg-black/80 backdrop-blur-md"
        />

        {/* Modal Window */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          className="relative w-full max-w-3xl bg-zinc-950/95 border border-white/10 rounded-2xl sm:rounded-3xl shadow-2xl shadow-black/80 flex flex-col max-h-[90vh] overflow-hidden z-10"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-5 sm:px-6 py-4 border-b border-white/10 bg-white/[0.02]">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-500/20 to-teal-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                <Settings className="w-5 h-5 animate-[spin_10s_linear_infinite]" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-white flex items-center gap-2">
                  Ma Liste, Paramètres & Aide
                </h2>
                <p className="text-xs text-zinc-400">
                  Vos favoris ⭐, assistance, contact et guide des lecteurs 1080p/4K
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 text-zinc-400 hover:text-white flex items-center justify-center transition-colors"
              aria-label="Fermer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Navigation Tabs — Balanced 4-column grid, zero horizontal scroll or arrows */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 px-5 sm:px-6 py-3 border-b border-white/5 bg-zinc-900/40">
            <button
              type="button"
              onClick={() => setActiveTab('mylist')}
              className={`flex items-center justify-center gap-1.5 px-2.5 py-2 rounded-xl text-xs font-semibold transition-all duration-200 border whitespace-nowrap cursor-pointer ${
                activeTab === 'mylist'
                  ? 'bg-gradient-to-r from-yellow-500/20 to-amber-500/15 border-yellow-400/40 text-yellow-300 shadow-sm'
                  : 'bg-white/[0.03] border-transparent text-zinc-400 hover:text-white hover:bg-white/[0.06]'
              }`}
            >
              <Star className="w-3.5 h-3.5 text-yellow-400 shrink-0" fill="currentColor" />
              <span>Ma Liste</span>
              <span className="px-1.5 py-0.2 rounded-full text-[10px] font-mono bg-yellow-500/20 text-yellow-300 border border-yellow-400/30">
                {watchlistItems.length}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('contact')}
              className={`flex items-center justify-center gap-1.5 px-2.5 py-2 rounded-xl text-xs font-semibold transition-all duration-200 border whitespace-nowrap cursor-pointer ${
                activeTab === 'contact'
                  ? 'bg-gradient-to-r from-pink-500/15 to-purple-500/15 border-pink-500/30 text-pink-300 shadow-sm'
                  : 'bg-white/[0.03] border-transparent text-zinc-400 hover:text-white hover:bg-white/[0.06]'
              }`}
            >
              <Instagram className="w-3.5 h-3.5 text-pink-400 shrink-0" />
              <span>Contactez-moi</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('sources')}
              className={`flex items-center justify-center gap-1.5 px-2.5 py-2 rounded-xl text-xs font-semibold transition-all duration-200 border whitespace-nowrap cursor-pointer ${
                activeTab === 'sources'
                  ? 'bg-gradient-to-r from-emerald-500/15 to-teal-500/15 border-emerald-500/30 text-emerald-300 shadow-sm'
                  : 'bg-white/[0.03] border-transparent text-zinc-400 hover:text-white hover:bg-white/[0.06]'
              }`}
            >
              <Layers className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              <span>Sources & Lecteurs</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('settings')}
              className={`flex items-center justify-center gap-1.5 px-2.5 py-2 rounded-xl text-xs font-semibold transition-all duration-200 border whitespace-nowrap cursor-pointer ${
                activeTab === 'settings'
                  ? 'bg-gradient-to-r from-cyan-500/15 to-blue-500/15 border-cyan-500/30 text-cyan-300 shadow-sm'
                  : 'bg-white/[0.03] border-transparent text-zinc-400 hover:text-white hover:bg-white/[0.06]'
              }`}
            >
              <Settings className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
              <span>Options de l'app</span>
            </button>
          </div>

          {/* Modal Body / Scrollable Content */}
          <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-6 text-zinc-300 text-sm">
            {/* TAB 0: MA LISTE (FAVORIS ÉTOILE ⭐) */}
            {activeTab === 'mylist' && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2 }}
                className="space-y-4"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-2xl bg-gradient-to-r from-yellow-500/10 via-amber-500/5 to-transparent border border-yellow-500/25">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-yellow-500/20 border border-yellow-400/40 flex items-center justify-center text-yellow-400 shrink-0">
                      <Star className="w-5 h-5" fill="currentColor" />
                    </div>
                    <div>
                      <h3 className="text-sm sm:text-base font-bold text-white">
                        Vos films, séries et sagas enregistrés ({watchlistItems.length})
                      </h3>
                      <p className="text-xs text-zinc-400">
                        Ajoutez une œuvre via l'étoile ⭐ ou le bouton « Ma liste » de l'aperçu Teaser.
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      navigate('/ma-liste');
                    }}
                    className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-yellow-500 hover:bg-yellow-400 text-black font-bold text-xs transition-all shrink-0 cursor-pointer shadow-md shadow-yellow-500/20"
                  >
                    <span>Ouvrir la page Ma Liste</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>

                {watchlistItems.length === 0 ? (
                  <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-6 text-center space-y-2.5">
                    <Star className="w-8 h-8 text-yellow-400/60 mx-auto" />
                    <p className="text-sm font-bold text-white">Aucun favori dans Ma Liste</p>
                    <p className="text-xs text-zinc-400 max-w-md mx-auto leading-relaxed">
                      Cliquez sur n'importe quelle affiche pour ouvrir son Teaser, puis cliquez sur <strong className="text-yellow-300">« Ma liste »</strong> (ou sur l'étoile ⭐ en haut de l'affiche) pour la retrouver ici à tout moment.
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-h-[340px] overflow-y-auto pr-1">
                    {watchlistItems.slice(0, 12).map((item) => {
                      const path =
                        item.type === 'collection'
                          ? `/collection/${encodeId(item.id)}`
                          : `/${item.type}/${encodeId(item.id)}`;
                      return (
                        <div
                          key={`${item.type}-${item.id}`}
                          className="flex items-center justify-between gap-3 p-2.5 rounded-xl bg-white/[0.03] hover:bg-white/[0.06] border border-white/10 transition-colors"
                        >
                          <div
                            onClick={() => {
                              onClose();
                              navigate(path);
                            }}
                            className="flex items-center gap-3 min-w-0 flex-1 cursor-pointer"
                          >
                            {item.poster_path ? (
                              <img
                                src={`https://image.tmdb.org/t/p/w154${item.poster_path}`}
                                alt={item.title}
                                className="w-11 h-16 object-cover rounded-lg shrink-0 bg-zinc-900"
                              />
                            ) : (
                              <div className="w-11 h-16 rounded-lg bg-zinc-900 flex items-center justify-center shrink-0">
                                {item.type === 'tv' ? <Tv2 className="w-4 h-4 text-zinc-500" /> : <Film className="w-4 h-4 text-zinc-500" />}
                              </div>
                            )}
                            <div className="min-w-0 flex-1">
                              <span className="text-[10px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded bg-white/10 text-zinc-300">
                                {item.type === 'tv' ? 'Série' : item.type === 'collection' ? 'Saga' : 'Film'}
                              </span>
                              <h4 className="text-xs sm:text-sm font-bold text-white truncate mt-1">
                                {item.title}
                              </h4>
                            </div>
                          </div>

                          <div className="flex items-center gap-1.5 shrink-0">
                            <button
                              type="button"
                              onClick={() => {
                                onClose();
                                navigate(path);
                              }}
                              className="px-2.5 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-black font-bold text-xs flex items-center gap-1 transition-colors cursor-pointer"
                              title="Regarder"
                            >
                              <Play className="w-3.5 h-3.5 fill-current" />
                              <span>Regarder</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => removeFromWatchlist(item)}
                              className="p-1.5 rounded-lg bg-white/5 hover:bg-red-500/20 text-zinc-400 hover:text-red-300 transition-colors cursor-pointer"
                              title="Retirer de Ma liste"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </motion.div>
            )}

            {/* TAB 1: CONTACT */}
            {activeTab === 'contact' && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2 }}
                className="space-y-5"
              >
                {/* Instagram Hero Card */}
                <div className="relative overflow-hidden rounded-2xl border border-pink-500/30 bg-gradient-to-br from-pink-950/40 via-purple-950/20 to-black p-5 sm:p-6 shadow-xl">
                  <div className="absolute -top-16 -right-16 w-40 h-40 bg-pink-500/20 rounded-full blur-3xl pointer-events-none" />
                  <div className="absolute -bottom-16 -left-16 w-40 h-40 bg-amber-500/15 rounded-full blur-3xl pointer-events-none" />

                  <div className="relative flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                    <div className="flex items-center gap-4">
                      <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-amber-500 via-pink-500 to-purple-600 p-[2px] shadow-lg shadow-pink-500/25 shrink-0">
                        <div className="w-full h-full bg-zinc-950 rounded-[14px] flex items-center justify-center text-pink-400">
                          <Instagram className="w-7 h-7" />
                        </div>
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="text-base sm:text-lg font-bold text-white">
                            Dawger
                          </h3>
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-pink-500/20 text-pink-300 border border-pink-500/30">
                            Instagram Officiel
                          </span>
                        </div>
                        <p className="text-xs text-zinc-400 mt-0.5">
                          Support & Contact Direct
                        </p>
                      </div>
                    </div>

                    <a
                      href="https://www.instagram.com/cineviseur_dawger/"
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        window.open('https://www.instagram.com/cineviseur_dawger/', '_blank', 'noopener,noreferrer');
                      }}
                      className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl font-semibold text-xs sm:text-sm text-white bg-gradient-to-r from-pink-500 via-rose-500 to-amber-500 hover:from-pink-600 hover:to-amber-600 shadow-md shadow-pink-500/20 hover:shadow-pink-500/40 transition-all duration-200 transform hover:-translate-y-0.5 cursor-pointer"
                    >
                      <Instagram className="w-4 h-4" />
                      <span>Ouvrir Instagram</span>
                      <ExternalLink className="w-3.5 h-3.5 opacity-80" />
                    </a>
                  </div>

                  <p className="relative mt-4 text-xs sm:text-sm text-zinc-300 leading-relaxed">
                    Une question, une suggestion d'amélioration, un lien mort à signaler ou une demande d'ajout d'œuvre (film, série, animé) ?
                    <strong className="text-white font-medium"> Envoyez-moi directement un message privé (DM) sur Instagram</strong>, je réponds rapidement !
                  </p>
                </div>

                {/* Info Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="p-3.5 rounded-xl bg-white/[0.03] border border-white/5 space-y-1">
                    <div className="flex items-center gap-2 text-pink-400 font-semibold text-xs">
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>Ajouts d'œuvres</span>
                    </div>
                    <p className="text-[11px] text-zinc-400 leading-normal">
                      Un film ou un anime manquant ? Envoyez son titre et il sera ajouté en priorité.
                    </p>
                  </div>

                  <div className="p-3.5 rounded-xl bg-white/[0.03] border border-white/5 space-y-1">
                    <div className="flex items-center gap-2 text-amber-400 font-semibold text-xs">
                      <RefreshCw className="w-3.5 h-3.5" />
                      <span>Signalement de liens</span>
                    </div>
                    <p className="text-[11px] text-zinc-400 leading-normal">
                      Un lecteur ou un épisode ne marche pas ? Signalez-le pour une réparation express.
                    </p>
                  </div>

                  <div className="p-3.5 rounded-xl bg-white/[0.03] border border-white/5 space-y-1">
                    <div className="flex items-center gap-2 text-emerald-400 font-semibold text-xs">
                      <MessageCircle className="w-3.5 h-3.5" />
                      <span>Support direct</span>
                    </div>
                    <p className="text-[11px] text-zinc-400 leading-normal">
                      Échange direct avec le créateur pour toute question ou retour d'expérience.
                    </p>
                  </div>
                </div>
              </motion.div>
            )}

            {/* TAB 2: SOURCES & LECTEURS (MIS À JOUR AVEC LECTEUR 1080p/4K & TOUS LES LECTEURS) */}
            {activeTab === 'sources' && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2 }}
                className="space-y-6"
              >
                {/* Section 1: Comment changer de source (normal & plein écran) */}
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-emerald-400" />
                    <h3 className="text-sm sm:text-base font-bold text-white">
                      Comment utiliser et changer de lecteur (1080p / 4K & Sources) ?
                    </h3>
                  </div>

                  <div className="space-y-2.5">
                    <div className="flex items-start gap-3 p-3 rounded-xl bg-white/[0.03] border border-white/5">
                      <div className="w-6 h-6 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold text-xs shrink-0 mt-0.5">
                        1
                      </div>
                      <div>
                        <strong className="text-white text-xs sm:text-sm block">Lecteur 1080p / 4K sélectionné par défaut</strong>
                        <p className="text-xs text-zinc-400 mt-0.5 leading-relaxed">
                          Lorsqu'un flux haute définition <span className="text-emerald-400 font-semibold">1080p / 4K (Miaw / Webflix HLS)</span> est disponible, Dawger le charge en priorité avec le lecteur maison : zéro publicité, sélection de la résolution jusqu'en 4K, pistes audio multiples et sous-titres personnalisables.
                        </p>
                      </div>
                    </div>

                    <div className="flex items-start gap-3 p-3 rounded-xl bg-white/[0.03] border border-white/5">
                      <div className="w-6 h-6 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold text-xs shrink-0 mt-0.5">
                        2
                      </div>
                      <div>
                        <strong className="text-white text-xs sm:text-sm block">Changement de lecteur en 1 clic (même en Plein Écran)</strong>
                        <p className="text-xs text-zinc-400 mt-0.5 leading-relaxed">
                          Utilisez le sélecteur <span className="text-emerald-400 font-semibold">« Sources / Lecteurs »</span> au-dessus de la vidéo, ou directement la <span className="text-white font-medium">barre supérieure en mode Plein Écran</span> pour passer d'un lecteur à l'autre (<span className="text-white font-medium">Lecteur 1080p/4K</span>, <span className="text-white font-medium">Vidzy</span>, <span className="text-white font-medium">Moviez</span>, <span className="text-white font-medium">Omega</span>, <span className="text-white font-medium">Coflix</span>, <span className="text-white font-medium">FStream</span>, <span className="text-white font-medium">VOE</span>, <span className="text-white font-medium">Vidmoly</span>, <span className="text-white font-medium">Sibnet</span>, <span className="text-white font-medium">Uqload</span>) sans jamais quitter le mode plein écran.
                        </p>
                      </div>
                    </div>

                    <div className="flex items-start gap-3 p-3 rounded-xl bg-white/[0.03] border border-white/5">
                      <div className="w-6 h-6 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold text-xs shrink-0 mt-0.5">
                        3
                      </div>
                      <div>
                        <strong className="text-white text-xs sm:text-sm block">Choix de la langue (VF / VOSTFR / Multi)</strong>
                        <p className="text-xs text-zinc-400 mt-0.5 leading-relaxed">
                          Basculez entre <span className="text-white font-medium">VF</span> (Version Française) et <span className="text-white font-medium">VOSTFR</span> (Version Originale Sous-Titrée). Sur le lecteur 1080p/4K, vous pouvez aussi changer de piste audio ou de sous-titres directement depuis l'icône de réglages du lecteur.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Section 2: Catalogue complet des lecteurs */}
                <div className="space-y-3 pt-2 border-t border-white/5">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-cyan-400" />
                    <h3 className="text-sm sm:text-base font-bold text-white">
                      Guide des lecteurs disponibles dans Dawger
                    </h3>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="p-3.5 rounded-xl bg-emerald-950/25 border border-emerald-500/35 space-y-1.5 sm:col-span-2">
                      <div className="flex items-center justify-between gap-2 text-emerald-400 font-semibold text-xs">
                        <span className="flex items-center gap-2">
                          <Gauge className="w-4 h-4" />
                          <span>Lecteur Natif 1080p / 4K (Miaw & Webflix HLS)</span>
                        </span>
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-emerald-500/20 text-emerald-300 border border-emerald-400/30">
                          PRIORITAIRE &bull; ULTRA HD
                        </span>
                      </div>
                      <p className="text-xs text-zinc-300 leading-relaxed">
                        Flux vidéo direct intégré au lecteur Dawger : qualité maximale <strong>1080p Full HD et 4K Ultra HD</strong>, reprise automatique de lecture, changement de piste audio/sous-titres à la volée, mode Ambilight et zéro fenêtre publicitaire.
                      </p>
                    </div>

                    <div className="p-3.5 rounded-xl bg-white/[0.03] border border-white/10 space-y-1.5">
                      <div className="flex items-center gap-2 text-purple-300 font-semibold text-xs">
                        <Zap className="w-4 h-4" />
                        <span>Vidzy, Moviez, Omega, Coflix & FStream</span>
                      </div>
                      <p className="text-xs text-zinc-300 leading-relaxed">
                        Sources multi-serveurs haute disponibilité en <strong>1080p HD</strong> (VF & VOSTFR) encapsulées dans l'interface plein écran sans bordure de Dawger.
                      </p>
                    </div>

                    <div className="p-3.5 rounded-xl bg-white/[0.03] border border-white/10 space-y-1.5">
                      <div className="flex items-center gap-2 text-cyan-400 font-semibold text-xs">
                        <Shield className="w-4 h-4" />
                        <span>VOE, Vidmoly, Sibnet & Uqload</span>
                      </div>
                      <p className="text-xs text-zinc-300 leading-relaxed">
                        Hébergeurs rapides et fiables pour les films, séries et animés (720p / 1080p) avec blocage automatique des pop-ups publicitaires.
                      </p>
                    </div>

                    <div className="p-3.5 rounded-xl bg-white/[0.03] border border-white/10 space-y-1.5 sm:col-span-2">
                      <div className="flex items-center gap-2 text-amber-400 font-semibold text-xs">
                        <Maximize2 className="w-4 h-4" />
                        <span>Plein Écran Persistant & Auto-Fallback Intelligent</span>
                      </div>
                      <p className="text-xs text-zinc-300 leading-relaxed">
                        Que vous passiez du lecteur <strong>1080p/4K</strong> vers un lecteur externe (<strong>Vidzy, VOE, Moviez...</strong>) ou inversement, Dawger conserve votre écran en mode Plein Écran sans coupure. Si une source ne répond pas, le système bascule automatiquement sur le lecteur suivant.
                      </p>
                    </div>
                  </div>
                </div>

                {/* Shortcut to full tutorials */}
                <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-3.5 rounded-xl bg-blue-950/20 border border-blue-500/20 text-xs text-blue-200/90">
                  <span>💡 Vous pouvez aussi personnaliser l'ordre de priorité de vos lecteurs dans les paramètres ou consulter le Centre d'Aide complet.</span>
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      navigate('/help');
                    }}
                    className="px-3.5 py-2 rounded-lg bg-blue-500/20 hover:bg-blue-500/30 border border-blue-400/30 text-blue-200 font-semibold shrink-0 transition-colors cursor-pointer"
                  >
                    Tous les tutoriels &rarr;
                  </button>
                </div>
              </motion.div>
            )}

            {/* TAB 3: APP SETTINGS SHORTCUT */}
            {activeTab === 'settings' && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2 }}
                className="space-y-4"
              >
                <div className="p-4 rounded-xl bg-white/[0.03] border border-white/10 space-y-2">
                  <h3 className="text-sm font-bold text-white flex items-center gap-2">
                    <Palette className="w-4 h-4 text-cyan-400" />
                    Personnalisation & Options de Dawger
                  </h3>
                  <p className="text-xs text-zinc-400 leading-relaxed">
                    Personnalisez Dawger à votre goût : changez les teintes d'arrière-plan, réglez la sensibilité du défilement, activez les effets visuels, gérez vos données locales et configurez l'ordre de priorité des lecteurs (1080p/4K, Vidzy, VOE, Vidmoly...).
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="p-3 rounded-xl bg-white/[0.02] border border-white/5 space-y-1">
                    <span className="text-xs font-semibold text-white block">Thèmes & Couleurs</span>
                    <p className="text-[11px] text-zinc-400">Arrière-plans améthyste, émeraude, cyan ou sombre pur.</p>
                  </div>
                  <div className="p-3 rounded-xl bg-white/[0.02] border border-white/5 space-y-1">
                    <span className="text-xs font-semibold text-white block">Priorité des Sources (1080p / 4K)</span>
                    <p className="text-[11px] text-zinc-400">Choisissez quels lecteurs charger en premier sur chaque film et série.</p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    navigate('/settings');
                  }}
                  className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-semibold text-xs sm:text-sm transition-all duration-200 shadow-md shadow-cyan-600/20 cursor-pointer"
                >
                  <Settings className="w-4 h-4" />
                  <span>Ouvrir la page complète des paramètres</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </motion.div>
            )}
          </div>

          {/* Footer bar */}
          <div className="px-5 sm:px-6 py-3 border-t border-white/10 bg-white/[0.02] flex items-center justify-between text-xs text-zinc-500">
            <span>Dawger</span>
            <button
              type="button"
              onClick={onClose}
              className="text-zinc-400 hover:text-white transition-colors"
            >
              Fermer
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>,
    document.body
  );
};

export default HeaderSettingsModal;
