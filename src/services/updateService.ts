/**
 * Update Service for Dawger.
 * Checks for updates against version.json and orchestrates in-app downloads
 * and seamless installations for Android (Capacitor) and PC (Electron).
 */

export interface UpdatePlatformInfo {
  url: string;
  fallbackUrl?: string;
  size?: string;
  portableUrl?: string;
}

export interface UpdateInfo {
  version: string;
  versionCode: number;
  minRequiredVersion?: string;
  releaseDate?: string;
  title?: string;
  changelog?: string[];
  platforms?: {
    android?: UpdatePlatformInfo;
    android_tv?: UpdatePlatformInfo;
    windows?: UpdatePlatformInfo;
    mac?: UpdatePlatformInfo;
  };
}

export interface UpdateProgress {
  percent: number;
  bytesDownloaded?: number;
  totalBytes?: number;
}

export interface CheckUpdateResult {
  hasUpdate: boolean;
  currentVersion: string;
  updateInfo: UpdateInfo | null;
  error?: string;
}

// Current embedded version of Dawger
export const CURRENT_APP_VERSION = '1.0.0';
export const CURRENT_VERSION_CODE = 1;

// Endpoints to check for updates (cascade fallback)
const VERSION_MANIFEST_URLS = [
  'http://localhost:8080/version.json',
  '/version.json',
  'https://raw.githubusercontent.com/dawgercorp/DawgerOpenSource/main/version.json',
];

interface CapacitorApkInstallerPlugin {
  canInstall?: () => Promise<{ canInstall: boolean }>;
  openInstallPermissionSettings?: () => Promise<void>;
  installApk?: (options?: { filePath?: string }) => Promise<void>;
  downloadAndInstall?: (options: { url: string; version?: string }) => Promise<{ success: boolean }>;
  addListener?: (eventName: string, listenerFunc: (info: any) => void) => Promise<{ remove: () => Promise<void> }>;
}

interface WindowWithCapacitor {
  Capacitor?: {
    isNativePlatform?: () => boolean;
    getPlatform?: () => string;
    Plugins?: {
      ApkInstaller?: CapacitorApkInstallerPlugin;
      [key: string]: any;
    };
  };
  electron?: any;
}

/**
 * Check whether the app is running as a native Android Capacitor app.
 */
export function isAndroidNative(): boolean {
  if (typeof window === 'undefined') return false;
  const cap = (window as unknown as WindowWithCapacitor).Capacitor;
  const isCap = !!cap?.isNativePlatform?.();
  const platform = cap?.getPlatform?.();
  const isAndroidUA = /android/i.test(navigator.userAgent);
  return (isCap && platform === 'android') || (isCap && isAndroidUA);
}

/**
 * Check whether the app is running inside Electron (PC).
 */
export function isElectron(): boolean {
  if (typeof window === 'undefined') return false;
  const ua = navigator.userAgent.toLowerCase();
  return ua.includes('electron') || ua.includes('pc dawger') || !!(window as unknown as WindowWithCapacitor).electron;
}

/**
 * Compare two semver strings (e.g. "1.0.1" vs "1.0.0").
 * Returns 1 if v1 > v2, -1 if v1 < v2, 0 if equal.
 */
function compareSemver(v1: string, v2: string): number {
  const clean1 = v1.replace(/^v/, '').split('.').map(Number);
  const clean2 = v2.replace(/^v/, '').split('.').map(Number);
  for (let i = 0; i < Math.max(clean1.length, clean2.length); i++) {
    const num1 = clean1[i] || 0;
    const num2 = clean2[i] || 0;
    if (num1 > num2) return 1;
    if (num1 < num2) return -1;
  }
  return 0;
}

/**
 * Fetches the version manifest from available endpoints.
 */
export async function checkForAppUpdates(): Promise<CheckUpdateResult> {
  let manifest: UpdateInfo | null = null;
  let lastError: any = null;

  for (const url of VERSION_MANIFEST_URLS) {
    try {
      const res = await fetch(`${url}?_t=${Date.now()}`, {
        cache: 'no-store',
        headers: { Accept: 'application/json' },
      });
      if (res.ok) {
        manifest = await res.json();
        if (manifest && manifest.version) break;
      }
    } catch (err) {
      lastError = err;
    }
  }

  if (!manifest) {
    return {
      hasUpdate: false,
      currentVersion: CURRENT_APP_VERSION,
      updateInfo: null,
      error: lastError ? String(lastError) : 'Impossible de contacter le serveur de mise à jour',
    };
  }

  const hasUpdate =
    manifest.versionCode > CURRENT_VERSION_CODE ||
    compareSemver(manifest.version, CURRENT_APP_VERSION) > 0;

  return {
    hasUpdate,
    currentVersion: CURRENT_APP_VERSION,
    updateInfo: manifest,
  };
}

/**
 * Determines the best download URL for the current platform.
 */
export function getPlatformDownloadUrl(updateInfo: UpdateInfo): string {
  const isAndroid = isAndroidNative() || /android/i.test(navigator.userAgent);
  const isMac = /macintosh|mac os x/i.test(navigator.userAgent);

  if (isAndroid) {
    const androidInfo = updateInfo.platforms?.android || updateInfo.platforms?.android_tv;
    return androidInfo?.url || androidInfo?.fallbackUrl || '';
  }

  if (isMac) {
    return updateInfo.platforms?.mac?.url || updateInfo.platforms?.mac?.fallbackUrl || '';
  }

  // Windows / PC
  const win = updateInfo.platforms?.windows;
  return win?.url || win?.portableUrl || win?.fallbackUrl || '';
}

/**
 * Starts in-app download and installation.
 * For Android: uses native ApkInstaller plugin.
 * For PC / Web: downloads or opens the binary.
 */
export async function startAppUpdate(
  updateInfo: UpdateInfo,
  onProgress?: (progress: UpdateProgress) => void
): Promise<{ success: boolean; message?: string }> {
  const targetUrl = getPlatformDownloadUrl(updateInfo);
  if (!targetUrl) {
    throw new Error('Aucune URL de mise à jour trouvée pour cette plateforme.');
  }

  // Normalize absolute URL if relative
  const absoluteUrl = targetUrl.startsWith('http')
    ? targetUrl
    : `${window.location.origin}${targetUrl.startsWith('/') ? '' : '/'}${targetUrl}`;

  // 1. Android Native via Capacitor ApkInstaller Plugin
  if (isAndroidNative()) {
    const cap = (window as unknown as WindowWithCapacitor).Capacitor;
    const installer = cap?.Plugins?.ApkInstaller;

    if (installer?.downloadAndInstall) {
      let listenerHandle: { remove: () => Promise<void> } | null = null;
      if (installer.addListener && onProgress) {
        try {
          listenerHandle = await installer.addListener('downloadProgress', (data: any) => {
            onProgress({
              percent: typeof data.percent === 'number' ? data.percent : 0,
              bytesDownloaded: data.bytesDownloaded,
              totalBytes: data.totalBytes,
            });
          });
        } catch (e) {
          console.warn('[updateService] Erreur attachement listener progression', e);
        }
      }

      try {
        await installer.downloadAndInstall({
          url: absoluteUrl,
          version: updateInfo.version,
        });
        return { success: true, message: 'Installation démarrée.' };
      } catch (err: any) {
        if (err?.message === 'PERMISSION_NEEDED' || String(err).includes('PERMISSION_NEEDED')) {
          return {
            success: false,
            message: 'Permission requise : autorisez Dawger à installer des applications inconnues puis réessayez.',
          };
        }
        throw err;
      } finally {
        if (listenerHandle) {
          listenerHandle.remove().catch(() => {});
        }
      }
    }
  }

  // 2. PC / Web fallback: stream download with real-time progress feedback
  try {
    const response = await fetch(absoluteUrl);
    if (!response.ok) {
      throw new Error(`Erreur HTTP ${response.status} lors du téléchargement`);
    }

    const contentLength = response.headers.get('content-length');
    const totalBytes = contentLength ? parseInt(contentLength, 10) : 0;

    if (response.body && totalBytes > 0) {
      const reader = response.body.getReader();
      let receivedBytes = 0;
      const chunks: Uint8Array[] = [];

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        if (value) {
          chunks.push(value);
          receivedBytes += value.length;
          const percent = Math.min(100, Math.round((receivedBytes / totalBytes) * 100));
          if (onProgress) {
            onProgress({
              percent,
              bytesDownloaded: receivedBytes,
              totalBytes,
            });
          }
        }
      }

      // Final completion progress
      if (onProgress) {
        onProgress({
          percent: 100,
          bytesDownloaded: totalBytes,
          totalBytes,
        });
      }

      // Create blob and trigger save
      const blob = new Blob(chunks as any);
      const blobUrl = URL.createObjectURL(blob);
      const filename = absoluteUrl.split('/').pop() || 'dawger-update';

      const link = document.createElement('a');
      link.href = blobUrl;
      link.setAttribute('download', filename);
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      setTimeout(() => URL.revokeObjectURL(blobUrl), 30000);

      return {
        success: true,
        message: 'Téléchargement terminé avec succès.',
      };
    }
  } catch (streamErr) {
    console.warn('[updateService] Erreur stream progress, fallback lien direct', streamErr);
  }

  // Fallback: direct download link trigger if stream fails
  if (onProgress) {
    onProgress({ percent: 100 });
  }

  const link = document.createElement('a');
  link.href = absoluteUrl;
  link.setAttribute('download', '');
  link.target = '_blank';
  link.rel = 'noopener noreferrer';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  return {
    success: true,
    message: 'Téléchargement de la mise à jour lancé.',
  };
}
