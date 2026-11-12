export type WatchMediaType = 'movie' | 'tv' | 'anime';

export interface EpisodePlaybackProgress {
  season: number;
  episode: number;
  positionSec: number;
  durationSec: number;
  completed: boolean;
  updatedAt: number;
}

export interface WatchStateItem {
  key: string;
  mediaType: WatchMediaType;
  id: string;
  title?: string;
  posterPath?: string | null;
  backdropPath?: string | null;
  currentSeason?: number;
  currentEpisode?: number;
  lastSource?: string;
  lastLang?: string;
  lastPlayerName?: string;
  positionSec?: number;
  durationSec?: number;
  completed?: boolean;
  episodes?: Record<string, EpisodePlaybackProgress>;
  updatedAt: number;
}

export interface WatchStateStore {
  version: 1;
  updatedAt: number;
  items: Record<string, WatchStateItem>;
}

export const WATCH_STATE_STORAGE_KEY = 'dawger_watch_state_v1';
export const WATCH_STATE_HYDRATED_EVENT = 'dawger-watch-state-hydrated';

declare global {
  interface Window {
    GM_getNativeValue?: (key: string, defaultValue?: any) => Promise<any>;
    GM_setNativeValue?: (key: string, value: any) => Promise<boolean>;
    dawgerWatchState?: {
      read: () => Promise<any>;
      write: (data: any) => Promise<boolean>;
    };
  }
}

let memoryStore: WatchStateStore | null = null;
let flushTimer: ReturnType<typeof setTimeout> | null = null;
let hydratePromise: Promise<WatchStateStore> | null = null;
let listenersBound = false;

function normalizeKey(mediaType: WatchMediaType, id: string | number): string {
  const family = mediaType === 'movie' ? 'movie' : 'tv';
  return `${family}:${String(id)}`;
}

function emptyStore(): WatchStateStore {
  return { version: 1, updatedAt: Date.now(), items: {} };
}

function safeReadLocalStore(): WatchStateStore {
  if (memoryStore) return memoryStore;
  if (typeof localStorage === 'undefined') {
    memoryStore = emptyStore();
    return memoryStore;
  }
  try {
    const raw = localStorage.getItem(WATCH_STATE_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object' && parsed.items && typeof parsed.items === 'object') {
        memoryStore = {
          version: 1,
          updatedAt: Number(parsed.updatedAt) || Date.now(),
          items: parsed.items,
        };
        return memoryStore;
      }
    }
  } catch {}
  memoryStore = emptyStore();
  return memoryStore;
}

function persistLocalStore(store: WatchStateStore): void {
  memoryStore = store;
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(WATCH_STATE_STORAGE_KEY, JSON.stringify(store));
  } catch {}
}

function mirrorLegacyProgress(
  mediaType: WatchMediaType,
  id: string,
  season: number | undefined,
  episode: number | undefined,
  positionSec: number,
  durationSec: number
): void {
  if (typeof localStorage === 'undefined') return;
  try {
    const payload = JSON.stringify({
      position: positionSec,
      duration: durationSec,
      timestamp: new Date().toISOString(),
    });
    if (mediaType === 'movie') {
      localStorage.setItem(`progress_${id}`, payload);
    } else if (season != null && episode != null) {
      localStorage.setItem(`progress_tv_${id}_s${season}_e${episode}`, payload);
    }
  } catch {}
}

export async function flushWatchStateToNative(): Promise<void> {
  if (flushTimer) {
    clearTimeout(flushTimer);
    flushTimer = null;
  }
  const store = safeReadLocalStore();
  if (typeof window === 'undefined') return;

  try {
    if (typeof window.GM_setNativeValue === 'function') {
      await window.GM_setNativeValue(WATCH_STATE_STORAGE_KEY, store);
    }
  } catch {}
  try {
    if (window.dawgerWatchState && typeof window.dawgerWatchState.write === 'function') {
      await window.dawgerWatchState.write(store);
    }
  } catch {}
}

function scheduleNativeFlush(immediate = false): void {
  if (typeof window === 'undefined') return;
  if (immediate) {
    void flushWatchStateToNative();
    return;
  }
  if (flushTimer) return;
  flushTimer = setTimeout(() => {
    flushTimer = null;
    void flushWatchStateToNative();
  }, 500);
}

function bindLifecycleFlush(): void {
  if (listenersBound || typeof window === 'undefined') return;
  listenersBound = true;
  const onLeave = () => {
    void flushWatchStateToNative();
  };
  window.addEventListener('pagehide', onLeave);
  window.addEventListener('beforeunload', onLeave);
  if (typeof document !== 'undefined') {
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') onLeave();
    });
  }
}

function mergeWatchItems(localItem: WatchStateItem | undefined, remoteItem: WatchStateItem | undefined): WatchStateItem | undefined {
  if (!localItem) return remoteItem;
  if (!remoteItem) return localItem;

  const primary = localItem.updatedAt >= remoteItem.updatedAt ? localItem : remoteItem;
  const secondary = primary === localItem ? remoteItem : localItem;

  const mergedEpisodes: Record<string, EpisodePlaybackProgress> = { ...(secondary.episodes || {}) };
  for (const [epKey, epVal] of Object.entries(primary.episodes || {})) {
    const prev = mergedEpisodes[epKey];
    if (!prev || epVal.updatedAt >= prev.updatedAt) {
      mergedEpisodes[epKey] = epVal;
    }
  }

  return {
    ...secondary,
    ...primary,
    episodes: Object.keys(mergedEpisodes).length > 0 ? mergedEpisodes : undefined,
    updatedAt: Math.max(localItem.updatedAt || 0, remoteItem.updatedAt || 0),
  };
}

function mergeStores(localStore: WatchStateStore, remoteInput: any): { store: WatchStateStore; changed: boolean } {
  let remoteRaw = remoteInput;
  if (typeof remoteRaw === 'string') {
    try {
      remoteRaw = JSON.parse(remoteRaw);
    } catch {
      remoteRaw = null;
    }
  }
  if (!remoteRaw || typeof remoteRaw !== 'object' || !remoteRaw.items || typeof remoteRaw.items !== 'object') {
    return { store: localStore, changed: false };
  }

  let changed = false;
  const mergedItems: Record<string, WatchStateItem> = { ...localStore.items };
  for (const [, remoteVal] of Object.entries(remoteRaw.items as Record<string, WatchStateItem>)) {
    if (!remoteVal || !remoteVal.id) continue;
    const normKey = normalizeKey(remoteVal.mediaType || 'tv', remoteVal.id);
    const localVal = mergedItems[normKey];
    const merged = mergeWatchItems(localVal, { ...remoteVal, key: normKey });
    if (merged) {
      if (!localVal || merged.updatedAt > (localVal.updatedAt || 0) || JSON.stringify(merged) !== JSON.stringify(localVal)) {
        changed = true;
      }
      mergedItems[normKey] = merged;
    }
  }

  return {
    changed,
    store: {
      version: 1,
      updatedAt: Math.max(localStore.updatedAt || 0, Number(remoteRaw.updatedAt) || 0, Date.now()),
      items: mergedItems,
    },
  };
}

function backfillLegacyStorage(store: WatchStateStore): void {
  if (typeof localStorage === 'undefined') return;
  try {
    const cwRaw = localStorage.getItem('continueWatching');
    const cw = cwRaw ? JSON.parse(cwRaw) : { movies: [], tv: [] };
    if (!Array.isArray(cw.movies)) cw.movies = [];
    if (!Array.isArray(cw.tv)) cw.tv = [];
    let cwChanged = false;

    const sortedItems = Object.values(store.items).sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
    for (const item of sortedItems) {
      const idNum = Number(item.id);
      if (item.mediaType === 'movie') {
        if (item.positionSec && item.durationSec && !item.completed) {
          const legKey = `progress_${item.id}`;
          if (!localStorage.getItem(legKey)) {
            mirrorLegacyProgress('movie', item.id, undefined, undefined, item.positionSec, item.durationSec);
          }
        }
        if (item.title && item.posterPath && Number.isFinite(idNum) && !cw.movies.some((m: any) => Number(m.id) === idNum)) {
          cw.movies.push({
            id: idNum,
            title: item.title,
            poster_path: item.posterPath,
            backdrop_path: item.backdropPath || null,
            media_type: 'movie',
            addedAt: new Date(item.updatedAt || Date.now()).toISOString(),
          });
          cwChanged = true;
        }
      } else {
        for (const ep of Object.values(item.episodes || {})) {
          if (ep.positionSec && ep.durationSec && !ep.completed) {
            const legKey = `progress_tv_${item.id}_s${ep.season}_e${ep.episode}`;
            if (!localStorage.getItem(legKey)) {
              mirrorLegacyProgress(item.mediaType, item.id, ep.season, ep.episode, ep.positionSec, ep.durationSec);
            }
          }
        }
        if (
          item.title &&
          item.posterPath &&
          Number.isFinite(idNum) &&
          !cw.tv.some((t: any) => Number(t.id) === idNum)
        ) {
          cw.tv.push({
            id: idNum,
            title: item.title,
            name: item.title,
            poster_path: item.posterPath,
            backdrop_path: item.backdropPath || null,
            media_type: 'tv',
            isAnime: item.mediaType === 'anime',
            currentEpisode: {
              season: item.currentSeason || 1,
              episode: item.currentEpisode || 1,
              addedAt: new Date(item.updatedAt || Date.now()).toISOString(),
            },
          });
          cwChanged = true;
        }
      }
    }

    if (cwChanged) {
      localStorage.setItem('continueWatching', JSON.stringify(cw));
    }
  } catch {}
}

export async function hydrateWatchStateCache(): Promise<WatchStateStore> {
  bindLifecycleFlush();
  if (hydratePromise) return hydratePromise;

  hydratePromise = (async () => {
    let store = safeReadLocalStore();
    let changed = false;

    if (typeof window !== 'undefined') {
      if (typeof window.GM_getNativeValue === 'function') {
        try {
          const nativeVal = await window.GM_getNativeValue(WATCH_STATE_STORAGE_KEY, null);
          const merged = mergeStores(store, nativeVal);
          store = merged.store;
          changed = changed || merged.changed;
        } catch {}
      }
      if (window.dawgerWatchState && typeof window.dawgerWatchState.read === 'function') {
        try {
          const electronVal = await window.dawgerWatchState.read();
          const merged = mergeStores(store, electronVal);
          store = merged.store;
          changed = changed || merged.changed;
        } catch {}
      }
    }

    if (changed) {
      persistLocalStore(store);
      backfillLegacyStorage(store);
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent(WATCH_STATE_HYDRATED_EVENT, { detail: store }));
      }
    }

    return store;
  })();

  try {
    return await hydratePromise;
  } finally {
    hydratePromise = null;
  }
}

export function saveWatchState(patch: {
  mediaType: WatchMediaType;
  id: string | number;
  title?: string;
  posterPath?: string | null;
  backdropPath?: string | null;
  currentSeason?: number;
  currentEpisode?: number;
  lastSource?: string;
  lastLang?: string;
  lastPlayerName?: string;
  positionSec?: number;
  durationSec?: number;
  completed?: boolean;
  exactFlush?: boolean;
}): WatchStateItem {
  bindLifecycleFlush();
  const store = safeReadLocalStore();
  const idStr = String(patch.id);
  const key = normalizeKey(patch.mediaType, idStr);
  const prev = store.items[key];
  const now = Date.now();

  const next: WatchStateItem = {
    ...(prev || {}),
    key,
    mediaType: patch.mediaType === 'anime' ? 'anime' : prev?.mediaType || patch.mediaType,
    id: idStr,
    updatedAt: now,
  };

  if (patch.title) next.title = patch.title;
  if (patch.posterPath !== undefined) next.posterPath = patch.posterPath;
  if (patch.backdropPath !== undefined) next.backdropPath = patch.backdropPath;
  if (patch.currentSeason != null && patch.currentSeason > 0) next.currentSeason = Number(patch.currentSeason);
  if (patch.currentEpisode != null && patch.currentEpisode > 0) next.currentEpisode = Number(patch.currentEpisode);
  if (patch.lastSource) next.lastSource = patch.lastSource;
  if (patch.lastLang) next.lastLang = patch.lastLang;
  if (patch.lastPlayerName) next.lastPlayerName = patch.lastPlayerName;

  if (patch.positionSec != null && Number.isFinite(patch.positionSec)) {
    const pos = Math.max(0, Math.floor(patch.positionSec * 10) / 10);
    const dur = patch.durationSec != null && Number.isFinite(patch.durationSec) ? Math.max(0, patch.durationSec) : (prev?.durationSec || 0);
    const isNearEnd = dur > 45 ? pos >= dur - 20 : dur > 0 && pos >= dur * 0.95;
    const completed = patch.completed ?? isNearEnd;

    if (patch.mediaType === 'movie') {
      next.positionSec = completed ? 0 : pos;
      next.durationSec = dur;
      next.completed = completed;
      if (pos >= 5 || completed) {
        mirrorLegacyProgress('movie', idStr, undefined, undefined, completed ? dur : pos, dur);
      }
    } else if (next.currentSeason != null && next.currentEpisode != null) {
      const epKey = `${next.currentSeason}:${next.currentEpisode}`;
      next.episodes = {
        ...(prev?.episodes || {}),
        [epKey]: {
          season: next.currentSeason,
          episode: next.currentEpisode,
          positionSec: completed ? 0 : pos,
          durationSec: dur,
          completed,
          updatedAt: now,
        },
      };
      next.positionSec = completed ? 0 : pos;
      next.durationSec = dur;
      next.completed = completed;
      if (pos >= 5 || completed) {
        mirrorLegacyProgress(next.mediaType, idStr, next.currentSeason, next.currentEpisode, completed ? dur : pos, dur);
      }
    }
  }

  store.items[key] = next;
  store.updatedAt = now;
  persistLocalStore(store);
  scheduleNativeFlush(!!patch.exactFlush);
  return next;
}

export function savePlaybackPosition(params: {
  mediaType: WatchMediaType;
  id: string | number;
  season?: number;
  episode?: number;
  positionSec: number;
  durationSec: number;
  completed?: boolean;
  exactFlush?: boolean;
}): WatchStateItem | null {
  if (!Number.isFinite(params.positionSec) || params.positionSec < 5) {
    return null;
  }
  return saveWatchState({
    mediaType: params.mediaType,
    id: params.id,
    currentSeason: params.season,
    currentEpisode: params.episode,
    positionSec: params.positionSec,
    durationSec: params.durationSec,
    completed: params.completed,
    exactFlush: params.exactFlush,
  });
}

export function getWatchState(mediaType: WatchMediaType, id: string | number): WatchStateItem | null {
  const store = safeReadLocalStore();
  return store.items[normalizeKey(mediaType, id)] || null;
}

export function getSavedPosition(
  mediaType: WatchMediaType,
  id: string | number,
  season?: number,
  episode?: number
): { positionSec: number; durationSec: number; completed: boolean } | null {
  const idStr = String(id);
  const state = getWatchState(mediaType, idStr);

  if (mediaType === 'movie') {
    if (state && !state.completed && (state.positionSec || 0) >= 5 && (state.durationSec || 0) > 0) {
      return {
        positionSec: state.positionSec!,
        durationSec: state.durationSec!,
        completed: !!state.completed,
      };
    }
  } else if (season != null && episode != null) {
    const ep = state?.episodes?.[`${season}:${episode}`];
    if (ep && !ep.completed && ep.positionSec >= 5 && ep.durationSec > 0) {
      return {
        positionSec: ep.positionSec,
        durationSec: ep.durationSec,
        completed: ep.completed,
      };
    }
  }

  // Fallback vers les anciennes clés localStorage progress_*
  if (typeof localStorage !== 'undefined') {
    try {
      const legacyKey =
        mediaType === 'movie'
          ? `progress_${idStr}`
          : season != null && episode != null
            ? `progress_tv_${idStr}_s${season}_e${episode}`
            : null;
      if (legacyKey) {
        const raw = localStorage.getItem(legacyKey);
        if (raw) {
          const parsed = JSON.parse(raw);
          const pos = Number(parsed?.position) || 0;
          const dur = Number(parsed?.duration) || 0;
          const isNearEnd = dur > 45 ? pos >= dur - 20 : dur > 0 && pos >= dur * 0.95;
          if (pos >= 5 && dur > 0 && !isNearEnd) {
            return { positionSec: pos, durationSec: dur, completed: false };
          }
        }
      }
    } catch {}
  }

  return null;
}
