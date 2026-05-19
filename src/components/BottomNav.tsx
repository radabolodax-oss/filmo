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
      className="md:hidden fixed bottom-0 inset-x-0 z-[11000]"
      aria-label="Navigation principale"
      style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
    >
      <div
        className="mx-3 mb-3 flex items-center rounded-2xl border border-white/20"
        style={{
          background: 'rgba(255,255,255,0.08)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
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
              className={`flex flex-1 items-center justify-center gap-1.5 px-2 py-3 m-1 rounded-xl text-xs font-medium border transition-all ${
                isActive
                  ? 'bg-white/15 border-white/20 text-white'
                  : 'border-transparent text-gray-400'
              }`}
            >
              <Icon size={15} strokeWidth={isActive ? 2.5 : 1.75} />
              <span className="truncate">{label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
};

export default BottomNav;
