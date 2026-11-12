import React from 'react';
import { motion } from 'framer-motion';
import type { TFunction } from 'i18next';
import {
  DEFAULT_CUSTOM_OLED,
  type CustomOledSettings,
  type OledMode,
} from '../utils/playerVisualPrefs';

interface OledSettingsSectionProps {
  t: TFunction;
  videoOledMode: OledMode;
  customOled: CustomOledSettings;
  onSelectMode: (mode: OledMode) => void;
  onChangeCustom: (key: keyof CustomOledSettings, value: number) => void;
  onResetCustom: () => void;
  activeFilterPreview: string;
}

const PRESET_OPTIONS: Array<{
  mode: OledMode;
  titleKey: string;
  descKey: string;
  activeBorder: string;
  activeText: string;
  activePill: string;
}> = [
  {
    mode: 'off',
    titleKey: 'watch.oledOff',
    descKey: 'watch.oledOffDesc',
    activeBorder: 'border-red-600',
    activeText: 'text-red-500 font-medium',
    activePill: 'bg-red-600',
  },
  {
    mode: 'natural',
    titleKey: 'watch.oledNatural',
    descKey: 'watch.oledNaturalDesc',
    activeBorder: 'border-emerald-600',
    activeText: 'text-emerald-400 font-medium',
    activePill: 'bg-emerald-600',
  },
  {
    mode: 'cinema',
    titleKey: 'watch.oledCinema',
    descKey: 'watch.oledCinemaDesc',
    activeBorder: 'border-amber-600',
    activeText: 'text-amber-400 font-medium',
    activePill: 'bg-amber-600',
  },
  {
    mode: 'vivid',
    titleKey: 'watch.oledVivid',
    descKey: 'watch.oledVividDesc',
    activeBorder: 'border-pink-600',
    activeText: 'text-pink-400 font-medium',
    activePill: 'bg-pink-600',
  },
  {
    mode: 'custom',
    titleKey: 'watch.oledCustom',
    descKey: 'watch.oledCustomDesc',
    activeBorder: 'border-cyan-600',
    activeText: 'text-cyan-400 font-medium',
    activePill: 'bg-cyan-600',
  },
];

export const OledSettingsSection: React.FC<OledSettingsSectionProps> = ({
  t,
  videoOledMode,
  customOled,
  onSelectMode,
  onChangeCustom,
  onResetCustom,
  activeFilterPreview,
}) => {
  const sliders: Array<{
    key: keyof CustomOledSettings;
    label: string;
    min: number;
    max: number;
    leftLabel: string;
    midLabel: string;
    rightLabel: string;
  }> = [
    {
      key: 'contrast',
      label: t('watch.contrastLabel'),
      min: 0.5,
      max: 2,
      leftLabel: '0.50',
      midLabel: '1.00',
      rightLabel: '2.00',
    },
    {
      key: 'saturate',
      label: t('watch.saturationLabel'),
      min: 0,
      max: 3,
      leftLabel: t('watch.bwLabel'),
      midLabel: t('watch.normalLabel'),
      rightLabel: '3.00',
    },
    {
      key: 'brightness',
      label: t('watch.brightnessLabel'),
      min: 0.3,
      max: 1.8,
      leftLabel: t('watch.darkLabel'),
      midLabel: t('watch.normalLabel'),
      rightLabel: t('watch.brightLabel'),
    },
    {
      key: 'sepia',
      label: t('watch.sepiaLabel'),
      min: 0,
      max: 1,
      leftLabel: '0',
      midLabel: '0.50',
      rightLabel: '1.00',
    },
  ];

  return (
    <motion.div
      key="oled"
      initial={{ opacity: 0, x: 50 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -50 }}
      transition={{ duration: 0.25 }}
      className="pr-2 space-y-3"
    >
      <div className="mb-2">
        <h3 className="text-base font-semibold text-white mb-1">{t('watch.oledTitle')}</h3>
        <p className="text-xs text-gray-400 mb-3">{t('watch.oledDesc')}</p>
      </div>

      {PRESET_OPTIONS.map((opt) => {
        const active = videoOledMode === opt.mode;
        return (
          <button
            key={opt.mode}
            type="button"
            onClick={() => onSelectMode(opt.mode)}
            className={`w-full px-4 py-3 text-sm text-left hover:bg-gray-800/80 rounded-lg flex justify-between items-center transition-colors ${
              active ? `bg-gray-800 border-l-4 ${opt.activeBorder} pl-3` : 'bg-gray-900/60 text-white'
            }`}
          >
            <div className="flex flex-col">
              <span className={active ? opt.activeText : 'text-white'}>{t(opt.titleKey)}</span>
              <span className="text-xs text-gray-500">{t(opt.descKey)}</span>
            </div>
            {active && (
              <span className={`text-xs px-2 py-1 ${opt.activePill} text-white rounded-full`}>
                {t('watch.active')}
              </span>
            )}
          </button>
        );
      })}

      {videoOledMode === 'custom' && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          exit={{ opacity: 0, height: 0 }}
          className="mt-3 p-4 bg-gray-900/80 rounded-xl border border-cyan-600/30 space-y-4"
        >
          {sliders.map((s) => {
            const val = customOled[s.key] ?? DEFAULT_CUSTOM_OLED[s.key];
            const pct = ((val - s.min) / (s.max - s.min)) * 100;
            return (
              <div key={s.key}>
                <div className="flex justify-between items-center mb-1">
                  <span className="text-xs text-gray-300">{s.label}</span>
                  <span className="text-xs text-cyan-400 font-mono">{val.toFixed(2)}</span>
                </div>
                <input
                  type="range"
                  min={s.min}
                  max={s.max}
                  step="0.01"
                  value={val}
                  onChange={(e) => onChangeCustom(s.key, parseFloat(e.target.value))}
                  className="w-full h-1.5 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-cyan-500"
                  style={{
                    background: `linear-gradient(to right, #06b6d4 0%, #06b6d4 ${pct}%, #374151 ${pct}%, #374151 100%)`,
                  }}
                />
                <div className="flex justify-between text-[10px] text-gray-500 mt-0.5">
                  <span>{s.leftLabel}</span>
                  <span>{s.midLabel}</span>
                  <span>{s.rightLabel}</span>
                </div>
              </div>
            );
          })}

          <button
            type="button"
            onClick={onResetCustom}
            className="w-full mt-2 px-3 py-2 text-xs text-center rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-300 transition-colors border border-gray-700/50"
          >
            {t('watch.resetValues')}
          </button>
        </motion.div>
      )}

      {videoOledMode !== 'off' && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-4 p-3 bg-gradient-to-r from-gray-800/80 to-gray-900/80 rounded-lg border border-gray-700/50"
        >
          <div className="flex items-center gap-2 mb-2">
            <div
              className={`w-2 h-2 rounded-full animate-pulse ${
                videoOledMode === 'natural'
                  ? 'bg-emerald-500'
                  : videoOledMode === 'cinema'
                  ? 'bg-amber-500'
                  : videoOledMode === 'custom'
                  ? 'bg-cyan-500'
                  : 'bg-pink-500'
              }`}
            />
            <span className="text-xs font-medium text-white">{t('watch.activeFilter')}</span>
          </div>
          <p className="text-xs text-gray-400 font-mono">{activeFilterPreview}</p>
        </motion.div>
      )}

      <div className="mt-3 p-3 bg-gray-800/50 rounded-lg border border-gray-700/50">
        <p className="text-xs text-gray-400">{t('watch.oledInfo')}</p>
      </div>
    </motion.div>
  );
};
