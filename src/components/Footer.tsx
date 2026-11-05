import React, { useState } from "react";
import {
  Mail,
  LifeBuoy,
  ArrowUpRight,
  Check,
  Shield,
  Scale,
  Smartphone,
  HelpCircle,
  Github,
  Instagram,
  Globe,
  Film,
  Tv,
  Sparkles,
  Dice5,
  Layers,
  Search,
  PlusCircle,
  Settings,
  Users,
  Compass,
} from "lucide-react";
import { PrefetchLink as Link } from "@/routing/PrefetchLink";
import { useTranslation } from "react-i18next";
import "./Footer.css";

const PEACE_FLAGS = [
  {
    name: "France",
    svg: (
      <svg className="block h-[20px] w-[20px] rounded-full shadow-[0_2px_6px_-2px_rgba(0,0,0,0.7)] ring-1 ring-white/20 transition-transform duration-200 hover:scale-125" viewBox="0 0 30 20" preserveAspectRatio="xMidYMid slice">
        <rect width="10" height="20" fill="#0055A4" />
        <rect x="10" width="10" height="20" fill="#fff" />
        <rect x="20" width="10" height="20" fill="#EF4135" />
      </svg>
    ),
  },
  {
    name: "Palestine",
    svg: (
      <svg className="block h-[20px] w-[20px] rounded-full shadow-[0_2px_6px_-2px_rgba(0,0,0,0.7)] ring-1 ring-white/20 transition-transform duration-200 hover:scale-125" viewBox="0 0 30 20" preserveAspectRatio="xMidYMid slice">
        <rect width="30" height="6.67" fill="#000" />
        <rect y="6.67" width="30" height="6.67" fill="#fff" />
        <rect y="13.33" width="30" height="6.67" fill="#149954" />
        <path d="M0 0 L12 10 L0 20 Z" fill="#E4312B" />
      </svg>
    ),
  },
  {
    name: "Soudan",
    svg: (
      <svg className="block h-[20px] w-[20px] rounded-full shadow-[0_2px_6px_-2px_rgba(0,0,0,0.7)] ring-1 ring-white/20 transition-transform duration-200 hover:scale-125" viewBox="0 0 30 20" preserveAspectRatio="xMidYMid slice">
        <rect width="30" height="6.67" fill="#D21034" />
        <rect y="6.67" width="30" height="6.67" fill="#fff" />
        <rect y="13.33" width="30" height="6.67" fill="#000" />
        <path d="M0 0 L11 10 L0 20 Z" fill="#007229" />
      </svg>
    ),
  },
  {
    name: "RDC",
    svg: (
      <svg className="block h-[20px] w-[20px] rounded-full shadow-[0_2px_6px_-2px_rgba(0,0,0,0.7)] ring-1 ring-white/20 transition-transform duration-200 hover:scale-125" viewBox="0 0 30 20" preserveAspectRatio="xMidYMid slice">
        <rect width="30" height="20" fill="#007FFF" />
        <path d="M0 16 L24 0 H30 V4 L6 20 H0 Z" fill="#F7D618" />
        <path d="M0 17.6 L26.4 0 H30 V2.4 L3.6 20 H0 Z" fill="#CE1021" />
        <path d="M5 1.6 L5.94 4.5 H9 L6.53 6.3 L7.47 9.2 L5 7.4 L2.53 9.2 L3.47 6.3 L1 4.5 H4.06 Z" fill="#F7D618" />
      </svg>
    ),
  },
  {
    name: "Arménie",
    svg: (
      <svg className="block h-[20px] w-[20px] rounded-full shadow-[0_2px_6px_-2px_rgba(0,0,0,0.7)] ring-1 ring-white/20 transition-transform duration-200 hover:scale-125" viewBox="0 0 30 20" preserveAspectRatio="xMidYMid slice">
        <rect width="30" height="6.67" fill="#D90012" />
        <rect y="6.67" width="30" height="6.67" fill="#0033A0" />
        <rect y="13.33" width="30" height="6.67" fill="#F2A800" />
      </svg>
    ),
  },
  {
    name: "Ukraine",
    svg: (
      <svg className="block h-[20px] w-[20px] rounded-full shadow-[0_2px_6px_-2px_rgba(0,0,0,0.7)] ring-1 ring-white/20 transition-transform duration-200 hover:scale-125" viewBox="0 0 30 20" preserveAspectRatio="xMidYMid slice">
        <rect width="30" height="10" fill="#0057B7" />
        <rect y="10" width="30" height="10" fill="#FFD700" />
      </svg>
    ),
  },
  {
    name: "Liban",
    svg: (
      <svg className="block h-[20px] w-[20px] rounded-full shadow-[0_2px_6px_-2px_rgba(0,0,0,0.7)] ring-1 ring-white/20 transition-transform duration-200 hover:scale-125" viewBox="0 0 30 20" preserveAspectRatio="xMidYMid slice">
        <rect width="30" height="20" fill="#ED1C24" />
        <rect y="5" width="30" height="10" fill="#fff" />
        <path d="M15 5.8 L19.5 13 H16 V14.2 H14 V13 H10.5 Z" fill="#00A651" />
      </svg>
    ),
  },
  {
    name: "Yémen",
    svg: (
      <svg className="block h-[20px] w-[20px] rounded-full shadow-[0_2px_6px_-2px_rgba(0,0,0,0.7)] ring-1 ring-white/20 transition-transform duration-200 hover:scale-125" viewBox="0 0 30 20" preserveAspectRatio="xMidYMid slice">
        <rect width="30" height="6.67" fill="#CE1126" />
        <rect y="6.67" width="30" height="6.67" fill="#fff" />
        <rect y="13.33" width="30" height="6.67" fill="#000" />
      </svg>
    ),
  },
  {
    name: "Haïti",
    svg: (
      <svg className="block h-[20px] w-[20px] rounded-full shadow-[0_2px_6px_-2px_rgba(0,0,0,0.7)] ring-1 ring-white/20 transition-transform duration-200 hover:scale-125" viewBox="0 0 30 20" preserveAspectRatio="xMidYMid slice">
        <rect width="30" height="10" fill="#00209F" />
        <rect y="10" width="30" height="10" fill="#D21034" />
        <rect x="11" y="7" width="8" height="6" fill="#fff" />
        <circle cx="15" cy="10" r="1.6" fill="#016A16" />
      </svg>
    ),
  },
  {
    name: "Kurdistan",
    svg: (
      <svg className="block h-[20px] w-[20px] rounded-full shadow-[0_2px_6px_-2px_rgba(0,0,0,0.7)] ring-1 ring-white/20 transition-transform duration-200 hover:scale-125" viewBox="0 0 30 20" preserveAspectRatio="xMidYMid slice">
        <rect width="30" height="6.67" fill="#ED2024" />
        <rect y="6.67" width="30" height="6.67" fill="#fff" />
        <rect y="13.33" width="30" height="6.67" fill="#278E43" />
        <circle cx="15" cy="10" r="2.6" fill="#FEBD11" />
      </svg>
    ),
  },
  {
    name: "Ouïghours",
    svg: (
      <svg className="block h-[20px] w-[20px] rounded-full shadow-[0_2px_6px_-2px_rgba(0,0,0,0.7)] ring-1 ring-white/20 transition-transform duration-200 hover:scale-125" viewBox="0 0 30 20" preserveAspectRatio="xMidYMid slice">
        <rect width="30" height="20" fill="#75AADB" />
        <circle cx="10.5" cy="10" r="5" fill="#fff" />
        <circle cx="12" cy="10" r="4.2" fill="#75AADB" />
        <path d="M17.5 7.6 L18.1 9.4 H20 L18.45 10.5 L19.05 12.3 L17.5 11.2 L15.95 12.3 L16.55 10.5 L15 9.4 H16.9 Z" fill="#fff" />
      </svg>
    ),
  },
];

const Footer: React.FC = () => {
  const { t } = useTranslation();
  const [email, setEmail] = useState("");
  const [newsletterStatus, setNewsletterStatus] = useState<"idle" | "loading" | "success">("idle");

  const handleNewsletterSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !email.includes("@")) return;
    setNewsletterStatus("loading");
    setTimeout(() => {
      try {
        localStorage.setItem("dawger_newsletter_subscribed", email);
      } catch {
        // Ignore localStorage error
      }
      setNewsletterStatus("success");
    }, 600);
  };

  return (
    <>
      {/* Top separator line */}
      <div className="relative z-10 w-full h-px bg-gradient-to-r from-transparent via-emerald-500/40 via-white/10 to-transparent" />

      <footer className="relative z-10 bg-[#08080c] text-zinc-300 pt-16 pb-28 md:pb-14 border-t border-white/[0.04]">
        <div className="container mx-auto px-4 sm:px-6 max-w-6xl">

          {/* ==================== 1. CARTES HAUT DE FOOTER (NEWSLETTER & DISCORD) ==================== */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6 mb-14">

            {/* CARTE NEWSLETTER */}
            <div className="rounded-[24px] border border-white/10 bg-gradient-to-b from-white/[0.04] to-black/40 p-6 sm:p-7 shadow-xl backdrop-blur-md flex flex-col justify-between">
              <div>
                <h3 className="text-lg sm:text-xl font-bold tracking-tight text-white flex items-center gap-2">
                  <Mail className="w-5 h-5 text-emerald-400" />
                  La newsletter DAWGER
                </h3>
                <p className="mt-1.5 text-xs sm:text-sm text-zinc-400 leading-relaxed">
                  Les nouveautés du catalogue, miroirs actifs et mises à jour de Dawger. Garanti zéro spam.
                </p>
              </div>

              <form onSubmit={handleNewsletterSubmit} className="mt-5">
                <div className="flex items-center gap-2 rounded-2xl bg-black/60 border border-white/10 p-1.5 focus-within:border-emerald-500/60 transition-colors shadow-inner">
                  <Mail className="w-4 h-4 ml-3 text-zinc-500 shrink-0" />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="toi@exemple.com"
                    disabled={newsletterStatus === "success"}
                    className="w-full bg-transparent px-2 text-xs sm:text-sm text-white placeholder-zinc-500 focus:outline-none"
                  />
                  <button
                    type="submit"
                    disabled={newsletterStatus !== "idle" && newsletterStatus !== "loading"}
                    className="px-4 py-2 sm:px-5 sm:py-2.5 rounded-xl font-semibold text-xs sm:text-sm bg-gradient-to-r from-emerald-500 to-teal-500 text-black hover:from-emerald-400 hover:to-teal-400 transition-all duration-200 active:scale-95 shrink-0 flex items-center gap-1.5 disabled:opacity-80"
                  >
                    {newsletterStatus === "loading" ? (
                      <span className="w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin" />
                    ) : newsletterStatus === "success" ? (
                      <>
                        <Check className="w-4 h-4" />
                        <span>Inscrit !</span>
                      </>
                    ) : (
                      <span>S'inscrire</span>
                    )}
                  </button>
                </div>
                {newsletterStatus === "success" && (
                  <p className="mt-2 text-xs text-emerald-400 font-medium">
                    Merci ! Ton inscription a bien été enregistrée.
                  </p>
                )}
              </form>
            </div>

            {/* CARTE DISCORD DAWGER */}
            <div className="relative isolate overflow-hidden rounded-[24px] border border-emerald-500/20 bg-gradient-to-br from-[#0c1f1a] via-[#091512] to-[#050b0a] p-6 sm:p-7 shadow-xl flex flex-col justify-between">
              <div
                aria-hidden="true"
                className="absolute inset-0 -z-10 bg-[radial-gradient(75%_95%_at_100%_100%,rgba(16,185,129,0.25),transparent_62%),radial-gradient(90%_110%_at_0%_0%,rgba(52,211,153,0.15),transparent_55%)] pointer-events-none"
              />

              <div>
                <h3 className="text-lg sm:text-xl font-bold tracking-tight text-white flex items-center gap-2">
                  <svg className="w-6 h-6 text-emerald-400" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M20.317 4.3698a19.7913 19.7913 0 00-4.8851-1.5152.0741.0741 0 00-.0785.0371c-.211.3753-.4447.8648-.6083 1.2495-1.8447-.2762-3.68-.2762-5.4868 0-.1636-.3933-.4058-.8742-.6177-1.2495a.077.077 0 00-.0785-.037 19.7363 19.7363 0 00-4.8852 1.515.0699.0699 0 00-.0321.0277C.5334 9.0458-.319 13.5799.0992 18.0578a.0824.0824 0 00.0312.0561c2.0528 1.5076 4.0413 2.4228 5.9929 3.0294a.0777.0777 0 00.0842-.0276c.4616-.6304.8731-1.2952 1.226-1.9942a.076.076 0 00-.0416-.1057c-.6528-.2476-1.2743-.5495-1.8722-.8923a.077.077 0 01-.0076-.1277c.1258-.0943.2517-.1923.3718-.2914a.0743.0743 0 01.0776-.0105c3.9278 1.7933 8.18 1.7933 12.0614 0a.0739.0739 0 01.0785.0095c.1202.099.246.1981.3728.2924a.077.077 0 01-.0066.1276 12.2986 12.2986 0 01-1.873.8914.0766.0766 0 00-.0407.1067c.3604.698.7719 1.3628 1.225 1.9932a.076.076 0 00.0842.0286c1.961-.6067 3.9495-1.5219 6.0023-3.0294a.077.077 0 00.0313-.0552c.5004-5.177-.8382-9.6739-3.5485-13.6604a.061.061 0 00-.0312-.0286zM8.02 15.3312c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9555-2.4189 2.157-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.9555 2.4189-2.1569 2.4189zm7.9748 0c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9554-2.4189 2.1569-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.946 2.4189-2.1568 2.4189Z" />
                  </svg>
                  La communauté DAWGER
                </h3>
                <p className="mt-1.5 text-xs sm:text-sm text-emerald-100/80 leading-relaxed">
                  Rejoins notre serveur pour échanger, demander des films, signaler un problème et discuter avec la communauté.
                </p>
              </div>

              <div className="mt-5 flex flex-wrap items-center gap-3">
                <a
                  href="https://discord.gg/dawger"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex h-10 items-center gap-1.5 rounded-xl px-5 text-xs sm:text-sm font-semibold bg-emerald-400 text-black hover:bg-emerald-300 transition-transform duration-200 hover:-translate-y-0.5 shadow-lg shadow-emerald-500/20 active:scale-95"
                >
                  <span>Rejoindre</span>
                  <ArrowUpRight className="w-4 h-4" />
                </a>
                <span className="flex items-center gap-1.5 text-xs text-emerald-200/70">
                  <LifeBuoy className="w-3.5 h-3.5" />
                  Support en direct disponible sur Discord
                </span>
              </div>
            </div>
          </div>

          {/* ==================== 2. CORPS PRINCIPAL DU FOOTER ==================== */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-12">

            {/* COLONNE GAUCHE (5 cols) : MARQUE + DISCLAIMER + CONTACT DIRECT + PAIX */}
            <div className="lg:col-span-5 flex flex-col gap-6">

              {/* Logo & Identité */}
              <div>
                <div className="flex items-center gap-3">
                  <img
                    src="/dawger-logo.png"
                    alt="Dawger Logo"
                    className="h-8 w-auto object-contain brightness-110"
                    onError={(e) => {
                      (e.target as HTMLElement).style.display = 'none';
                    }}
                  />
                  <div>
                    <h2 className="text-white text-base font-bold tracking-tight">DAWGER MEDIA CENTER</h2>
                    <p className="text-[11px] font-mono text-emerald-400">Lecteur Multimédia Autonome & Local-First</p>
                  </div>
                </div>

                <p className="mt-3 text-xs sm:text-sm text-zinc-400 leading-relaxed">
                  Dawger est un catalogue et lecteur multimédia autonome et libre de films, séries, animation et documentaires.
                </p>

                <p className="mt-2 text-xs text-zinc-500 leading-relaxed">
                  Dawger n’héberge aucune vidéo : il agit en tant qu’agrégateur de flux publics. Pour toute réclamation liée au droit d’auteur, consultez notre{" "}
                  <Link to="/dmca" className="text-zinc-400 underline decoration-zinc-600 hover:text-emerald-400 transition-colors">
                    page DMCA
                  </Link>{" "}
                  ou contactez la plateforme d’hébergement concernée.
                </p>
              </div>

              {/* Contact Direct & Canaux de Support (comme miaw.tv) */}
              <div className="rounded-2xl border border-white/5 bg-white/[0.02] p-4 flex flex-col gap-2.5">
                <p className="text-xs text-zinc-400 leading-relaxed">
                  Besoin d'aide ? Contactez notre support par <span className="text-zinc-200 font-medium">WhatsApp ou SMS</span> du lundi au vendredi de 18 h à 23 h, le week-end de 13 h à minuit. SMS non surtaxés.
                </p>

                {/* WhatsApp & SMS */}
                <a
                  href="https://wa.me/33695606127"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2.5 text-xs text-zinc-300 hover:text-white transition-colors"
                >
                  <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
                    <circle cx="12" cy="12" r="12" fill="#25D366" />
                    <path d="M12 5.2a6.8 6.8 0 0 0-5.86 10.25L5.3 18.7l3.33-.86A6.8 6.8 0 1 0 12 5.2z" fill="none" stroke="#fff" strokeWidth="1.35" />
                    <path d="M6.62 10.79c1.44 2.83 3.76 5.14 6.59 6.59l2.2-2.2c.27-.27.67-.36 1.02-.24 1.12.37 2.33.57 3.57.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1-9.39 0-17-7.61-17-17 0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.25.2 2.45.57 3.57.11.35.03.74-.25 1.02l-2.2 2.2z" fill="#fff" transform="translate(8.35 8.35) scale(0.31)" />
                  </svg>
                  <span className="font-semibold text-white tracking-wide">06 95 60 61 27</span>
                  <span className="text-[11px] text-zinc-500">(WhatsApp / SMS)</span>
                  <ArrowUpRight className="w-3.5 h-3.5 opacity-40 ml-auto" />
                </a>

                {/* Telegram & Instagram */}
                <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-white/5">
                  <a
                    href="https://t.me/movix_site"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-xs font-medium text-sky-400 hover:text-sky-300 transition-colors"
                  >
                    <svg className="w-4 h-4" viewBox="0 0 24 24">
                      <circle cx="12" cy="12" fill="#2AABEE" r="12" />
                      <path d="M5.43 11.87c3.5-1.52 5.83-2.53 7-3.02 3.33-1.39 4.03-1.63 4.48-1.64.1 0 .32.02.46.14.12.1.15.23.17.33.02.09.04.3.02.47-.18 1.9-.96 6.5-1.36 8.63-.17.9-.5 1.2-.82 1.23-.7.06-1.23-.46-1.9-.91-1.06-.69-1.66-1.12-2.69-1.8-1.19-.78-.42-1.21.26-1.92.18-.18 3.25-2.98 3.31-3.23.01-.03.01-.15-.06-.21-.07-.06-.17-.04-.25-.02-.1.02-1.79 1.14-5.06 3.35-.48.33-.91.49-1.3.48-.43-.01-1.25-.24-1.86-.44-.75-.24-1.35-.37-1.3-.79.03-.22.33-.44.9-.67Z" fill="#fff" />
                    </svg>
                    Support Telegram
                    <ArrowUpRight className="w-3 h-3 opacity-60" />
                  </a>

                  <a
                    href="https://www.instagram.com/cineviseur_/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-xs font-medium text-pink-400 hover:text-pink-300 transition-colors"
                  >
                    <Instagram className="w-4 h-4 text-pink-400" />
                    Instagram
                    <ArrowUpRight className="w-3 h-3 opacity-60" />
                  </a>

                  <a
                    href="https://github.com/radabolodax-oss/filmo"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-xs font-medium text-zinc-400 hover:text-white transition-colors ml-auto"
                  >
                    <Github className="w-4 h-4" />
                    GitHub
                    <ArrowUpRight className="w-3 h-3 opacity-60" />
                  </a>
                </div>
              </div>

              {/* Message de paix / Solidarité ("Free World") comme miaw.tv */}
              <div className="flex items-center gap-4 pt-2">
                <div className="relative h-16 w-16 shrink-0 flex items-center justify-center">
                  <Globe className="w-8 h-8 text-emerald-400/80 animate-pulse" />
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <div className="w-14 h-14 rounded-full border border-emerald-500/20" />
                  </div>
                </div>
                <div>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {PEACE_FLAGS.slice(0, 7).map((flag) => (
                      <span key={flag.name} title={flag.name}>
                        {flag.svg}
                      </span>
                    ))}
                  </div>
                  <p className="mt-1.5 text-xs font-semibold text-white">Free World</p>
                  <p className="text-[11px] text-zinc-500 leading-snug">
                    Une pensée aux peuples opprimés et oubliés de leur gouvernement.
                  </p>
                </div>
              </div>
            </div>

            {/* COLONNE DROITE (7 cols) : 3 COLONNES DE NAVIGATION */}
            <div className="lg:col-span-7 grid grid-cols-2 sm:grid-cols-3 gap-8">

                            {/* 1. DÉCOUVRIR */}
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-emerald-400 mb-4 flex items-center gap-1.5">
                  <Compass className="w-3.5 h-3.5" />
                  Découvrir
                </h3>
                <ul className="space-y-2.5 text-xs sm:text-sm">
                  <li>
                    <Link to="/" className="text-zinc-400 hover:text-white transition-colors">
                      Accueil
                    </Link>
                  </li>
                  <li>
                    <Link to="/movies" className="text-zinc-400 hover:text-white transition-colors">
                      Films
                    </Link>
                  </li>
                  <li>
                    <Link to="/series" className="text-zinc-400 hover:text-white transition-colors">
                      Séries
                    </Link>
                  </li>
                  <li>
                    <Link to="/animes" className="text-zinc-400 hover:text-white transition-colors">
                      Animés
                    </Link>
                  </li>
                  <li>
                    <Link to="/sagas" className="text-zinc-400 hover:text-white transition-colors">
                      Sagas
                    </Link>
                  </li>
                  <li>
                    <Link to="/collections" className="text-zinc-400 hover:text-white transition-colors">
                      Collections
                    </Link>
                  </li>
                  <li>
                    <Link to="/acteurs" className="text-zinc-400 hover:text-white transition-colors">
                      Acteurs & Réalisateurs
                    </Link>
                  </li>
                  <li>
                    <Link to="/genres" className="text-zinc-400 hover:text-white transition-colors">
                      Genres
                    </Link>
                  </li>
                  <li>
                    <Link to="/prochainement" className="text-zinc-400 hover:text-white transition-colors flex items-center gap-1.5">
                      <span>Prochainement</span>
                      <Sparkles className="w-3 h-3 text-amber-400" />
                    </Link>
                  </li>
                </ul>
              </div>

{/* 2. MON ESPACE & OUTILS */}
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-emerald-400 mb-4 flex items-center gap-1.5">
                  <Smartphone className="w-3.5 h-3.5" />
                  Espace & Outils
                </h3>
                <ul className="space-y-2.5 text-xs sm:text-sm">
                  <li>
                    <Link to="/app" className="text-zinc-400 hover:text-white transition-colors flex items-center gap-1.5">
                      <span>Applications PC & Android</span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">Nouveau</span>
                    </Link>
                  </li>
                  <li>
                    <Link to="/extension" className="text-zinc-400 hover:text-white transition-colors">
                      Extension anti-blocage
                    </Link>
                  </li>
                  <li>
                    <Link to="/watchparty/list" className="text-zinc-400 hover:text-white transition-colors flex items-center gap-1.5">
                      <span>Watch Party</span>
                      <Users className="w-3 h-3 text-purple-400" />
                    </Link>
                  </li>
                  <li>
                    <Link to="/list-catalog" className="text-zinc-400 hover:text-white transition-colors">
                      Listes partagées
                    </Link>
                  </li>
                  <li>
                    <Link to="/cinegraph" className="text-zinc-400 hover:text-white transition-colors">
                      Graphe Cinéma 3D
                    </Link>
                  </li>
                  <li>
                    <Link to="/settings" className="text-zinc-400 hover:text-white transition-colors flex items-center gap-1.5">
                      <span>Paramètres & Préférences</span>
                      <Settings className="w-3 h-3 text-zinc-500" />
                    </Link>
                  </li>
                  <li>
                    <a
                      href="https://dawgerwebsite.vercel.app"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-zinc-400 hover:text-white transition-colors flex items-center gap-1"
                    >
                      <span>Site Officiel Dawger</span>
                      <ArrowUpRight className="w-3 h-3 opacity-60" />
                    </a>
                  </li>
                </ul>
              </div>

                            {/* 3. LÉGAL & AIDE */}
              <div className="col-span-2 sm:col-span-1">
                <h3 className="text-xs font-bold uppercase tracking-wider text-emerald-400 mb-4 flex items-center gap-1.5">
                  <Shield className="w-3.5 h-3.5" />
                  Légal & aide
                </h3>
                <ul className="space-y-2.5 text-xs sm:text-sm">
                  <li>
                    <Link to="/confidentialite" className="text-zinc-400 hover:text-white transition-colors">
                      Confidentialité
                    </Link>
                  </li>
                  <li>
                    <Link to="/conditions" className="text-zinc-400 hover:text-white transition-colors">
                      Conditions d'utilisation
                    </Link>
                  </li>
                  <li>
                    <Link to="/donnees" className="text-zinc-400 hover:text-white transition-colors">
                      Données & cookies
                    </Link>
                  </li>
                  <li>
                    <Link to="/dmca" className="text-zinc-400 hover:text-white transition-colors">
                      DMCA / Signaler un contenu
                    </Link>
                  </li>
                  <li>
                    <Link to="/valeurs" className="text-zinc-400 hover:text-white transition-colors">
                      Nos valeurs
                    </Link>
                  </li>
                  <li>
                    <Link to="/bloquer-les-pubs" className="text-zinc-400 hover:text-white transition-colors">
                      Bloquer les pubs
                    </Link>
                  </li>
                  <li>
                    <Link to="/support" className="text-zinc-400 hover:text-white transition-colors flex items-center gap-1.5">
                      <span>Aide & tickets</span>
                      <HelpCircle className="w-3.5 h-3.5 text-sky-400" />
                    </Link>
                  </li>
                  <li>
                    <Link to="/contact" className="text-zinc-400 hover:text-white transition-colors">
                      Contact
                    </Link>
                  </li>
                  <li>
                    <Link to="/influenceurs" className="text-zinc-400 hover:text-white transition-colors flex items-center gap-1.5">
                      <span>Influenceurs</span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">Collab</span>
                    </Link>
                  </li>
                </ul>
              </div>
</div>
          </div>

          {/* ==================== 3. BARRE INFÉRIEURE COPYRIGHT ==================== */}
          <div className="mt-14 pt-6 border-t border-white/[0.06] flex flex-col sm:flex-row items-center justify-between gap-4 text-xs font-mono text-zinc-500 text-center sm:text-left">
            <p>
              © {new Date().getFullYear()} DAWGER · Tous droits réservés · Projet Open-Source Local-First
            </p>
            <div className="flex items-center gap-4 text-zinc-400">
              <span className="text-[11px] text-zinc-500">React 18 · TypeScript · Tailwind · Vite</span>
              <span className="shiny-text text-xs">✨ Vibe Coded ✨</span>
            </div>
          </div>

        </div>
      </footer>
    </>
  );
};

export default Footer;
