import React from 'react';
import { useLocation } from 'react-router-dom';
import { PrefetchLink as Link } from '@/routing/PrefetchLink';
import { Clapperboard, Tv2, Sparkles, LayoutGrid, Search } from 'lucide-react';
import { useTranslation } from 'react-i18next';

const HIDDEN_PREFIXES = [
  '/watch/',
  '/watchparty/room/',
  '/ftv/watch/',
  '/wrapped',
  '/profile-selection',
  '/profile-management',
  '/login-bip39',
  '/create-account',
];

const BottomNav: React.FC = () => {
  const { t } = useTranslation();
  const location = useLocation();
  const isHidden = HIDDEN_PREFIXES.some((p) => location.pathname.startsWith(p));
  if (isHidden) return null;

  const tabs = [
    { label: t('nav.movies'), path: '/movies', Icon: Clapperboard },
    { label: t('nav.tvShows'), path: '/tv-shows', Icon: Tv2 },
    { label: t('nav.anime'), path: '/anime', Icon: Sparkles },
    { label: 'Sagas', path: '/collections', Icon: LayoutGrid },
    { label: 'Chercher', path: '/search', Icon: Search },
  ];

  return (
    <nav
      className="bottom-nav-wrapper landscape:hidden lg:hidden fixed bottom-0 inset-x-0 z-[11000]"
      aria-label="Navigation principale"
      style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
    >
      <div
        className="mx-3 mb-3 flex items-stretch rounded-2xl gap-1 px-1.5 py-1.5"
        style={{
          background: 'linear-gradient(160deg, rgba(255,255,255,0.12) 0%, rgba(255,255,255,0.04) 55%, rgba(0,0,0,0.06) 100%)',
          backdropFilter: 'blur(20px) saturate(180%)',
          WebkitBackdropFilter: 'blur(20px) saturate(180%)',
          borderTop: '1px solid rgba(255,255,255,0.28)',
          borderLeft: '1px solid rgba(255,255,255,0.16)',
          borderRight: '1px solid rgba(255,255,255,0.07)',
          borderBottom: '1px solid rgba(0,0,0,0.22)',
          boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.22), inset 0 -1px 0 rgba(0,0,0,0.10), 0 8px 32px rgba(0,0,0,0.35)',
        }}
      >
        {tabs.map(({ label, path, Icon }) => {
          const isActive =
            location.pathname === path ||
            (path !== '/' && location.pathname.startsWith(path));

          return (
            <Link
              key={path}
              to={path}
              aria-current={isActive ? 'page' : undefined}
              className="flex flex-1 min-w-0 items-center justify-center gap-1 px-1 py-2 text-xs font-medium rounded-xl transition-all duration-200"
              style={{
                background: isActive
                  ? 'linear-gradient(135deg, rgba(0,230,118,0.20) 0%, rgba(168,85,247,0.20) 100%)'
                  : 'transparent',
                boxShadow: isActive
                  ? 'inset 0 1px 0 rgba(255,255,255,0.20), 0 0 0 1px rgba(168,85,247,0.15)'
                  : 'none',
              }}
            >
              <Icon size={15} strokeWidth={isActive ? 2.5 : 1.75} className="shrink-0" />
              <span
                className="truncate"
                style={isActive ? {
                  backgroundImage: 'linear-gradient(135deg,#00e676,#a855f7)',
                  WebkitBackgroundClip: 'text',
                  backgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  color: 'transparent',
                } : {
                  color: 'white',
                  WebkitTextFillColor: 'white',
                }}
              >{label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
};

export default BottomNav;
