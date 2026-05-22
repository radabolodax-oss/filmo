import { useEffect, useState } from 'react';
import { PrefetchLink as Link } from '@/routing/PrefetchLink';
import { ArrowLeft, Search, Clapperboard, Drama, RotateCcw, EyeOff, Ticket } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import ShinyText from '../components/ui/shiny-text';
import { Button } from '../components/ui/button';

const VARIANT_ICONS = [Clapperboard, Drama, RotateCcw, EyeOff, Ticket];

const NotFound = () => {
  const { t } = useTranslation();
  const [variant] = useState(() => Math.floor(Math.random() * VARIANT_ICONS.length) + 1);
  const [bgMode] = useState<'combined' | 'static' | 'animated'>(() =>
    (localStorage.getItem('settings_bg_mode') as 'combined' | 'static' | 'animated') || 'combined'
  );
  const Icon = VARIANT_ICONS[variant - 1];

  useEffect(() => {
    document.title = '404 - Prowler';
  }, []);

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="flex flex-col items-center justify-center min-h-screen px-4 pt-24 pb-16 relative z-10">
        <div className="text-center max-w-lg mx-auto">
          {/* 404 */}
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5, ease: [0.4, 0, 0.2, 1] }}
          >
            <h1 className="text-[10rem] sm:text-[12rem] font-black leading-none tracking-tighter bg-gradient-to-b from-red-500 to-red-900/50 bg-clip-text text-transparent select-none">
              404
            </h1>
          </motion.div>

          {/* Titre avec ShinyText */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2, duration: 0.5 }}
            className="mb-3"
          >
            <h2 className="text-2xl sm:text-3xl font-bold">
              <ShinyText text={t(`notFound.v${variant}Title`)} speed={3} color="#ffffff" shineColor="#ef4444" className="inline" />
            </h2>
          </motion.div>

          {/* Description */}
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.35, duration: 0.5 }}
            className="text-white/50 mb-10 text-sm sm:text-base"
          >
            {t(`notFound.v${variant}Desc`)}
          </motion.p>

          {/* Icône */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.45, duration: 0.5 }}
            className="mb-10"
          >
            <div className="w-20 h-20 mx-auto bg-red-500/10 border border-white/20 rounded-2xl flex items-center justify-center">
              <Icon className="w-10 h-10 text-green-400 opacity-60" />
            </div>
          </motion.div>

          {/* Boutons */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.55, duration: 0.5 }}
            className="flex flex-col sm:flex-row justify-center gap-3"
          >
            <Link to="/">
              <Button className="bg-gradient-to-r from-green-400 to-purple-500 hover:bg-gradient-to-r hover:from-green-400 to-purple-500 text-white h-11 px-6 gap-2 w-full sm:w-auto">
                <ArrowLeft className="w-4 h-4" />
                {t('notFound.backHome')}
              </Button>
            </Link>

            <Link to="/search">
              <Button variant="outline" className="border-white/20 hover:border-white/20 hover:bg-red-500/10 text-white h-11 px-6 gap-2 w-full sm:w-auto">
                <Search className="w-4 h-4" />
                {t('notFound.searchMovie')}
              </Button>
            </Link>
          </motion.div>
        </div>
      </div>
    </div>
  );
};

export default NotFound;
