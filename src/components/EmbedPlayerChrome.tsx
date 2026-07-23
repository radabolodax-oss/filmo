import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

interface EmbedPlayerChromeProps {
  onBack: () => void;
  onOpenNewTab: () => void;
  onChangeSource: () => void;
  children: React.ReactNode;
}

/**
 * Wraps a third-party embed <iframe> with our own Back/Sources controls.
 * We don't control the embed's internal UI (it can draw its own header/logo
 * anywhere), so our controls auto-hide after a few seconds instead of
 * staying permanently on top of it, and on mobile the whole thing takes
 * over the viewport (embeds are unusable when squeezed into the inline size).
 */
const EmbedPlayerChrome: React.FC<EmbedPlayerChromeProps> = ({ onBack, onOpenNewTab, onChangeSource, children }) => {
  const { t } = useTranslation();
  const [chromeVisible, setChromeVisible] = useState(true);
  const [isMobile] = useState(() => typeof window !== 'undefined' && window.innerWidth < 768);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const scheduleHide = () => {
    if (hideTimer.current) clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(() => setChromeVisible(false), 3000);
  };

  useEffect(() => {
    scheduleHide();
    return () => {
      if (hideTimer.current) clearTimeout(hideTimer.current);
    };
  }, []);

  const revealChrome = () => {
    setChromeVisible(true);
    scheduleHide();
  };

  return (
    <div className={isMobile ? 'fixed inset-0 z-[11500] bg-black' : 'w-full h-full flex items-center justify-center relative'}>
      <button
        onClick={onBack}
        className={`absolute top-3 left-3 z-[9999] flex items-center gap-2 px-3 py-2 rounded-lg bg-black/70 hover:bg-black/90 text-white shadow-lg transition-opacity duration-300 ${chromeVisible ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
        </svg>
        {t('watch.back')}
      </button>

      <div className={`absolute top-16 right-3 z-[10000] flex items-center gap-2 transition-opacity duration-300 ${chromeVisible ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
        <button
          onClick={onOpenNewTab}
          className="flex items-center gap-2 px-3 py-2 rounded-lg bg-gray-800/90 border border-gray-600 hover:bg-gray-700/90 text-white font-medium text-sm transition-all duration-200"
          title={t('watch.openInNewPage')}
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
          </svg>
        </button>

        <button
          onClick={onChangeSource}
          className="flex items-center gap-2 px-3 py-2 rounded-lg bg-black/90 border border-gray-700 hover:bg-gray-800/80 text-white font-medium text-sm transition-all duration-200"
        >
          <svg className="w-4 h-4 text-red-500" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" /></svg>
          <span className="hidden sm:inline">{t('watch.sources')}</span>
        </button>
      </div>

      {!chromeVisible && (
        <button
          onClick={revealChrome}
          aria-label={t('watch.back')}
          className="absolute bottom-3 left-3 z-[11600] w-11 h-11 flex items-center justify-center rounded-full bg-black/70 text-white active:scale-95 transition-transform"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
        </button>
      )}

      {children}
    </div>
  );
};

export default EmbedPlayerChrome;
