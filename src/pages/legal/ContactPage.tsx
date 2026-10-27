import React from 'react';
import {
  MessageCircle,
  Send,
  Mail,
  HelpCircle,
  Phone,
  Clock,
  Sparkles,
  ArrowUpRight,
  Shield,
  Users
} from 'lucide-react';
import { PrefetchLink as Link } from '@/routing/PrefetchLink';
import SEO from '../../components/SEO';

const ContactPage: React.FC = () => {
  return (
    <>
      <SEO
        title="Contact & Support · DAWGER"
        description="Une question, un souci technique ou une proposition de partenariat ? Contactez l'équipe Dawger via WhatsApp, Telegram, Discord ou e-mail."
        canonical="/contact"
      />

      <div className="min-h-screen bg-[#08080c] text-white pt-24 pb-20 px-4 sm:px-6">
        <div className="max-w-4xl mx-auto">
          
          {/* Header */}
          <div className="text-center mb-12">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 mb-4">
              <Sparkles className="w-3.5 h-3.5" />
              Assistance & Échanges
            </span>
            <h1 className="text-3xl sm:text-4xl font-black tracking-tight text-white">
              Nous contacter
            </h1>
            <p className="mt-3 text-sm sm:text-base text-zinc-400 max-w-xl mx-auto leading-relaxed">
              Une question, un bug à signaler, une idée d'amélioration ou une demande de partenariat ? Choisissez le moyen qui vous convient le mieux, on répond rapidement.
            </p>
          </div>

          {/* Cartes de contact principales */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-10">

            {/* WHATSAPP & SMS */}
            <div className="rounded-3xl border border-emerald-500/30 bg-gradient-to-b from-[#0e241d] to-[#07130f] p-6 shadow-xl flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-4">
                  <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 flex items-center justify-center text-emerald-400">
                    <svg className="w-6 h-6" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M12 2C6.48 2 2 6.48 2 12c0 1.82.49 3.53 1.34 5L2 22l5.14-1.31C8.57 21.53 10.23 22 12 22c5.52 0 10-4.48 10-10S17.52 2 12 2zm0 18c-1.54 0-2.98-.44-4.21-1.2l-.3-.19-3.04.78.81-2.97-.2-.32C4.31 14.88 3.8 13.5 3.8 12c0-4.52 3.68-8.2 8.2-8.2s8.2 3.68 8.2 8.2-3.68 8.2-8.2 8.2zm4.56-6.14l-1.68-.84c-.24-.12-.52-.09-.72.07l-.75.6c-.19.15-.45.17-.66.05-1.42-.81-2.58-1.97-3.39-3.39-.12-.21-.1-.47.05-.66l.6-.75c.16-.2.19-.48.07-.72l-.84-1.68c-.16-.32-.52-.48-.86-.38l-1.2.36c-.41.12-.7.48-.73.91-.18 2.5 1.05 4.97 3.1 7.02 2.05 2.05 4.52 3.28 7.02 3.1.43-.03.79-.32.91-.73l.36-1.2c.1-.34-.06-.7-.38-.86z"/>
                    </svg>
                  </div>
                  <span className="text-[11px] font-semibold px-2.5 py-1 rounded-full bg-emerald-400 text-black">
                    SMS non surtaxés
                  </span>
                </div>

                <h2 className="text-xl font-bold text-white mb-2">WhatsApp ou SMS</h2>
                <p className="text-xs sm:text-sm text-zinc-300 leading-relaxed mb-4">
                  Idéal pour une réponse directe sur votre smartphone.
                </p>

                <div className="flex items-center gap-2 text-xs text-zinc-400 mb-2">
                  <Clock className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>Du lundi au vendredi : 18 h – 23 h</span>
                </div>
                <div className="flex items-center gap-2 text-xs text-zinc-400 mb-6">
                  <Clock className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>Le week-end : 13 h – minuit</span>
                </div>
              </div>

              <a
                href="https://wa.me/33695606127"
                target="_blank"
                rel="noopener noreferrer"
                className="w-full inline-flex items-center justify-center gap-2 py-3 px-4 rounded-xl font-bold text-sm bg-emerald-400 text-black hover:bg-emerald-300 transition-colors shadow-lg shadow-emerald-500/20"
              >
                <Phone className="w-4 h-4" />
                <span>06 95 60 61 27</span>
                <ArrowUpRight className="w-4 h-4 ml-auto" />
              </a>
            </div>

            {/* TELEGRAM */}
            <div className="rounded-3xl border border-sky-500/30 bg-gradient-to-b from-[#0c202a] to-[#061016] p-6 shadow-xl flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-4">
                  <div className="w-12 h-12 rounded-2xl bg-sky-500/20 flex items-center justify-center text-sky-400">
                    <Send className="w-6 h-6" />
                  </div>
                  <span className="text-[11px] font-semibold px-2.5 py-1 rounded-full bg-sky-400 text-black">
                    Réponse ultra-rapide
                  </span>
                </div>

                <h2 className="text-xl font-bold text-white mb-2">Support Telegram</h2>
                <p className="text-xs sm:text-sm text-zinc-300 leading-relaxed mb-6">
                  Le canal le plus réactif pour discuter avec les développeurs et les administrateurs de Dawger. Suivez également les nouveaux miroirs et mises à jour.
                </p>
              </div>

              <a
                href="https://t.me/movix_site"
                target="_blank"
                rel="noopener noreferrer"
                className="w-full inline-flex items-center justify-center gap-2 py-3 px-4 rounded-xl font-bold text-sm bg-sky-400 text-black hover:bg-sky-300 transition-colors shadow-lg shadow-sky-500/20"
              >
                <Send className="w-4 h-4" />
                <span>Rejoindre le Telegram</span>
                <ArrowUpRight className="w-4 h-4 ml-auto" />
              </a>
            </div>

            {/* DISCORD */}
            <div className="rounded-3xl border border-indigo-500/30 bg-gradient-to-b from-[#15152a] to-[#0a0a16] p-6 shadow-xl flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-4">
                  <div className="w-12 h-12 rounded-2xl bg-indigo-500/20 flex items-center justify-center text-indigo-400">
                    <Users className="w-6 h-6" />
                  </div>
                  <span className="text-[11px] font-semibold px-2.5 py-1 rounded-full bg-indigo-400 text-black">
                    Communauté
                  </span>
                </div>

                <h2 className="text-xl font-bold text-white mb-2">Serveur Discord</h2>
                <p className="text-xs sm:text-sm text-zinc-300 leading-relaxed mb-6">
                  Rejoignez des milliers de membres pour discuter films et séries, échanger dans les salons d'entraide ou lancer des sessions de Watch Party.
                </p>
              </div>

              <a
                href="https://discord.gg/dawger"
                target="_blank"
                rel="noopener noreferrer"
                className="w-full inline-flex items-center justify-center gap-2 py-3 px-4 rounded-xl font-bold text-sm bg-indigo-400 text-black hover:bg-indigo-300 transition-colors"
              >
                <span>Accéder au Discord</span>
                <ArrowUpRight className="w-4 h-4 ml-auto" />
              </a>
            </div>

            {/* TICKETS & CENTRE D'AIDE */}
            <div className="rounded-3xl border border-white/10 bg-white/5 p-6 shadow-xl flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-4">
                  <div className="w-12 h-12 rounded-2xl bg-white/10 flex items-center justify-center text-white">
                    <HelpCircle className="w-6 h-6 text-emerald-400" />
                  </div>
                  <span className="text-[11px] font-semibold px-2.5 py-1 rounded-full bg-white/10 text-zinc-300">
                    Guide & Tutos
                  </span>
                </div>

                <h2 className="text-xl font-bold text-white mb-2">Centre d'aide & Tutos</h2>
                <p className="text-xs sm:text-sm text-zinc-300 leading-relaxed mb-6">
                  Une question sur le changement de lecteur, le paramétrage DNS ou l'installation de l'application sur Smart TV ? Consultez nos 25 tutoriels complets.
                </p>
              </div>

              <Link
                to="/help"
                className="w-full inline-flex items-center justify-center gap-2 py-3 px-4 rounded-xl font-bold text-sm bg-white/10 hover:bg-white/20 text-white transition-colors"
              >
                <span>Explorer les guides</span>
                <ArrowUpRight className="w-4 h-4 ml-auto" />
              </Link>
            </div>

          </div>

          {/* Boîte légale / DMCA & Partenariat */}
          <div className="rounded-3xl border border-white/10 bg-black/40 p-6 sm:p-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
            <div className="max-w-xl">
              <h3 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
                <Shield className="w-5 h-5 text-emerald-400" />
                Réclamations DMCA & Droit d'auteur
              </h3>
              <p className="mt-1.5 text-xs sm:text-sm text-zinc-400 leading-relaxed">
                Dawger agit exclusivement en tant qu’agrégateur de flux publics et n’héberge aucun fichier. Pour tout signalement de contenu ou réclamation formelle, vous pouvez consulter notre page dédiée ou nous contacter par mail.
              </p>
            </div>
            <Link
              to="/dmca"
              className="shrink-0 px-5 py-2.5 rounded-xl text-xs sm:text-sm font-semibold bg-white/10 hover:bg-white/15 text-white transition-colors border border-white/10"
            >
              Page DMCA
            </Link>
          </div>

        </div>
      </div>
    </>
  );
};

export default ContactPage;
