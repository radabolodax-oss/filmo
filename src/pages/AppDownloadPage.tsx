import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { PrefetchLink as Link } from '@/routing/PrefetchLink';
import {
  ArrowLeft,
  Smartphone,
  Download,
  Apple,
  ShieldCheck,
  Zap,
  Wifi,
  CheckCircle,
  Puzzle,
  Plus,
  Minus,
  Laptop,
  Sparkles,
  ExternalLink,
  HelpCircle,
} from 'lucide-react';
import BlurText from '../components/ui/blur-text';
import ShinyText from '../components/ui/shiny-text';
import AnimatedBorderCard from '../components/ui/animated-border-card';

// Liens directs vers les builds autonomes hébergés localement sur le site
const APK_URL = '/downloads/Dawger-Autonome-v1.0.0.apk';
const IPA_URL = '/downloads/Dawger-iOS-v1.0.0.ipa';
const EXE_URL = '/downloads/PCDawger-Setup.exe';

const features = [
  {
    icon: <Zap className="w-6 h-6" />,
    title: 'Rapide & fluide',
    desc: 'Une expérience native optimisée pour mobile et tablette, bien plus rapide que dans le navigateur.',
    color: '#f59e0b',
  },
  {
    icon: <Wifi className="w-6 h-6" />,
    title: 'Lecteurs autonomes',
    desc: 'Intègre directement Wavewatch, Miaw, Vidlink et tous les lecteurs sans dépendre d\'un serveur tiers.',
    color: '#3b82f6',
  },
  {
    icon: <ShieldCheck className="w-6 h-6" />,
    title: '100% gratuit',
    desc: 'Pas d\'abonnement, zéro publicité intrusive et pas de compte obligatoire.',
    color: '#22c55e',
  },
  {
    icon: <Smartphone className="w-6 h-6" />,
    title: 'Optimisé tactile & plein écran',
    desc: 'Interface gestuelle pensée pour le tactile, reprise de lecture automatique et rotation plein écran.',
    color: '#ffffff',
  },
];

const androidSteps = [
  {
    step: 1,
    title: 'Téléchargez le fichier APK',
    desc: 'Cliquez sur le bouton de téléchargement pour récupérer Dawger-Autonome-v1.0.0.apk (~30 Mo).',
  },
  {
    step: 2,
    title: 'Autorisez l\'installation',
    desc: 'Si votre smartphone vous le demande, autorisez l\'installation depuis des sources inconnues pour votre navigateur dans les paramètres Android.',
  },
  {
    step: 3,
    title: 'Lancez l\'installation',
    desc: 'Depuis la barre de notifications ou votre dossier Téléchargements, appuyez sur l\'APK pour installer l\'application.',
  },
  {
    step: 4,
    title: 'Profitez de Dawger',
    desc: 'L\'icône Dawger apparaît sur votre écran d\'accueil, avec tous les lecteurs prêts à l\'emploi !',
  },
];

const iosSteps = [
  {
    step: 1,
    title: 'Téléchargez l\'IPA et Sideloadly sur votre PC',
    desc: 'Récupérez Dawger-iOS-v1.0.0.ipa (~7.39 Mo) et téléchargez l\'outil gratuit Sideloadly (sideloadly.io) sur votre PC Windows ou Mac.',
  },
  {
    step: 2,
    title: 'Branchez votre iPhone et signez en 1 clic',
    desc: 'Connectez votre iPhone en USB, glissez le fichier IPA dans Sideloadly, entrez votre identifiant Apple ID personnel gratuit et cliquez sur Start.',
  },
  {
    step: 3,
    title: 'Autorisez le certificat et profitez de Dawger',
    desc: 'Sur votre iPhone, allez dans Réglages > Général > VPN et gestion des appareils, validez votre compte Apple et profitez de Dawger en natif !',
  },
];

const AppDownloadPage: React.FC = () => {
  const [activeGuide, setActiveGuide] = useState<'android' | 'ios'>('android');
  const [showIosQuickGuide, setShowIosQuickGuide] = useState(false);

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: { opacity: 1, transition: { staggerChildren: 0.1 } },
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0 },
  };

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="container mx-auto px-4 sm:px-6 py-8 sm:py-12 relative z-10 h-full overflow-y-auto">
        <Link
          to="/"
          className="inline-flex items-center text-white opacity-50 hover:opacity-100 transition-opacity mb-8"
        >
          <ArrowLeft className="w-5 h-5 mr-2" />
          Retour à l'accueil
        </Link>

        {/* HERO TITLE */}
        <div className="max-w-4xl mx-auto text-center mb-16">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="mb-6 relative"
          >
            <div className="inline-flex items-center justify-center p-3 bg-red-500/10 rounded-full mb-4 ring-1 ring-red-500/40">
              <Smartphone className="w-8 h-8 text-red-500" />
            </div>
            <h1 className="flex flex-col gap-2 text-4xl md:text-6xl font-black tracking-tight mb-4 pb-4">
              <ShinyText
                text="Dawger dans votre poche"
                speed={3}
                color="#ffffff"
                shineColor="#ef4444"
                className="block py-2 leading-tight"
              />
              <ShinyText
                text="Android & iOS (Bêta)"
                speed={2}
                color="#ef4444"
                shineColor="#ffffff"
                className="block py-2 leading-tight"
              />
            </h1>
            <BlurText
              text="Téléchargez l'application officielle Dawger et profitez de vos films, séries et animés directement sur votre smartphone et tablette avec une fluidité maximale."
              delay={150}
              className="text-lg text-white/60 max-w-2xl mx-auto justify-center"
            />
          </motion.div>
        </div>

        {/* CARTES DE TÉLÉCHARGEMENT PRINCIPALES (ANDROID & IOS) */}
        <motion.div
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: '-50px' }}
          className="max-w-5xl mx-auto mb-20 grid md:grid-cols-2 gap-6"
        >
          {/* CARTE ANDROID */}
          <motion.div variants={itemVariants}>
            <AnimatedBorderCard
              highlightColor="34 197 94"
              backgroundColor="10 10 10"
              className="p-6 sm:p-8 h-full flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between mb-5">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 rounded-xl bg-green-500/10 ring-1 ring-green-500/30">
                      <Smartphone className="w-6 h-6 text-green-400" />
                    </div>
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-green-400">
                        Android
                      </p>
                      <h2 className="text-xl font-bold text-white">Disponible maintenant</h2>
                    </div>
                  </div>
                  <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-1 rounded bg-green-500/20 text-green-300 border border-green-500/30">
                    v1.0.0 Autonome (28.7 Mo)
                  </span>
                </div>

                <p className="text-white/60 text-sm leading-relaxed mb-6">
                  Installez Dawger sur votre appareil Android en téléchargeant directement
                  le fichier APK officiel autonome. Embarque nativement Wavewatch, Miaw, Vidlink, tous les lecteurs et le contournement anti-pub, sans compte obligatoire.
                </p>

                <div className="flex flex-wrap gap-2 mb-8">
                  <span className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1 rounded-full bg-green-500/10 text-green-300 border border-green-500/20">
                    <CheckCircle className="w-3.5 h-3.5" />
                    Wavewatch & Miaw
                  </span>
                  <span className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1 rounded-full bg-indigo-500/10 text-indigo-300 border border-indigo-500/30">
                    <Puzzle className="w-3.5 h-3.5" />
                    Lecteurs Autonomes
                  </span>
                  <span className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1 rounded-full bg-white/5 text-white/70 border border-white/10">
                    Android 7+ (~28.7 Mo)
                  </span>
                </div>
              </div>

              <div>
                <a
                  href={APK_URL}
                  download="Dawger-Autonome-v1.0.0.apk"
                  className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-lg bg-green-600 text-white shadow-lg shadow-green-500/20 hover:bg-green-700 px-6 text-sm sm:text-base font-semibold transition-all duration-200 active:scale-95"
                >
                  <Download className="w-5 h-5 flex-shrink-0" />
                  Télécharger l'APK Android (v1.0.0)
                </a>
                <p className="text-center text-[11px] text-white/40 mt-2">
                  Installation directe sans passer par le Google Play Store
                </p>
              </div>
            </AnimatedBorderCard>
          </motion.div>

          {/* CARTE IOS (BÊTA) */}
          <motion.div variants={itemVariants}>
            <AnimatedBorderCard
              highlightColor="99 102 241"
              backgroundColor="10 10 10"
              className="p-6 sm:p-8 h-full flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between mb-5">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 rounded-xl bg-indigo-500/10 ring-1 ring-indigo-500/30">
                      <Apple className="w-6 h-6 text-indigo-400" />
                    </div>
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-indigo-400">
                        Apple iOS
                      </p>
                      <h2 className="text-xl font-bold text-white">Bêta iOS disponible</h2>
                    </div>
                  </div>
                  <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-1 rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                    v1.0.0 Bêta IPA
                  </span>
                </div>

                <p className="text-white/60 text-sm leading-relaxed mb-6">
                  L'application Dawger pour iPhone et iPad est disponible en version Bêta !
                  Téléchargez le fichier IPA officiel (7.39 Mo) pour l'installer facilement depuis votre PC avec Sideloadly ou AltStore.
                </p>

                <div className="flex flex-wrap gap-2 mb-8">
                  <span className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1 rounded-full bg-indigo-500/10 text-indigo-300 border border-indigo-500/30">
                    <Sparkles className="w-3.5 h-3.5" />
                    Bêta Testeur
                  </span>
                  <span className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1 rounded-full bg-green-500/10 text-green-400 border border-green-500/20">
                    <CheckCircle className="w-3.5 h-3.5" />
                    Sans Jailbreak
                  </span>
                  <span className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1 rounded-full bg-white/5 text-white/70 border border-white/10">
                    iPhone & iPad (~7.39 Mo)
                  </span>
                </div>
              </div>

              <div>
                <a
                  href={IPA_URL}
                  download="Dawger-iOS-v1.0.0.ipa"
                  className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-lg bg-indigo-600 text-white shadow-lg shadow-indigo-500/20 hover:bg-indigo-700 px-6 text-sm sm:text-base font-semibold transition-all duration-200 active:scale-95"
                >
                  <Download className="w-5 h-5 flex-shrink-0" />
                  Télécharger l'IPA iOS (Bêta)
                </a>
                <p className="text-center text-[11px] text-white/40 mt-2">
                  S'installe gratuitement via Sideloadly ou AltStore depuis PC/Mac
                </p>

                {/* ACCORDÉON / GUIDE RAPIDE SOUS LE BOUTON */}
                <button
                  type="button"
                  onClick={() => setShowIosQuickGuide(!showIosQuickGuide)}
                  className="mt-3 w-full flex items-center justify-between px-3.5 py-2.5 rounded-lg bg-indigo-500/10 border border-indigo-500/25 hover:bg-indigo-500/20 text-xs text-indigo-300 transition-colors"
                >
                  <span className="flex items-center gap-2 font-medium">
                    <HelpCircle className="w-4 h-4 text-indigo-400 flex-shrink-0" />
                    Comment installer sur iPhone en 2 min ?
                  </span>
                  {showIosQuickGuide ? (
                    <Minus className="w-3.5 h-3.5 text-indigo-400 flex-shrink-0" />
                  ) : (
                    <Plus className="w-3.5 h-3.5 text-indigo-400 flex-shrink-0" />
                  )}
                </button>

                {showIosQuickGuide && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="mt-2.5 p-3.5 rounded-lg bg-black/70 border border-indigo-500/20 text-xs text-white/80 space-y-2.5"
                  >
                    <div className="flex items-start gap-2.5">
                      <span className="w-4 h-4 rounded-full bg-indigo-500/30 text-indigo-300 font-bold flex items-center justify-center text-[10px] flex-shrink-0 mt-0.5">1</span>
                      <p>Téléchargez <strong className="text-white">Sideloadly</strong> sur votre PC Windows ou Mac (gratuit sur <em>sideloadly.io</em>).</p>
                    </div>
                    <div className="flex items-start gap-2.5">
                      <span className="w-4 h-4 rounded-full bg-indigo-500/30 text-indigo-300 font-bold flex items-center justify-center text-[10px] flex-shrink-0 mt-0.5">2</span>
                      <p>Branchez votre iPhone en USB, glissez <strong className="text-white">Dawger-iOS-v1.0.0.ipa</strong> dans Sideloadly et entrez votre Apple ID gratuit.</p>
                    </div>
                    <div className="flex items-start gap-2.5">
                      <span className="w-4 h-4 rounded-full bg-indigo-500/30 text-indigo-300 font-bold flex items-center justify-center text-[10px] flex-shrink-0 mt-0.5">3</span>
                      <p>Cliquez sur <strong className="text-white">Start</strong>, puis sur l'iPhone validez le profil dans <em>Réglages &gt; Général &gt; VPN et gestion des appareils</em>. Lancez Dawger !</p>
                    </div>
                  </motion.div>
                )}
              </div>
            </AnimatedBorderCard>
          </motion.div>
        </motion.div>

        {/* BANNIÈRE EXTENSION ET LECTEURS INTÉGRÉS */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-50px' }}
          className="max-w-5xl mx-auto mb-20"
        >
          <AnimatedBorderCard
            highlightColor="239 68 68"
            backgroundColor="10 10 10"
            className="p-6 sm:p-8 backdrop-blur-sm"
          >
            <div className="flex flex-col md:flex-row items-center gap-6 md:gap-8">
              <div className="flex-shrink-0">
                <div className="relative">
                  <div className="absolute inset-0 bg-red-500/20 blur-2xl rounded-full" />
                  <div className="relative p-4 rounded-2xl bg-red-500/10 ring-1 ring-red-500/40">
                    <Puzzle className="w-10 h-10 text-red-500" />
                  </div>
                </div>
              </div>
              <div className="flex-1 text-center md:text-left">
                <h3 className="text-xl sm:text-2xl font-bold text-white mb-2">
                  Tous les lecteurs & l'anti-blocage sont déjà intégrés
                </h3>
                <p className="text-white/60 text-sm sm:text-base leading-relaxed">
                  Pas besoin d'installer de script ou d'extension supplémentaire : Wavewatch, Miaw,
                  les flux VOSTFR Vidlink et le déblocage anti-pub sont pré-intégrés nativement
                  dans l'application mobile Dawger.
                </p>
              </div>
              <div className="flex flex-row md:flex-col gap-3 w-full md:w-auto md:min-w-[180px]">
                <div className="flex-1 md:flex-none flex items-center gap-3 p-3 rounded-xl bg-green-500/10 border border-green-500/20">
                  <div className="p-1.5 rounded-lg bg-green-500/20">
                    <Plus className="w-4 h-4 text-green-400" strokeWidth={3} />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-white leading-tight">Sources Multi</p>
                    <p className="text-[11px] text-green-400/80 leading-tight">VF + VOSTFR direct</p>
                  </div>
                </div>
                <div className="flex-1 md:flex-none flex items-center gap-3 p-3 rounded-xl bg-red-500/10 border border-red-500/20">
                  <div className="p-1.5 rounded-lg bg-red-500/20">
                    <Minus className="w-4 h-4 text-red-400" strokeWidth={3} />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-white leading-tight">Zéro publicité</p>
                    <p className="text-[11px] text-red-400/80 leading-tight">Navigation allégée</p>
                  </div>
                </div>
              </div>
            </div>
          </AnimatedBorderCard>
        </motion.div>

        {/* AVANTAGES */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-50px' }}
          className="max-w-5xl mx-auto mb-16"
        >
          <div className="text-center mb-8">
            <h2 className="text-2xl sm:text-3xl font-bold text-white mb-3">
              Pourquoi choisir l'application mobile ?
            </h2>
            <p className="text-white/50 max-w-2xl mx-auto">
              Une expérience fluide, autonome et pensée pour votre smartphone, sans dépendre du navigateur web.
            </p>
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            {features.map((feature) => (
              <div key={feature.title}>
                <AnimatedBorderCard
                  highlightColor={hexToRgb(feature.color)}
                  backgroundColor="12 12 12"
                  className="p-5 h-full"
                >
                  <div className="flex items-start gap-4">
                    <div
                      className="p-2.5 rounded-lg flex-shrink-0"
                      style={{ backgroundColor: `${feature.color}15` }}
                    >
                      <div style={{ color: feature.color }}>{feature.icon}</div>
                    </div>
                    <div>
                      <h3 className="font-semibold text-white mb-1">{feature.title}</h3>
                      <p className="text-sm text-white/50 leading-relaxed">
                        {feature.desc}
                      </p>
                    </div>
                  </div>
                </AnimatedBorderCard>
              </div>
            ))}
          </div>
        </motion.div>

        {/* GUIDES D'INSTALLATION AVEC SÉLECTEUR ANDROID / IOS */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-50px' }}
          className="max-w-3xl mx-auto mb-20"
        >
          <div className="text-center mb-6">
            <h2 className="text-2xl sm:text-3xl font-bold text-white mb-3">
              Comment installer l'application ?
            </h2>
            <p className="text-white/50 max-w-xl mx-auto mb-6">
              Choisissez votre système pour afficher les instructions pas à pas :
            </p>

            <div className="inline-flex p-1 rounded-xl bg-white/5 border border-white/10 gap-1">
              <button
                type="button"
                onClick={() => setActiveGuide('android')}
                className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold transition-all ${
                  activeGuide === 'android'
                    ? 'bg-green-600 text-white shadow-lg shadow-green-500/20'
                    : 'text-white/60 hover:text-white'
                }`}
              >
                <Smartphone className="w-4 h-4" />
                Guide Android (APK)
              </button>
              <button
                type="button"
                onClick={() => setActiveGuide('ios')}
                className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold transition-all ${
                  activeGuide === 'ios'
                    ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/20'
                    : 'text-white/60 hover:text-white'
                }`}
              >
                <Apple className="w-4 h-4" />
                Guide iOS (IPA Bêta)
              </button>
            </div>
          </div>

          <AnimatedBorderCard
            highlightColor={activeGuide === 'android' ? '34 197 94' : '99 102 241'}
            backgroundColor="10 10 10"
            className="p-6 sm:p-8 backdrop-blur-sm"
          >
            <div className="space-y-6">
              {(activeGuide === 'android' ? androidSteps : iosSteps).map((item, index, arr) => (
                <div key={item.step} className="flex gap-4">
                  <div className="flex-shrink-0">
                    <div
                      className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm ${
                        activeGuide === 'android'
                          ? 'bg-green-500/20 border border-green-500/30 text-green-400'
                          : 'bg-indigo-500/20 border border-indigo-500/30 text-indigo-400'
                      }`}
                    >
                      {item.step}
                    </div>
                    {index < arr.length - 1 && (
                      <div
                        className={`w-px h-8 mx-auto mt-2 ${
                          activeGuide === 'android' ? 'bg-green-500/20' : 'bg-indigo-500/20'
                        }`}
                      />
                    )}
                  </div>
                  <div className="pt-1.5">
                    <h4 className="font-semibold text-white mb-1">{item.title}</h4>
                    <p className="text-sm text-white/50 leading-relaxed">{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-8 pt-6 border-t border-white/10">
              {activeGuide === 'android' ? (
                <>
                  <a
                    href={APK_URL}
                    download="Dawger-Autonome-v1.0.0.apk"
                    className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-lg bg-green-600 text-white shadow-lg shadow-green-500/20 hover:bg-green-700 px-6 text-sm sm:text-base font-semibold transition-all duration-200 active:scale-95"
                  >
                    <Download className="w-5 h-5 flex-shrink-0" />
                    Télécharger Dawger-Autonome-v1.0.0.apk
                  </a>
                  <p className="mt-3 text-xs text-white/40 text-center">
                    Si Android affiche un avertissement de sécurité, choisissez « Télécharger quand même » et « Installer ».
                  </p>
                </>
              ) : (
                <>
                  <a
                    href={IPA_URL}
                    download="Dawger-iOS-v1.0.0.ipa"
                    className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-lg bg-indigo-600 text-white shadow-lg shadow-indigo-500/20 hover:bg-indigo-700 px-6 text-sm sm:text-base font-semibold transition-all duration-200 active:scale-95"
                  >
                    <Download className="w-5 h-5 flex-shrink-0" />
                    Télécharger Dawger-iOS-v1.0.0.ipa
                  </a>
                  <div className="mt-3 text-xs text-white/50 text-center flex items-center justify-center gap-2">
                    <HelpCircle className="w-4 h-4 text-indigo-400" />
                    <span>Nécessite Sideloadly (Windows/Mac) et un compte Apple gratuit. Aucun jailbreak requis.</span>
                  </div>
                </>
              )}
            </div>
          </AnimatedBorderCard>
        </motion.div>

        {/* RAPPEL VERSION PC */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="max-w-2xl mx-auto text-center pb-12"
        >
          <AnimatedBorderCard
            highlightColor="239 68 68"
            backgroundColor="10 10 10"
            className="p-8 backdrop-blur-sm"
          >
            <div className="flex items-center justify-center gap-3 mb-4">
              <Smartphone className="w-7 h-7 text-green-400" />
              <Apple className="w-7 h-7 text-indigo-400" />
              <Laptop className="w-7 h-7 text-red-500" />
            </div>
            <h3 className="text-xl font-bold text-white mb-2">Dawger disponible sur tous vos écrans</h3>
            <p className="text-white/50 text-sm mb-6 max-w-md mx-auto">
              Que vous soyez sur smartphone Android, iPhone, iPad ou PC Windows,
              Dawger vous accompagne partout avec la même interface et vos favoris synchronisés.
            </p>
            <div className="flex flex-col sm:flex-row flex-wrap items-center justify-center gap-3">
              <a
                href={EXE_URL}
                download="PCDawger-Setup.exe"
                className="inline-flex h-11 w-full sm:w-auto items-center justify-center gap-2 rounded-lg bg-red-600 text-white hover:bg-red-700 px-5 text-sm font-semibold transition-all duration-200 active:scale-95 shadow-lg shadow-red-500/20"
              >
                <Laptop className="w-4 h-4 flex-shrink-0" />
                PC Windows (.exe)
              </a>
              <a
                href={APK_URL}
                download="Dawger-Autonome-v1.0.0.apk"
                className="inline-flex h-11 w-full sm:w-auto items-center justify-center gap-2 rounded-lg bg-green-600 text-white hover:bg-green-700 px-5 text-sm font-semibold transition-all duration-200 active:scale-95 shadow-lg shadow-green-500/20"
              >
                <Download className="w-4 h-4 flex-shrink-0" />
                APK Android
              </a>
              <a
                href={IPA_URL}
                download="Dawger-iOS-v1.0.0.ipa"
                className="inline-flex h-11 w-full sm:w-auto items-center justify-center gap-2 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 px-5 text-sm font-semibold transition-all duration-200 active:scale-95 shadow-lg shadow-indigo-500/20"
              >
                <Apple className="w-4 h-4 flex-shrink-0" />
                IPA iOS (Bêta)
              </a>
              <Link
                to="/"
                className="inline-flex h-11 w-full sm:w-auto items-center justify-center gap-2 rounded-lg border border-white/20 hover:border-white/40 text-white hover:bg-white/10 px-5 text-sm font-semibold transition-all duration-200 active:scale-95"
              >
                <ArrowLeft className="w-4 h-4 flex-shrink-0" />
                Accueil
              </Link>
            </div>
          </AnimatedBorderCard>
        </motion.div>
      </div>
    </div>
  );
};

function hexToRgb(hex: string): string {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!result) return '239 68 68';
  return `${parseInt(result[1], 16)} ${parseInt(result[2], 16)} ${parseInt(result[3], 16)}`;
}

export default AppDownloadPage;
