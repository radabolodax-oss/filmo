export type OledMode = 'off' | 'natural' | 'cinema' | 'vivid' | 'custom';

export interface CustomOledSettings {
  contrast: number;
  saturate: number;
  brightness: number;
  sepia: number;
}

export const DEFAULT_CUSTOM_OLED: CustomOledSettings = {
  contrast: 1,
  saturate: 1,
  brightness: 1,
  sepia: 0,
};

export const PREFS_CHANGED_EVENT = 'dawger-player-prefs-changed';

export function emitPlayerPrefsChanged(): void {
  try {
    window.dispatchEvent(new CustomEvent(PREFS_CHANGED_EVENT));
  } catch { /* ignore */ }
}

export function readOledPrefs(): { mode: OledMode; custom: CustomOledSettings } {
  let mode: OledMode = 'off';
  let custom: CustomOledSettings = { ...DEFAULT_CUSTOM_OLED };
  try {
    const rawMode = localStorage.getItem('playerVideoOled') as OledMode | null;
    if (rawMode && ['off', 'natural', 'cinema', 'vivid', 'custom'].includes(rawMode)) {
      mode = rawMode;
    }
    const rawCustom = localStorage.getItem('playerCustomOled');
    if (rawCustom) {
      custom = { ...DEFAULT_CUSTOM_OLED, ...JSON.parse(rawCustom) };
    }
  } catch { /* ignore */ }
  return { mode, custom };
}

export function saveOledMode(mode: OledMode): void {
  try {
    localStorage.setItem('playerVideoOled', mode);
    emitPlayerPrefsChanged();
  } catch { /* ignore */ }
}

export function saveCustomOled(custom: CustomOledSettings): void {
  try {
    localStorage.setItem('playerCustomOled', JSON.stringify(custom));
    emitPlayerPrefsChanged();
  } catch { /* ignore */ }
}

export function getOledFilterString(mode: OledMode, custom: CustomOledSettings = DEFAULT_CUSTOM_OLED): string {
  switch (mode) {
    case 'natural':
      return 'contrast(1.08) saturate(1.15) brightness(1.02)';
    case 'cinema':
      return 'contrast(1.15) saturate(1.1) brightness(0.97) sepia(0.08)';
    case 'vivid':
      return 'contrast(1.22) saturate(1.35) brightness(1.03)';
    case 'custom':
      return `contrast(${custom.contrast}) saturate(${custom.saturate}) brightness(${custom.brightness}) sepia(${custom.sepia})`;
    case 'off':
    default:
      return 'none';
  }
}

export function readEmbedZoom(): number {
  try {
    const val = parseFloat(localStorage.getItem('dawger_embed_zoom') || '1');
    if (!Number.isFinite(val)) return 1;
    return Math.min(1.5, Math.max(1, val));
  } catch {
    return 1;
  }
}

export function saveEmbedZoom(scale: number): number {
  const clamped = Math.min(1.5, Math.max(1, Math.round(scale * 100) / 100));
  try {
    localStorage.setItem('dawger_embed_zoom', String(clamped));
    emitPlayerPrefsChanged();
  } catch { /* ignore */ }
  return clamped;
}

export function savePlayerPrefFlag(key: string, enabled: boolean): void {
  try {
    localStorage.setItem(key, enabled ? 'true' : 'false');
    emitPlayerPrefsChanged();
  } catch { /* ignore */ }
}

export function readAmbilightEnabled(): boolean {
  try {
    return localStorage.getItem('playerAmbilightMode') !== 'false';
  } catch {
    return true;
  }
}

export function saveAmbilightEnabled(enabled: boolean): void {
  savePlayerPrefFlag('playerAmbilightMode', enabled);
}
