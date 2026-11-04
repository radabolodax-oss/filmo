const normalizeBaseUrl = (value?: string): string => (value || '').trim().replace(/\/+$/, '');

const getDynamicApiUrl = (): string => {
  if (typeof window !== 'undefined') {
    const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    let custom = (window as any).__DAWGER_API__ || localStorage.getItem('dawger_server_url');
    if (custom && typeof custom === 'string') {
      if (
        custom.includes('metropolitan-seat') ||
        custom.includes('billy-affairs') ||
        custom.includes('pichunter-linda') ||
        (isLocal && custom.includes('trycloudflare.com'))
      ) {
        try { localStorage.removeItem('dawger_server_url'); } catch {}
        custom = null;
      } else {
        return normalizeBaseUrl(custom);
      }
    }
    if (isLocal) {
      return 'http://localhost:25565';
    }
  }
  const envApi = normalizeBaseUrl(import.meta.env.VITE_MAIN_API as string);
  if (envApi && !envApi.includes('pichunter-linda') && !envApi.includes('metropolitan-seat') && !envApi.includes('billy-affairs')) {
    return envApi;
  }
  return 'http://localhost:25565';
};

export const SITE_URL = normalizeBaseUrl(import.meta.env.VITE_SITE_URL as string) ||
  (typeof window !== 'undefined' ? normalizeBaseUrl(window.location.origin) : '');

export const WATCHPARTY_API = normalizeBaseUrl(import.meta.env.VITE_WATCHPARTY_API as string) || getDynamicApiUrl();

export const PROXY_BASE_URL = normalizeBaseUrl(import.meta.env.VITE_PROXY_BASE_URL as string) || getDynamicApiUrl();
export const MAIN_API = getDynamicApiUrl();
export const API_PROXY_BASE_URL = normalizeBaseUrl(import.meta.env.VITE_API_PROXY_BASE_URL as string) || getDynamicApiUrl();
export const PROXIES_EMBED_API = normalizeBaseUrl(import.meta.env.VITE_PROXIES_EMBED_API as string) || getDynamicApiUrl();
export const BESTDEBRID_API_BASE = 'https://bestdebrid.com/api/v1';

export const buildSiteUrl = (path: string): string => {
  if (!SITE_URL) return path;
  return `${SITE_URL}${path.startsWith('/') ? path : `/${path}`}`;
};

export const buildProxyUrl = (url: string): string => {
  const base = PROXY_BASE_URL || MAIN_API;
  if (!base) return url;
  return `${base}/proxy/${url}`;
};

export const buildApiProxyUrl = (url: string): string => {
  const base = API_PROXY_BASE_URL || MAIN_API;
  if (!base) return url;
  return `${base}/proxy/${url}`;
};

export const embedProxy = (url: string): string => {
  if (!url) return url;
  const base = PROXIES_EMBED_API || MAIN_API;
  if (!base) return url;
  return `${base}/embed-proxy?url=${encodeURIComponent(url)}`;
};
