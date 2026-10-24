import React from 'react';
import { useTranslation } from 'react-i18next';

interface EmbedPlayerChromeProps {
  onBack: () => void;
  onOpenNewTab: () => void;
  onChangeSource: () => void;
  children: React.ReactNode;
}

/**
 * Wraps a third-party embed <iframe> with our own Back/Sources controls.
 * Stays inline (not fullscreen) so the synopsis and "similar movies" below
 * the player stay reachable by scrolling.
 */
const EmbedPlayerChrome: React.FC<EmbedPlayerChromeProps> = ({ onBack, onOpenNewTab, onChangeSource, children }) => {
  const { t } = useTranslation();

  return (
    <div className="w-full h-full flex items-center justify-center relative">
      <button
        onClick={onBack}
        className="absolute top-3 left-3 z-[9999] flex items-center gap-2 px-3 py-2 rounded-lg bg-black/70 hover:bg-black/90 text-white shadow-lg"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
        </svg>
        {t('watch.back')}
      </button>

      <div className="absolute top-16 right-3 z-[10000] flex items-center gap-2">
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

      {children}
    </div>
  );
};

export default EmbedPlayerChrome;
