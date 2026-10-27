import React, { useState } from 'react';
import {
  Sparkles,
  DollarSign,
  Video,
  CheckCircle,
  HelpCircle,
  Send,
  ArrowRight,
  TrendingUp,
  ShieldCheck
} from 'lucide-react';
import SEO from '../../components/SEO';

const NETWORKS = [
  { id: 'tiktok', label: 'TikTok', color: 'from-pink-500 to-rose-500' },
  { id: 'instagram', label: 'Instagram', color: 'from-purple-500 to-pink-500' },
  { id: 'youtube', label: 'YouTube', color: 'from-red-500 to-red-600' },
  { id: 'x', label: 'X (Twitter)', color: 'from-zinc-700 to-zinc-900' },
  { id: 'twitch', label: 'Twitch', color: 'from-purple-600 to-indigo-600' },
  { id: 'snapchat', label: 'Snapchat', color: 'from-yellow-400 to-amber-500' },
];

const InfluenceursPage: React.FC = () => {
  const [formData, setFormData] = useState({
    pseudo: '',
    email: '',
    network: 'tiktok',
    accountUrl: '',
    subscribers: '',
    message: ''
  });
  const [status, setStatus] = useState<'idle' | 'loading' | 'success'>('idle');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.email || !formData.accountUrl) return;
    setStatus('loading');
    setTimeout(() => {
      setStatus('success');
    }, 800);
  };

  return (
    <>
      <SEO
        title="Influenceurs & Créateurs · DAWGER"
        description="Une collaboration rémunérée avec Dawger : proposez vos contenus sur TikTok, Instagram, YouTube ou X et gagnez un revenu direct."
        canonical="/influenceurs"
      />

      <div className="min-h-screen bg-[#08080c] text-white pt-24 pb-24 px-4 sm:px-6">
        <div className="max-w-4xl mx-auto">
          
          {/* Header Hero */}
          <div className="text-center mb-16">
            <span className="inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 mb-4">
              <Sparkles className="w-3.5 h-3.5" />
              Programme Partenaires & Créateurs
            </span>
            <h1 className="text-3xl sm:text-5xl font-black tracking-tight text-white">
              Une collab rémunérée avec <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-teal-300">DAWGER</span>
            </h1>
            <p className="mt-4 text-base sm:text-lg text-zinc-300 max-w-2xl mx-auto leading-relaxed">
              Tu as une communauté sur TikTok, Instagram, YouTube ou X ? Nous rémunérons les créateurs pour faire découvrir l'application Dawger à leur audience.
            </p>

            <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
              {NETWORKS.map((n) => (
                <span key={n.id} className="text-xs font-semibold px-3 py-1.5 rounded-xl bg-white/5 border border-white/10 text-zinc-300">
                  {n.label}
                </span>
              ))}
            </div>
          </div>

          {/* Grille des avantages */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-16">
            <div className="rounded-3xl border border-white/10 bg-white/5 p-6 backdrop-blur-md">
              <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 flex items-center justify-center text-emerald-400 mb-4">
                <DollarSign className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-white mb-2">Paiement garanti</h3>
              <p className="text-xs sm:text-sm text-zinc-400 leading-relaxed">
                Chaque publication validée (vidéo, story, short) est rémunérée selon un tarif fixé ensemble au préalable. Paiement au choix par virement bancaire ou PayPal.
              </p>
            </div>

            <div className="rounded-3xl border border-white/10 bg-white/5 p-6 backdrop-blur-md">
              <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 flex items-center justify-center text-emerald-400 mb-4">
                <Video className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-white mb-2">Carte blanche créative</h3>
              <p className="text-xs sm:text-sm text-zinc-400 leading-relaxed">
                Tu gardes ton identité, ton humour et ton ton habituel. Présente le lecteur, les fonctionnalités ou ton film favori avec ton propre style.
              </p>
            </div>

            <div className="rounded-3xl border border-white/10 bg-white/5 p-6 backdrop-blur-md">
              <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 flex items-center justify-center text-emerald-400 mb-4">
                <TrendingUp className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-white mb-2">Partenariat durable</h3>
              <p className="text-xs sm:text-sm text-zinc-400 leading-relaxed">
                Si la première collaboration fonctionne bien, nous mettons en place des contrats réguliers sur plusieurs semaines ou mois.
              </p>
            </div>
          </div>

          {/* Formulaire de candidature */}
          <div className="rounded-3xl border border-emerald-500/30 bg-gradient-to-b from-[#0e2119] to-[#07120e] p-6 sm:p-10 shadow-2xl mb-16">
            <div className="max-w-xl mx-auto">
              <div className="text-center mb-8">
                <h2 className="text-2xl sm:text-3xl font-black text-white">
                  Propose ta collaboration
                </h2>
                <p className="mt-2 text-xs sm:text-sm text-zinc-300">
                  Remplis ce court formulaire : notre équipe te répondra par e-mail ou Telegram sous 24 à 48 heures.
                </p>
              </div>

              {status === 'success' ? (
                <div className="text-center py-8">
                  <div className="w-16 h-16 rounded-full bg-emerald-400/20 text-emerald-400 mx-auto flex items-center justify-center mb-4">
                    <CheckCircle className="w-8 h-8" />
                  </div>
                  <h3 className="text-xl font-bold text-white mb-2">Message bien reçu !</h3>
                  <p className="text-sm text-zinc-300 max-w-md mx-auto">
                    Merci pour ton intérêt ! Nous allons examiner tes réseaux et te recontacter très rapidement pour discuter des modalités.
                  </p>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div>
                    <label className="block text-xs font-semibold text-zinc-300 mb-1.5">
                      Ton nom ou pseudo *
                    </label>
                    <input
                      type="text"
                      required
                      value={formData.pseudo}
                      onChange={(e) => setFormData({ ...formData, pseudo: e.target.value })}
                      placeholder="Ex: Lucas_Cine"
                      className="w-full rounded-xl bg-black/60 border border-white/10 px-4 py-3 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-emerald-400 transition-colors"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-zinc-300 mb-1.5">
                        Adresse e-mail *
                      </label>
                      <input
                        type="email"
                        required
                        value={formData.email}
                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                        placeholder="ton@email.com"
                        className="w-full rounded-xl bg-black/60 border border-white/10 px-4 py-3 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-emerald-400 transition-colors"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-zinc-300 mb-1.5">
                        Réseau principal *
                      </label>
                      <select
                        value={formData.network}
                        onChange={(e) => setFormData({ ...formData, network: e.target.value })}
                        className="w-full rounded-xl bg-black/60 border border-white/10 px-4 py-3 text-sm text-white focus:outline-none focus:border-emerald-400 transition-colors"
                      >
                        <option value="tiktok">TikTok</option>
                        <option value="instagram">Instagram</option>
                        <option value="youtube">YouTube</option>
                        <option value="x">X (Twitter)</option>
                        <option value="twitch">Twitch</option>
                        <option value="snapchat">Snapchat</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-zinc-300 mb-1.5">
                        Lien direct vers ton compte *
                      </label>
                      <input
                        type="url"
                        required
                        value={formData.accountUrl}
                        onChange={(e) => setFormData({ ...formData, accountUrl: e.target.value })}
                        placeholder="https://tiktok.com/@toncompte"
                        className="w-full rounded-xl bg-black/60 border border-white/10 px-4 py-3 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-emerald-400 transition-colors"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-zinc-300 mb-1.5">
                        Abonnés / Audience approximative
                      </label>
                      <input
                        type="text"
                        value={formData.subscribers}
                        onChange={(e) => setFormData({ ...formData, subscribers: e.target.value })}
                        placeholder="Ex: 25k abonnés, 80k vues/vidéo"
                        className="w-full rounded-xl bg-black/60 border border-white/10 px-4 py-3 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-emerald-400 transition-colors"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-zinc-300 mb-1.5">
                      Un mot sur tes idées ou formats envisagés
                    </label>
                    <textarea
                      rows={3}
                      value={formData.message}
                      onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                      placeholder="Dis-nous ce que tu aimes faire (review de film, tuto appli, story coup de cœur...)"
                      className="w-full rounded-xl bg-black/60 border border-white/10 px-4 py-3 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-emerald-400 transition-colors resize-none"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={status === 'loading'}
                    className="w-full py-3.5 rounded-xl font-bold text-sm bg-gradient-to-r from-emerald-400 to-teal-400 text-black hover:from-emerald-300 hover:to-teal-300 transition-all duration-200 shadow-lg shadow-emerald-500/25 active:scale-95 flex items-center justify-center gap-2"
                  >
                    {status === 'loading' ? (
                      <span className="w-5 h-5 border-2 border-black/30 border-t-black rounded-full animate-spin" />
                    ) : (
                      <>
                        <Send className="w-4 h-4" />
                        <span>Envoyer ma proposition de partenariat</span>
                      </>
                    )}
                  </button>
                </form>
              )}
            </div>
          </div>

          {/* FAQ Créateurs */}
          <div className="space-y-4">
            <h3 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
              <HelpCircle className="w-5 h-5 text-emerald-400" />
              Questions fréquentes
            </h3>

            <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
              <h4 className="text-sm font-semibold text-white mb-1.5">Combien d’abonnés faut-il pour postuler ?</h4>
              <p className="text-xs sm:text-sm text-zinc-400 leading-relaxed">
                Il n’y a pas de seuil minimal rigide. Nous privilégions l’engagement et l’authenticité plutôt que le simple nombre de followers. Même une communauté de 5 000 passionnés de cinéma très engagés peut être idéale.
              </p>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
              <h4 className="text-sm font-semibold text-white mb-1.5">Comment s'effectue le versement de la rémunération ?</h4>
              <p className="text-xs sm:text-sm text-zinc-400 leading-relaxed">
                Dès que la vidéo ou publication est validée et mise en ligne, le paiement est envoyé selon le moyen de votre choix : virement bancaire SEPA, PayPal ou crypto-monnaie.
              </p>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
              <h4 className="text-sm font-semibold text-white mb-1.5">Dois-je signer un engagement sur la durée ?</h4>
              <p className="text-xs sm:text-sm text-zinc-400 leading-relaxed">
                Non, aucun engagement forcé. Nous pouvons démarrer par un premier test sur une seule vidéo pour voir si les retours vous plaisent, puis décider ensemble de renouveler.
              </p>
            </div>
          </div>

        </div>
      </div>
    </>
  );
};

export default InfluenceursPage;
