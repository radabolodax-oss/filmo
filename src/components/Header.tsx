import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import Snowfall from 'react-snowfall';
import { useLocation, useNavigate } from 'react-router-dom';
import { PrefetchLink as Link } from '@/routing/PrefetchLink';
import { Film, Search, X, Star, Tv2, Users, Clapperboard, Bell, Tv, Lightbulb, Network, List, Radio, Unlock, ExternalLink, LayoutGrid, Settings, Dices, Sparkles, HelpCircle, Github } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import NotificationsPopup from './NotificationsPopup';
import { getUnreadNotificationsCount, getNotificationsDisabled } from '../services/apiNotificationService';
import { encodeId } from '../utils/idEncoder';

import { useSearch } from '../context/SearchContext';
import { isUserVip } from '../utils/authUtils';
import { useTranslation } from 'react-i18next';
import { APRIL_FOOLS_ADMIN_PATH, isAprilFoolsAdminEnabled } from '../utils/aprilFools';

// Couleurs pour les cards du mega menu
const cardColors: Record<string, { bg: string; text: string }> = {
  purple: { bg: 'bg-white/10', text: 'text-white' },
  green: { bg: 'bg-green-500/10', text: 'text-green-400' },
  blue: { bg: 'bg-blue-500/10', text: 'text-blue-400' },
  orange: { bg: 'bg-orange-500/10', text: 'text-orange-400' },
  indigo: { bg: 'bg-indigo-500/10', text: 'text-indigo-400' },
  pink: { bg: 'bg-pink-500/10', text: 'text-pink-400' },
  red: { bg: 'bg-red-500/10', text: 'text-green-400' },
  sky: { bg: 'bg-sky-500/10', text: 'text-sky-400' },
  yellow: { bg: 'bg-yellow-500/10', text: 'text-yellow-400' },
  gray: { bg: 'bg-white/5', text: 'text-gray-400' },
};

interface ExploreItem {
  name: string;
  path: string;
  icon: React.ReactNode;
  color: string;
  desc: string;
  external?: boolean;
}

interface ExploreGroup {
  title: string;
  items: ExploreItem[];
}

const Header: React.FC = () => {
  const { t } = useTranslation();
  const [isExploreOpen, setIsExploreOpen] = useState(false);
  const [isMobileSearchOpen, setIsMobileSearchOpen] = useState(false);
  const [isSnowfallActive, setIsSnowfallActive] = useState(() => {
    return sessionStorage.getItem('snowfall_active') === 'true';
  });
  const [showAutocomplete, setShowAutocomplete] = useState(false);

  useEffect(() => {
    sessionStorage.setItem('snowfall_active', String(isSnowfallActive));
  }, [isSnowfallActive]);

  useEffect(() => {
    const handleSnowfallToggle = () => {
      setIsSnowfallActive(sessionStorage.getItem('snowfall_active') === 'true');
    };
    window.addEventListener('snowfall_toggled', handleSnowfallToggle);
    return () => window.removeEventListener('snowfall_toggled', handleSnowfallToggle);
  }, []);

  const [showNotifications, setShowNotifications] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [notificationsDisabled, setNotificationsDisabled] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isVip, setIsVip] = useState(false);

  const [headerQuery, setHeaderQuery] = useState('');
  const [searchFocused, setSearchFocused] = useState(false);
  const [hoveredNav, setHoveredNav] = useState<string | null>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const mobileSearchInputRef = useRef<HTMLInputElement>(null);
  const autocompleteRef = useRef<HTMLDivElement>(null);
  const notificationsRef = useRef<HTMLDivElement>(null);
  const exploreRef = useRef<HTMLDivElement>(null);
  const [dropdownStyle, setDropdownStyle] = useState<React.CSSProperties>({});
  const location = useLocation();
  const navigate = useNavigate();
  const isAprilFoolsAdminVisible = isAprilFoolsAdminEnabled(location.search);

  const {
    autocompleteSuggestions,
    loadingAutocomplete,
    fetchAutocompleteSuggestions,
    clearAutocompleteSuggestions
  } = useSearch();

  // 4 items principaux visibles dans le header
  const mainNavItems = useMemo(() => [
    { name: t('nav.movies'), path: '/movies', icon: <Clapperboard size={16} />, isActive: location.pathname === '/movies' },
    { name: t('nav.tvShows'), path: '/tv-shows', icon: <Tv2 size={16} />, isActive: location.pathname === '/tv-shows' },
    { name: t('nav.anime'), path: '/anime', icon: <Sparkles size={16} />, isActive: location.pathname === '/anime' },
    { name: 'Sagas', path: '/collections', icon: <LayoutGrid size={16} />, isActive: location.pathname === '/collections' },
  ], [t, location.pathname]);

  // Groupes du mega menu — 4 colonnes équilibrées, tout sur 1 ligne
  const exploreGroups: ExploreGroup[] = useMemo(() => [
    {
      title: t('nav.movies'),
      items: [
        { name: t('nav.collections'), path: '/collections', icon: <Film size={20} />, color: 'purple', desc: t('nav.collectionsDesc') },
        { name: t('nav.top10'), path: '/top10', icon: <Star size={20} />, color: 'yellow', desc: t('nav.top10Desc') },
        { name: t('nav.roulette'), path: '/roulette', icon: <Dices size={20} />, color: 'red', desc: t('roulette.navDesc') },
        { name: t('nav.cinegraph'), path: '/cinegraph', icon: <Network size={20} />, color: 'blue', desc: t('nav.cinegraphDesc') },
      ]
    },
    {
      title: t('nav.social'),
      items: [
        { name: t('nav.sharedLists'), path: '/list-catalog', icon: <List size={20} />, color: 'indigo', desc: t('nav.sharedListsDesc') },
        { name: t('nav.suggestions'), path: '/suggestion', icon: <Star size={20} />, color: 'pink', desc: t('nav.suggestionsDesc') },
        { name: t('nav.greenlight'), path: '/wishboard', icon: <Lightbulb size={20} />, color: 'green', desc: t('nav.greenlightDesc') },
      ]
    },
    {
      title: t('nav.live'),
      items: [
        { name: t('nav.watchParty'), path: '/watchparty/list', icon: <Users size={20} />, color: 'orange', desc: t('nav.watchPartyDesc') },
        { name: t('nav.liveTV'), path: '/live-tv', icon: <Tv size={20} />, color: 'red', desc: t('nav.liveTVDesc') },
        ...(isVip ? [{ name: t('nav.francetv'), path: '/ftv', icon: <Radio size={20} />, color: 'sky' as const, desc: t('nav.francetvDesc') }] : []),
      ]
    },
    {
      title: t('nav.more'),
      items: [
        ...(isVip ? [{ name: t('nav.debrid'), path: '/debrid', icon: <Unlock size={20} />, color: 'yellow' as const, desc: t('nav.debridDesc') }] : []),
        { name: t('nav.settings'), path: '/settings', icon: <Settings size={20} />, color: 'gray', desc: t('nav.settingsDesc') },
        { name: t('nav.helpHub'), path: '/help', icon: <HelpCircle size={20} />, color: 'indigo', desc: t('nav.helpHubDesc') },
        { name: t('nav.github'), path: 'https://github.com/movixcorp/MovixOpenSource', icon: <Github size={20} />, color: 'gray', desc: t('nav.githubDesc'), external: true },
        { name: t('footer.ourUrls'), path: 'https://movix.health', icon: <ExternalLink size={20} />, color: 'gray', desc: t('nav.officialLinksDesc'), external: true },
      ]
    },
  ].filter(g => g.items.length > 0), [t, isVip]);

  // Auth
  useEffect(() => {
    const checkAuth = () => {
      const auth = localStorage.getItem('auth');
      const discordAuth = localStorage.getItem('discord_auth');
      const googleAuth = localStorage.getItem('google_auth');
      const bip39Auth = localStorage.getItem('bip39_auth');
      const isVipUser = isUserVip();
      const isAuth = discordAuth === 'true' || googleAuth === 'true' || bip39Auth === 'true' || !!auth;
      setIsAuthenticated(isAuth);
      setIsVip(isVipUser);
    };
    checkAuth();
    window.addEventListener('storage', checkAuth);
    return () => window.removeEventListener('storage', checkAuth);
  }, []);

  // Notifications
  const refreshUnreadCount = useCallback(async () => {
    if (!isAuthenticated) { setUnreadCount(0); return; }
    try {
      const count = await getUnreadNotificationsCount();
      setUnreadCount(count);
    } catch {
      setUnreadCount(0);
    }
  }, [isAuthenticated]);

  useEffect(() => {
    if (isAuthenticated) {
      refreshUnreadCount();
      getNotificationsDisabled().then(setNotificationsDisabled);
      const interval = setInterval(refreshUnreadCount, 30000);
      return () => clearInterval(interval);
    } else {
      setUnreadCount(0);
      setNotificationsDisabled(false);
    }
  }, [refreshUnreadCount, isAuthenticated]);

  useEffect(() => {
    const handler = (e: Event) => {
      setNotificationsDisabled((e as CustomEvent).detail);
    };
    window.addEventListener('notifications_disabled_changed', handler);
    return () => window.removeEventListener('notifications_disabled_changed', handler);
  }, []);

  // Click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (autocompleteRef.current && !autocompleteRef.current.contains(event.target as Node) && searchInputRef.current && !searchInputRef.current.contains(event.target as Node)) {
        setShowAutocomplete(false);
      }
      if (showNotifications && notificationsRef.current) {
        const target = event.target as HTMLElement;
        if (target.closest('[data-notification-button]') || target.closest('[data-notifications-popup]')) return;
        if (!notificationsRef.current.contains(target)) setShowNotifications(false);
      }
      // Fermer mega menu desktop au clic extérieur
      if (isExploreOpen && exploreRef.current) {
        const target = event.target as HTMLElement;
        if (!exploreRef.current.contains(target) && !target.closest('[data-explore-trigger]')) {
          setIsExploreOpen(false);
        }
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showNotifications, isExploreOpen]);

  // Bloquer le scroll (html + body + Lenis) quand le menu fullscreen est ouvert
  useEffect(() => {
    const lenis = (window as any).lenis;
    const isMobile = window.innerWidth < 1024;
    if (isExploreOpen && isMobile) {
      document.documentElement.style.overflow = 'hidden';
      document.body.style.overflow = 'hidden';
      document.body.style.position = 'fixed';
      document.body.style.inset = '0';
      document.body.style.width = '100%';
      if (lenis) lenis.destroy();
    } else {
      document.documentElement.style.overflow = '';
      document.body.style.overflow = '';
      document.body.style.position = '';
      document.body.style.inset = '';
      document.body.style.width = '';
      // Réinitialiser Lenis si nécessaire
      if (!lenis && isMobile) {
        window.dispatchEvent(new CustomEvent('settings_smooth_scroll_changed'));
      }
    }
    return () => {
      document.documentElement.style.overflow = '';
      document.body.style.overflow = '';
      document.body.style.position = '';
      document.body.style.inset = '';
      document.body.style.width = '';
      if (!(window as any).lenis) {
        window.dispatchEvent(new CustomEvent('settings_smooth_scroll_changed'));
      }
    };
  }, [isExploreOpen]);

  // Reset on navigation
  useEffect(() => {
    clearAutocompleteSuggestions();
    setShowAutocomplete(false);
    setIsExploreOpen(false);
    setIsMobileSearchOpen(false);
    setShowNotifications(false);
    if (location.pathname !== '/search') setHeaderQuery('');
  }, [location.pathname]);

  // Autocomplete dropdown position
  const prevDropdownPosRef = useRef<{ top: number; left: number } | null>(null);
  const dropdownRafIdRef = useRef<number | null>(null);
  useEffect(() => {
    if (!showAutocomplete) return;
    const activeInput = isMobileSearchOpen ? mobileSearchInputRef.current : searchInputRef.current;
    if (!activeInput) return;
    const calcPos = () => {
      const inputRect = activeInput.getBoundingClientRect();
      const dropdownWidth = Math.min(400, window.innerWidth * 0.92);
      let left = inputRect.left + inputRect.width / 2 - dropdownWidth / 2;
      const margin = 8;
      if (left + dropdownWidth > window.innerWidth - margin) left = window.innerWidth - margin - dropdownWidth;
      if (left < margin) left = margin;
      const top = inputRect.bottom + 8;
      if (dropdownRafIdRef.current != null) cancelAnimationFrame(dropdownRafIdRef.current);
      dropdownRafIdRef.current = requestAnimationFrame(() => {
        dropdownRafIdRef.current = null;
        const prev = prevDropdownPosRef.current;
        if (prev && prev.top === top && prev.left === left) return;
        prevDropdownPosRef.current = { top, left };
        setDropdownStyle({ position: 'fixed', top, left, width: dropdownWidth });
      });
    };
    calcPos();
    window.addEventListener('resize', calcPos);
    window.addEventListener('scroll', calcPos, { capture: true, passive: true });
    return () => {
      window.removeEventListener('resize', calcPos);
      window.removeEventListener('scroll', calcPos, { capture: true } as EventListenerOptions);
      if (dropdownRafIdRef.current != null) {
        cancelAnimationFrame(dropdownRafIdRef.current);
        dropdownRafIdRef.current = null;
      }
    };
  // autocompleteSuggestions intentionally excluded — body doesn't reference it;
  // including it churns listener registration on every keystroke
  }, [showAutocomplete, isMobileSearchOpen]);

  // Focus mobile search input when opened
  useEffect(() => {
    if (isMobileSearchOpen && mobileSearchInputRef.current) {
      mobileSearchInputRef.current.focus();
    }
  }, [isMobileSearchOpen]);

  const handleQueryChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setHeaderQuery(value);
    if (value.length >= 2) {
      fetchAutocompleteSuggestions(value);
      setShowAutocomplete(true);
    } else {
      clearAutocompleteSuggestions();
      setShowAutocomplete(false);
    }
  };

  const handleSelectAutocomplete = (item: any) => {
    clearAutocompleteSuggestions();
    setShowAutocomplete(false);
    setHeaderQuery('');
    setIsMobileSearchOpen(false);
    navigate(`/${item.media_type}/${encodeId(item.id)}`);
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (headerQuery.trim()) {
      navigate(`/search?q=${encodeURIComponent(headerQuery)}`);
      setHeaderQuery('');
      setIsMobileSearchOpen(false);
    }
  };

  const renderExploreCard = (item: ExploreItem) => {
    const colors = cardColors[item.color] || cardColors.gray;
    const content = (
      <div className={`flex flex-col items-center text-center p-5 rounded-2xl bg-white/[0.04] active:bg-white/[0.08] transition-all duration-200 cursor-pointer h-full`}>
        <div className={`w-14 h-14 rounded-2xl ${colors.bg} ${colors.text} flex items-center justify-center mb-3`}>
          {item.icon}
        </div>
        <span className="text-white text-sm font-semibold mb-1">{item.name}</span>
        <span className="text-white/50 text-xs leading-tight">{item.desc}</span>
      </div>
    );

    if (item.external) {
      return (
        <a key={item.path} href={item.path} target="_blank" rel="noopener noreferrer" onClick={() => setIsExploreOpen(false)}>
          {content}
        </a>
      );
    }
    return (
      <Link key={item.path} to={item.path} onClick={() => setIsExploreOpen(false)}>
        {content}
      </Link>
    );
  };

  // Toutes les items pour le fullscreen mobile
  const allExploreItems = exploreGroups.flatMap(g => g.items);

  return (
    <>
      <header className="!fixed inset-x-0 top-0 w-full z-[11000] transition-all duration-300">
        <div className="relative z-10">
          <div className="max-w-[1400px] 2xl:max-w-[1600px] mx-auto">
            <div className="relative flex items-center h-16 px-4 md:px-6 lg:px-8 gap-3 md:gap-5">


              {/* Desktop Nav: 3 items principaux + Explorer */}
              <nav className="hidden lg:flex items-center gap-1.5">
                {mainNavItems.map((item) => (
                  <Link
                    key={item.path}
                    to={item.path}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-white bg-white/15 border border-white/20 rounded-xl transition-all"
                    onMouseEnter={() => setHoveredNav(item.path)}
                    onMouseLeave={() => setHoveredNav(null)}
                  >
                    {item.icon}
                    <span
                      className="nav-label"
                      style={(hoveredNav === item.path || item.isActive) ? {
                        display: 'inline-block',
                        backgroundImage: 'linear-gradient(135deg,#00e676,#a855f7)',
                        WebkitBackgroundClip: 'text',
                        backgroundClip: 'text',
                        WebkitTextFillColor: 'transparent',
                        color: 'transparent',
                      } : {
                        display: 'inline-block',
                        color: 'white',
                        WebkitTextFillColor: 'white',
                      }}
                    >{item.name}</span>
                  </Link>
                ))}

                {isAprilFoolsAdminVisible && (
                  <Link
                    to={APRIL_FOOLS_ADMIN_PATH}
                    className={`ml-1 flex items-center gap-2 rounded-xl border px-3 py-1.5 text-sm transition-all duration-200 ${
                      location.pathname === APRIL_FOOLS_ADMIN_PATH
                        ? 'border-amber-300/35 bg-amber-300/15 text-white'
                        : 'border-amber-300/20 bg-amber-300/10 text-amber-100 hover:border-amber-300/35 hover:bg-amber-300/15 hover:text-white'
                    }`}
                  >
                    <span className="relative flex h-2.5 w-2.5">
                      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-300/60" />
                      <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-amber-200" />
                    </span>
                    <Settings size={15} />
                    <span>{t('aprilAdmin.navLabel')}</span>
                  </Link>
                )}

              </nav>

              {/* Spacer */}
              <div className="flex-1" />

              {/* Desktop Search */}
              <div className="hidden md:block relative w-[14rem] lg:w-[15rem] xl:w-[20rem] 2xl:w-[22rem]">
                <form
                  onSubmit={handleSearchSubmit}
                  onFocus={() => setSearchFocused(true)}
                  onBlur={() => setSearchFocused(false)}
                  className="relative flex items-center gap-2 rounded-2xl backdrop-blur-xl px-3 py-2 transition-all duration-200"
                  style={{
                    background: 'linear-gradient(135deg, rgba(0,230,118,0.30) 0%, rgba(168,85,247,0.30) 100%)',
                    border: searchFocused ? '1px solid transparent' : '1px solid rgba(255,255,255,0.22)',
                    boxShadow: searchFocused
                      ? '0 0 0 1.5px #00e676, 0 0 0 3px rgba(168,85,247,0.7), inset 0 1px 0 rgba(255,255,255,0.22), 0 4px 28px rgba(0,0,0,0.32), 0 0 22px rgba(0,230,118,0.16), 0 0 22px rgba(168,85,247,0.16)'
                      : 'inset 0 1px 0 rgba(255,255,255,0.18), 0 4px 24px rgba(0,0,0,0.28), 0 0 16px rgba(0,230,118,0.08), 0 0 16px rgba(168,85,247,0.08)',
                  }}
                >
                  <Search size={15} className="shrink-0 text-gray-400/70" />
                  <input
                    ref={searchInputRef}
                    type="text"
                    value={headerQuery}
                    onChange={handleQueryChange}
                    placeholder={t('header.searchPlaceholder')}
                    className="flex-1 bg-transparent text-white placeholder-gray-400/60 text-sm focus:outline-none"
                  />
                  {headerQuery && (
                    <button
                      type="button"
                      onClick={() => { setHeaderQuery(''); clearAutocompleteSuggestions(); setShowAutocomplete(false); }}
                      className="shrink-0 text-gray-500 hover:text-white transition-colors"
                    >
                      <X size={14} />
                    </button>
                  )}
                </form>
              </div>

              {/* Right section */}
              <div className="flex items-center gap-1 sm:gap-1.5">
                {isAprilFoolsAdminVisible && (
                  <Link
                    to={APRIL_FOOLS_ADMIN_PATH}
                    aria-label={t('aprilAdmin.mobileAriaLabel')}
                    className={`relative flex items-center justify-center rounded-xl border p-2 transition-colors lg:hidden ${
                      location.pathname === APRIL_FOOLS_ADMIN_PATH
                        ? 'border-amber-300/35 bg-amber-300/15 text-white'
                        : 'border-amber-300/20 bg-amber-300/10 text-amber-100 hover:border-amber-300/35 hover:bg-amber-300/15 hover:text-white'
                    }`}
                  >
                    <Settings size={18} />
                    <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-amber-200 shadow-[0_0_10px_rgba(253,230,138,0.85)]" />
                  </Link>
                )}


                {/* Notifications */}
                {isAuthenticated && !notificationsDisabled && (
                  <div className="relative" ref={notificationsRef}>
                    <motion.button
                      data-notification-button
                      className="relative flex items-center justify-center p-2 text-gray-400 hover:text-white transition-colors"
                      whileTap={{ scale: 0.9 }}
                      onClick={() => setShowNotifications(!showNotifications)}
                    >
                      <Bell size={20} />
                      {unreadCount > 0 && (
                        <span className="absolute -top-0.5 -right-0.5 bg-gradient-to-r from-green-400 to-purple-500 text-white text-[10px] rounded-full h-4 min-w-4 flex items-center justify-center px-1 font-bold">
                          {unreadCount > 9 ? '9+' : unreadCount}
                        </span>
                      )}
                    </motion.button>
                    <AnimatePresence>
                      {showNotifications && (
                        <div className="fixed right-4 sm:right-6 top-16 z-50">
                          <NotificationsPopup
                            onClose={() => setShowNotifications(false)}
                            onNotificationUpdate={refreshUnreadCount}
                          />
                        </div>
                      )}
                    </AnimatePresence>
                  </div>
                )}

              </div>
            </div>
          </div>
        </div>

        {/* Desktop Mega Menu Dropdown */}
        <AnimatePresence>
          {isExploreOpen && (
            <motion.div
              ref={exploreRef}
              className="hidden lg:block absolute top-full left-0 right-0 z-[11001]"
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2 }}
            >
              <div className="max-w-[1400px] 2xl:max-w-[1600px] mx-auto px-8 pt-3 pb-2">
                <div className="rounded-2xl shadow-2xl shadow-black/50 bg-black">
                  <div className="p-8">
                    <div className="grid grid-cols-4 gap-10">
                      {exploreGroups.map((group) => (
                        <div key={group.title}>
                          <h4 className="text-xs font-semibold text-white/30 uppercase tracking-wider mb-4 px-1">{group.title}</h4>
                          <div className="flex flex-col gap-3">
                            {group.items.map((item) => {
                              const colors = cardColors[item.color] || cardColors.gray;
                              const inner = (
                                <div className="flex items-center gap-4 px-5 py-5 rounded-xl bg-white/[0.03] hover:scale-[1.02] transition-all duration-200 cursor-pointer">
                                  <div className={`w-12 h-12 rounded-xl ${colors.bg} ${colors.text} flex items-center justify-center flex-shrink-0`}>
                                    {item.icon}
                                  </div>
                                  <div className="min-w-0">
                                    <div className="text-white text-sm font-medium">{item.name}</div>
                                    <div className="text-white/40 text-xs truncate">{item.desc}</div>
                                  </div>
                                </div>
                              );
                              if (item.external) {
                                return <a key={item.path} href={item.path} target="_blank" rel="noopener noreferrer" onClick={() => setIsExploreOpen(false)}>{inner}</a>;
                              }
                              return <Link key={item.path} to={item.path} onClick={() => setIsExploreOpen(false)}>{inner}</Link>;
                            })}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </header>

      {/* Logo — hors du contexte d'empilement du header pour que mix-blend-mode:screen efface le fond noir JPEG */}
      <div className="top-[2cm] lg:top-0" style={{position:'fixed',left:'50%',transform:'translateX(-50%)',height:'64px',display:'flex',alignItems:'center',zIndex:11001,mixBlendMode:'screen',pointerEvents:'none',justifyContent:'center'}}>
        <Link
          to="/"
          className="flex items-center transition-all duration-200 hover:scale-105"
          style={{pointerEvents:'auto'}}
          onClick={(e) => {
            if (location.pathname === '/') {
              e.preventDefault();
              const lenis = (window as any).lenis;
              if (lenis) {
                lenis.scrollTo(0, { duration: 1.2 });
              } else {
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }
            }
          }}
          onMouseEnter={e => {
            const glow = e.currentTarget.querySelector('.logo-glow') as HTMLElement | null;
            if (glow) glow.style.opacity = '1';
          }}
          onMouseLeave={e => {
            const glow = e.currentTarget.querySelector('.logo-glow') as HTMLElement | null;
            if (glow) glow.style.opacity = '0';
          }}
        >
          <div style={{position:'relative',display:'inline-flex',alignItems:'center'}}>
            <img
              className="logo-glow"
              src="/prowler-logo.png"
              aria-hidden="true"
              className="h-10 lg:h-24"
              style={{position:'absolute',top:'50%',left:'50%',transform:'translate(-50%,-50%)',objectFit:'contain',filter:'blur(20px) contrast(6) brightness(5) saturate(2)',opacity:0,transition:'opacity 0.35s ease',pointerEvents:'none'}}
            />
            <img src="/prowler-logo.png" alt="Prowler" className="h-10 lg:h-24" style={{objectFit:'contain',position:'relative'}} />
          </div>
        </Link>
      </div>


      {/* Mobile Search Overlay */}
      <AnimatePresence>
        {isMobileSearchOpen && (
          <motion.div
            className="md:hidden fixed inset-x-0 top-0 z-[11002] bg-black/95 p-4"
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.2 }}
          >
            <form onSubmit={handleSearchSubmit} className="flex items-center gap-3">
              <div className="flex-1 relative">
                <input
                  ref={mobileSearchInputRef}
                  type="text"
                  value={headerQuery}
                  onChange={handleQueryChange}
                  placeholder={t('header.searchPlaceholder')}
                  className="w-full py-3 pl-10 pr-4 bg-white/10 text-white rounded-xl border border-white/15 focus:outline-none focus:border-white/30 placeholder-gray-500 text-sm"
                />
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
              </div>
              <button
                type="button"
                onClick={() => { setIsMobileSearchOpen(false); setHeaderQuery(''); clearAutocompleteSuggestions(); setShowAutocomplete(false); }}
                className="p-2 text-gray-400 hover:text-white"
              >
                <X size={22} />
              </button>
            </form>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Autocomplete dropdown (shared between desktop & mobile search) */}
      <AnimatePresence>
        {showAutocomplete && autocompleteSuggestions.length > 0 && (
          <motion.div
            ref={autocompleteRef}
            className="bg-black/95 border border-white/15 rounded-xl shadow-2xl z-[12000] overflow-hidden"
            style={dropdownStyle}
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
          >
            <div className="py-2">
              {loadingAutocomplete ? (
                <div className="flex justify-center items-center py-4">
                  <div className="w-5 h-5 border-2 border-gray-600 border-t-red-600 rounded-full animate-spin" />
                </div>
              ) : (
                <ul>
                  {autocompleteSuggestions.map((item: any) => (
                    <li key={item.id} className="px-2">
                      <button
                        className="w-full flex items-center py-2 px-3 hover:bg-white/5 rounded-lg transition-colors"
                        onClick={() => handleSelectAutocomplete(item)}
                      >
                        <div className="flex-shrink-0 w-10 h-15 rounded overflow-hidden mr-3">
                          {item.poster_path ? (
                            <img
                              src={`https://image.tmdb.org/t/p/w92${item.poster_path}`}
                              alt={item.title || item.name}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <div className="w-full h-full bg-gray-800 flex items-center justify-center">
                              <Film size={20} className="text-gray-500" />
                            </div>
                          )}
                        </div>
                        <div className="text-left flex-1 min-w-0">
                          <div className="font-medium text-white text-sm line-clamp-1">{item.title || item.name}</div>
                          <div className="text-xs text-gray-400 flex items-center">
                            <span className="capitalize">{item.media_type === 'movie' ? t('nav.movies') : t('nav.tvShows')}</span>
                            {item.vote_average > 0 && (
                              <>
                                <span className="mx-1.5">•</span>
                                <span className="flex items-center">
                                  <Star size={12} className="text-yellow-500 mr-0.5" />
                                  {item.vote_average.toFixed(1)}
                                </span>
                              </>
                            )}
                            {(item.release_date || item.first_air_date) && (
                              <>
                                <span className="mx-1.5">•</span>
                                <span>{new Date(item.release_date || item.first_air_date).getFullYear()}</span>
                              </>
                            )}
                          </div>
                        </div>
                      </button>
                    </li>
                  ))}
                  <li className="mt-1 pt-1 border-t border-white/10">
                    <Link
                      to={`/search?q=${encodeURIComponent(headerQuery)}`}
                      className="block w-full text-center py-2 text-sm text-gray-400 hover:text-white"
                      onClick={() => { setShowAutocomplete(false); setHeaderQuery(''); setIsMobileSearchOpen(false); }}
                    >
                      {t('search.seeAllResults')}
                    </Link>
                  </li>
                </ul>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Spacer */}
      <div className="w-full h-0" aria-hidden="true" />

      {isSnowfallActive && (
        <Snowfall
          style={{
            position: 'fixed',
            width: '100vw',
            height: '100vh',
            zIndex: 2147483647,
            pointerEvents: 'none',
          }}
        />
      )}
    </>
  );
};

export default Header;
