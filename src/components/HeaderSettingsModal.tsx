import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Settings, X, Instagram, ExternalLink, PlayCircle, Layers, 
  HelpCircle, MessageCircle, Sparkles, RefreshCw, Zap, Shield, 
  Tv, Volume2, Palette, ArrowRight 
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface HeaderSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultTab?: 'contact' | 'sources' | 'settings';
}

export const HeaderSettingsModal: React.FC<HeaderSettingsModalProps> = ({
  isOpen,
  onClose,
  defaultTab = 'contact',
}) => {
  const [activeTab, setActiveTab] = useState<'contact' | 'sources' | 'settings'>(defaultTab);
  const navigate = useNavigate();

  // Reset to default tab when opening
  useEffect(() => {
    if (isOpen) {
      setActiveTab(defaultTab);
    }
  }, [isOpen, defaultTab]);

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
          className="relative w-full max-w-2xl bg-zinc-950/95 border border-white/10 rounded-2xl sm:rounded-3xl shadow-2xl shadow-black/80 flex flex-col max-h-[90vh] overflow-hidden z-10"
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
                  Paramètres & Aide
                </h2>
                <p className="text-xs text-zinc-400">
                  Assistance, contact et fonctionnement des lecteurs
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

          {/* Navigation Tabs */}
          <div className="flex items-center gap-2 px-5 sm:px-6 pt-3 pb-1 border-b border-white/5 bg-zinc-900/40">
            <button
              type="button"
              onClick={() => setActiveTab('contact')}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs sm:text-sm font-medium transition-all duration-200 border ${
                activeTab === 'contact'
                  ? 'bg-gradient-to-r from-pink-500/15 to-purple-500/15 border-pink-500/30 text-pink-300 shadow-sm'
                  : 'bg-white/[0.03] border-transparent text-zinc-400 hover:text-white hover:bg-white/[0.06]'
              }`}
            >
              <Instagram className="w-4 h-4 text-pink-400" />
              <span>Contactez-moi</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('sources')}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs sm:text-sm font-medium transition-all duration-200 border ${
                activeTab === 'sources'
                  ? 'bg-gradient-to-r from-emerald-500/15 to-teal-500/15 border-emerald-500/30 text-emerald-300 shadow-sm'
                  : 'bg-white/[0.03] border-transparent text-zinc-400 hover:text-white hover:bg-white/[0.06]'
              }`}
            >
              <Layers className="w-4 h-4 text-emerald-400" />
              <span>Sources & Lecteurs</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('settings')}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs sm:text-sm font-medium transition-all duration-200 border ${
                activeTab === 'settings'
                  ? 'bg-gradient-to-r from-cyan-500/15 to-blue-500/15 border-cyan-500/30 text-cyan-300 shadow-sm'
                  : 'bg-white/[0.03] border-transparent text-zinc-400 hover:text-white hover:bg-white/[0.06]'
              }`}
            >
              <Settings className="w-4 h-4 text-cyan-400" />
              <span>Options de l'app</span>
            </button>
          </div>

          {/* Modal Body / Scrollable Content */}
          <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-6 text-zinc-300 text-sm">
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
                  {/* Subtle Background Glow */}
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
                      href="https://www.instagram.com/cineviseur_/"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl font-semibold text-xs sm:text-sm text-white bg-gradient-to-r from-pink-500 via-rose-500 to-amber-500 hover:from-pink-600 hover:to-amber-600 shadow-md shadow-pink-500/20 hover:shadow-pink-500/40 transition-all duration-200 transform hover:-translate-y-0.5"
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

            {/* TAB 2: SOURCES & LECTEURS */}
            {activeTab === 'sources' && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2 }}
                className="space-y-6"
              >
                {/* Section 1: Comment changer de source */}
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-emerald-400" />
                    <h3 className="text-sm sm:text-base font-bold text-white">
                      Comment changer de source ou de lecteur ?
                    </h3>
                  </div>

                  <div className="space-y-2.5">
                    <div className="flex items-start gap-3 p-3 rounded-xl bg-white/[0.03] border border-white/5">
                      <div className="w-6 h-6 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold text-xs shrink-0 mt-0.5">
                        1
                      </div>
                      <div>
                        <strong className="text-white text-xs sm:text-sm block">Repérez le panneau des sources</strong>
                        <p className="text-xs text-zinc-400 mt-0.5 leading-relaxed">
                          Sur chaque page de lecture (film ou épisode), retrouvez la liste des hébergeurs juste sous la vidéo via le bouton <span className="text-emerald-400 font-semibold">« Sources »</span> ou <span className="text-emerald-400 font-semibold">« Lecteurs »</span>.
                        </p>
                      </div>
                    </div>

                    <div className="flex items-start gap-3 p-3 rounded-xl bg-white/[0.03] border border-white/5">
                      <div className="w-6 h-6 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold text-xs shrink-0 mt-0.5">
                        2
                      </div>
                      <div>
                        <strong className="text-white text-xs sm:text-sm block">Basculez en 1 clic</strong>
                        <p className="text-xs text-zinc-400 mt-0.5 leading-relaxed">
                          Cliquez simplement sur un autre lecteur (<span className="text-white font-medium">VOE</span>, <span className="text-white font-medium">Vidmoly</span>, <span className="text-white font-medium">Streamtape</span>, <span className="text-white font-medium">Sendvid</span>...). Le flux démarre immédiatement sans recharger la page.
                        </p>
                      </div>
                    </div>

                    <div className="flex items-start gap-3 p-3 rounded-xl bg-white/[0.03] border border-white/5">
                      <div className="w-6 h-6 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold text-xs shrink-0 mt-0.5">
                        3
                      </div>
                      <div>
                        <strong className="text-white text-xs sm:text-sm block">Choisissez votre langue (VF / VOSTFR)</strong>
                        <p className="text-xs text-zinc-400 mt-0.5 leading-relaxed">
                          Sélectionnez les onglets <span className="text-white font-medium">VF</span> (Version Française) ou <span className="text-white font-medium">VOSTFR</span> (Version Originale Sous-Titrée). Les sources s'adaptent instantanément à la langue choisie.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Section 2: Comment fonctionnent les lecteurs */}
                <div className="space-y-3 pt-2 border-t border-white/5">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-cyan-400" />
                    <h3 className="text-sm sm:text-base font-bold text-white">
                      Comment fonctionnent les lecteurs vidéo ?
                    </h3>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="p-3.5 rounded-xl bg-emerald-950/20 border border-emerald-500/25 space-y-1.5">
                      <div className="flex items-center gap-2 text-emerald-400 font-semibold text-xs">
                        <Zap className="w-4 h-4" />
                        <span>VOE (Lecteur Recommandé)</span>
                      </div>
                      <p className="text-xs text-zinc-300 leading-relaxed">
                        Le serveur le plus rapide et le plus stable. Zéro pub intempestive, chargement instantané en HD 1080p et aucun buffering.
                      </p>
                    </div>

                    <div className="p-3.5 rounded-xl bg-white/[0.03] border border-white/10 space-y-1.5">
                      <div className="flex items-center gap-2 text-cyan-400 font-semibold text-xs">
                        <Shield className="w-4 h-4" />
                        <span>Vidmoly & Streamtape</span>
                      </div>
                      <p className="text-xs text-zinc-300 leading-relaxed">
                        Excellents serveurs de secours en cas de maintenance ou de forte affluence sur le serveur principal.
                      </p>
                    </div>

                    <div className="p-3.5 rounded-xl bg-white/[0.03] border border-white/10 space-y-1.5 sm:col-span-2">
                      <div className="flex items-center gap-2 text-amber-400 font-semibold text-xs">
                        <RefreshCw className="w-4 h-4" />
                        <span>Système Auto-Fallback Intelligent</span>
                      </div>
                      <p className="text-xs text-zinc-300 leading-relaxed">
                        Dawger vérifie la disponibilité des flux en direct. Si un lecteur est indisponible ou rencontre une erreur, l'application bascule automatiquement sur le lecteur suivant pour garantir une lecture fluide sans interruption.
                      </p>
                    </div>
                  </div>
                </div>

                {/* Tips */}
                <div className="p-3.5 rounded-xl bg-blue-950/20 border border-blue-500/20 text-xs text-blue-200/90 leading-relaxed">
                  💡 <strong className="text-white">Conseil pratique :</strong> Si une vidéo met plus de 5 secondes à se lancer ou affiche un écran noir, cliquez simplement sur le lecteur suivant dans la liste des sources pour relancer immédiatement la lecture.
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
                    Vous pouvez personnaliser Dawger à votre goût : changer les teintes d'arrière-plan, régler la sensibilité du défilement, activer les effets sonores, gérer vos profils et configurer l'ordre de priorité des hébergeurs.
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="p-3 rounded-xl bg-white/[0.02] border border-white/5 space-y-1">
                    <span className="text-xs font-semibold text-white block">Thèmes & Couleurs</span>
                    <p className="text-[11px] text-zinc-400">Arrière-plans améthyste, émeraude, cyan ou sombre pur.</p>
                  </div>
                  <div className="p-3 rounded-xl bg-white/[0.02] border border-white/5 space-y-1">
                    <span className="text-xs font-semibold text-white block">Priorité des Sources</span>
                    <p className="text-[11px] text-zinc-400">Choisissez quel hébergeur (VOE, Vidmoly...) charger en premier.</p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    navigate('/settings');
                  }}
                  className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-semibold text-xs sm:text-sm transition-all duration-200 shadow-md shadow-cyan-600/20"
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
