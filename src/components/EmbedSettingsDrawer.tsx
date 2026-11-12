import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { OledSettingsSection } from './OledSettingsSection';
import {
  DEFAULT_CUSTOM_OLED,
  getOledFilterString,
  saveCustomOled,
  saveEmbedZoom,
  saveOledMode,
  savePlayerPrefFlag,
  type CustomOledSettings,
  type OledMode,
} from '../utils/playerVisualPrefs';

type EmbedTab = 'sources' | 'format' | 'progression' | 'oled';

export interface EmbedSettingsDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  sourcesContent: React.ReactNode;
  videoOledMode: OledMode;
  customOled: CustomOledSettings;
  onOledChange: (mode: OledMode, custom: CustomOledSettings) => void;
  embedZoom: number;
  onEmbedZoomChange: (zoom: number) => void;
  autoNext: boolean;
  autoFallback: boolean;
  sessionEndEnabled: boolean;
  onToggleAutoNext: (next: boolean) => void;
  onToggleAutoFallback: (next: boolean) => void;
  onToggleSessionEnd: (next: boolean) => void;
}

const ZOOM_PRESETS: Array<{ scale: number; label: string; desc: string }> = [
  { scale: 1, label: 'Normal (100%)', desc: 'Affichage d’origine sans recadrage' },
  { scale: 1.1, label: 'Zoom léger (110%)', desc: 'Réduit légèrement les bordures' },
  { scale: 1.25, label: 'Cinéma 21:9 (125%)', desc: 'Coupe les bandes noires haut et bas' },
  { scale: 1.35, label: 'Remplir l’écran (135%)', desc: 'Plein format agressif' },
];

export const EmbedSettingsDrawer: React.FC<EmbedSettingsDrawerProps> = ({
  isOpen,
  onClose,
  sourcesContent,
  videoOledMode,
  customOled,
  onOledChange,
  embedZoom,
  onEmbedZoomChange,
  autoNext,
  autoFallback,
  sessionEndEnabled,
  onToggleAutoNext,
  onToggleAutoFallback,
  onToggleSessionEnd,
}) => {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<EmbedTab>('sources');

  // Always start on Sources tab whenever the unified gear drawer is opened
  useEffect(() => {
    if (isOpen) {
      setActiveTab('sources');
    }
  }, [isOpen]);

  const handleSelectOled = (mode: OledMode) => {
    saveOledMode(mode);
    onOledChange(mode, customOled);
  };

  const handleCustomOled = (key: keyof CustomOledSettings, value: number) => {
    const updated = { ...customOled, [key]: value };
    saveCustomOled(updated);
    onOledChange(videoOledMode, updated);
  };

  const handleResetCustomOled = () => {
    const defaults = { ...DEFAULT_CUSTOM_OLED };
    saveCustomOled(defaults);
    onOledChange(videoOledMode, defaults);
  };

  const renderToggleRow = (
    title: string,
    description: string,
    enabled: boolean,
    onToggle: () => void,
  ) => (
    <div className="pt-3 first:pt-0 border-t first:border-t-0 border-gray-700/60">
      <h4 className="text-sm font-semibold text-white mb-2">{title}</h4>
      <button
        type="button"
        onClick={onToggle}
        className={`w-full px-4 py-3 text-sm text-left rounded-lg flex justify-between items-center transition-colors ${
          enabled
            ? 'bg-green-600/30 hover:bg-green-600/40 text-green-300'
            : 'bg-red-600/30 hover:bg-red-600/40 text-red-300'
        }`}
      >
        <span>{enabled ? t('watch.enabled') : t('watch.disabled')}</span>
        <div
          className={`w-10 h-5 flex items-center rounded-full p-1 transition-colors ${
            enabled ? 'bg-green-500' : 'bg-gray-600'
          }`}
        >
          <motion.div
            className="w-3.5 h-3.5 bg-white rounded-full shadow-md"
            layout
            transition={{ type: 'spring', stiffness: 700, damping: 30 }}
            style={{ marginLeft: enabled ? 'auto' : '0px' }}
          />
        </div>
      </button>
      <p className="text-xs text-gray-400 mt-1.5 px-1">{description}</p>
    </div>
  );

  const tabs: Array<{ id: EmbedTab; label: string }> = [
    { id: 'sources', label: t('watch.sources') },
    { id: 'format', label: t('watch.formatTab') },
    { id: 'progression', label: t('watch.progressionTab') },
    { id: 'oled', label: t('watch.oledTab') },
  ];

  return (
    <AnimatePresence>
      {isOpen && (
        <div
          onClick={onClose}
          className="absolute inset-0 z-[20005] bg-black/60 flex justify-start pointer-events-auto"
        >
          <motion.div
            key="embed-unified-settings"
            initial={{ opacity: 0, x: -300 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -300 }}
            transition={{ duration: 0.25, ease: [0.25, 1, 0.5, 1] }}
            onClick={(e) => e.stopPropagation()}
            className="bg-black/95 border-r border-gray-800 shadow-2xl w-[90%] max-w-md h-full flex flex-col overflow-hidden pointer-events-auto"
            data-lenis-prevent
          >
            {/* Header */}
            <div className="flex flex-col border-b border-gray-800 shrink-0">
              <div className="flex justify-between items-center px-3 py-2 sm:px-4 sm:pt-4 sm:pb-3">
                <h3 className="text-white text-sm sm:text-lg font-semibold truncate">
                  {t('watch.sources')} &amp; {t('watch.settingsTitle')}
                </h3>
                <button
                  type="button"
                  onClick={onClose}
                  className="text-gray-300 hover:text-emerald-400 transition-colors p-1 focus:outline-none"
                  aria-label="Fermer"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M18 6 6 18" />
                    <path d="m6 6 12 12" />
                  </svg>
                </button>
              </div>

              {/* Tabs */}
              <div className="flex items-center px-2 space-x-1 overflow-x-auto scrollbar-hide border-t border-gray-800/70">
                {tabs.map((tab) => {
                  const selected = activeTab === tab.id;
                  return (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => setActiveTab(tab.id)}
                      className={`relative py-1.5 sm:py-2.5 px-2.5 sm:px-3 text-xs sm:text-sm font-medium rounded-t-md transition-colors duration-200 flex-shrink-0 min-w-max ${
                        selected ? 'text-white' : 'text-gray-400 hover:text-gray-200'
                      }`}
                    >
                      {tab.label}
                      {selected && (
                        <motion.div
                          layoutId="embedActiveSettingsTab"
                          className="absolute bottom-0 left-0 right-0 h-0.5 bg-emerald-500"
                        />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Body */}
            <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar p-3 sm:p-4" data-lenis-prevent>
              {activeTab === 'sources' && sourcesContent}

              {activeTab === 'format' && (
                <motion.div
                  key="embed-format"
                  initial={{ opacity: 0, x: 30 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.2 }}
                  className="space-y-3 pr-1"
                >
                  <div>
                    <h4 className="text-base font-semibold text-white mb-1">Zoom &amp; Recadrage</h4>
                    <p className="text-xs text-gray-400 mb-3">
                      Agrandit l’image du lecteur pour supprimer les bandes noires.
                    </p>
                  </div>

                  {ZOOM_PRESETS.map((preset) => {
                    const active = Math.abs(embedZoom - preset.scale) < 0.02;
                    return (
                      <button
                        key={preset.scale}
                        type="button"
                        onClick={() => {
                          const saved = saveEmbedZoom(preset.scale);
                          onEmbedZoomChange(saved);
                        }}
                        className={`w-full px-4 py-3 text-sm text-left hover:bg-gray-800/80 rounded-lg flex justify-between items-center transition-colors ${
                          active
                            ? 'bg-gray-800 border-l-4 border-emerald-500 pl-3 text-emerald-400 font-medium'
                            : 'bg-gray-900/60 text-white'
                        }`}
                      >
                        <div className="flex flex-col">
                          <span>{preset.label}</span>
                          <span className="text-xs text-gray-400">{preset.desc}</span>
                        </div>
                        {active && (
                          <span className="text-xs px-2 py-0.5 bg-emerald-600 text-white rounded-full">
                            {t('watch.active')}
                          </span>
                        )}
                      </button>
                    );
                  })}

                  <div className="mt-4 p-4 bg-gray-900/80 rounded-xl border border-gray-800 space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="text-xs text-gray-300">Zoom personnalisé</span>
                      <span className="text-xs text-emerald-400 font-mono">
                        {Math.round(embedZoom * 100)}%
                      </span>
                    </div>
                    <input
                      type="range"
                      min="1"
                      max="1.5"
                      step="0.01"
                      value={embedZoom}
                      onChange={(e) => {
                        const saved = saveEmbedZoom(parseFloat(e.target.value));
                        onEmbedZoomChange(saved);
                      }}
                      className="w-full h-1.5 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-emerald-500"
                    />
                    <div className="flex justify-between text-[10px] text-gray-500">
                      <span>100%</span>
                      <span>125%</span>
                      <span>150%</span>
                    </div>
                  </div>
                </motion.div>
              )}

              {activeTab === 'progression' && (
                <motion.div
                  key="embed-progression"
                  initial={{ opacity: 0, x: 30 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.2 }}
                  className="space-y-4 pr-1"
                >
                  {renderToggleRow(
                    t('watch.autoNextEpisode'),
                    t('watch.autoNextEpisodeDesc'),
                    autoNext,
                    () => {
                      const next = !autoNext;
                      savePlayerPrefFlag('playerAutoNextEpisodePref', next);
                      onToggleAutoNext(next);
                    },
                  )}

                  {renderToggleRow(
                    'Auto-Fallback & Détection de panne',
                    'Bascule automatiquement sur la source suivante si le lecteur est en panne.',
                    autoFallback,
                    () => {
                      const next = !autoFallback;
                      savePlayerPrefFlag('dawger_auto_fallback', next);
                      onToggleAutoFallback(next);
                    },
                  )}

                  {renderToggleRow(
                    'Fin de séance dynamique',
                    "Affiche l'heure de fin estimée selon la durée restante.",
                    sessionEndEnabled,
                    () => {
                      const next = !sessionEndEnabled;
                      savePlayerPrefFlag('dawger_session_end_time', next);
                      onToggleSessionEnd(next);
                    },
                  )}
                </motion.div>
              )}

              {activeTab === 'oled' && (
                <OledSettingsSection
                  t={t}
                  videoOledMode={videoOledMode}
                  customOled={customOled}
                  onSelectMode={handleSelectOled}
                  onChangeCustom={handleCustomOled}
                  onResetCustom={handleResetCustomOled}
                  activeFilterPreview={getOledFilterString(videoOledMode, customOled)}
                />
              )}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
