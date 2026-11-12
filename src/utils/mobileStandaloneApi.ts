import type { AxiosInstance, InternalAxiosRequestConfig, AxiosResponse } from 'axios';

/**
 * Mobile Standalone API Layer (`mobileStandaloneApi.ts`)
 *
 * Permet à l'APK Android Dawger de fonctionner à 100% en autonomie (24h/24, gratuit,
 * sans PC allumé ni tunnel Cloudflare) en utilisant directement le pont natif
 * Android (`window.GM_xmlhttpRequest` + `window.GM_openMediaProxy` + `MediaProxyServer`
 * avec `libcurl-impersonate` / `Cronet` / `OkHttp`).
 *
 * Fonctionne automatiquement :
 * 1. Dans l'APK Android (`appassets.androidplatform.net` ou `window.GM_xmlhttpRequest` présent)
 *    lorsque aucun backend distant n'est joignable (ou directement pour les sources supportées).
 * 2. En fallback instantané sur le web si le backend est hors-ligne et que l'extension/userscript
 *    fournit `window.GM_xmlhttpRequest`.
 */

const TMDB_API_KEY = (import.meta as any).env?.VITE_TMDB_API_KEY || '15d2ea6d0dc1d476efbca3eba2b9bbfb';
const DEFAULT_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';

interface GmResponse {
  status: number;
  responseText: string;
  finalUrl: string;
  responseHeaders: string;
}

export function isMobileAppEnvironment(): boolean {
  if (typeof window === 'undefined') return false;
  return (
    window.location.hostname === 'appassets.androidplatform.net' ||
    typeof (window as any).ReactNativeWebView !== 'undefined' ||
    typeof (window as any).GM_openMediaProxy === 'function'
  );
}

export function hasNativeBridge(): boolean {
  return typeof window !== 'undefined' && typeof (window as any).GM_xmlhttpRequest === 'function';
}

/**
 * Attends jusqu'à `timeoutMs` que `window.GM_xmlhttpRequest` soit injecté par le bridge React Native.
 */
async function waitForNativeBridge(timeoutMs = 1500): Promise<boolean> {
  if (hasNativeBridge()) return true;
  if (!isMobileAppEnvironment()) return false;
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (hasNativeBridge()) return true;
    await new Promise((r) => setTimeout(r, 40));
  }
  return hasNativeBridge();
}

/**
 * Exécute une requête HTTP via `window.GM_xmlhttpRequest` (contourne CORS et Cloudflare via OkHttp/Cronet).
 */
export function gmRequest(options: {
  url: string;
  method?: string;
  headers?: Record<string, string>;
  data?: string;
  timeout?: number;
  redirect?: 'follow' | 'manual';
}): Promise<GmResponse> {
  return new Promise((resolve, reject) => {
    const gm = (window as any).GM_xmlhttpRequest;
    if (typeof gm !== 'function') {
      reject(new Error('GM_xmlhttpRequest unavailable'));
      return;
    }
    gm({
      method: options.method || 'GET',
      url: options.url,
      headers: {
        'User-Agent': DEFAULT_UA,
        ...(options.headers || {}),
      },
      data: options.data,
      timeout: options.timeout || 10000,
      redirect: options.redirect || 'follow',
      onload: (res: any) => {
        resolve({
          status: res.status || 0,
          responseText: typeof res.responseText === 'string' ? res.responseText : '',
          finalUrl: res.finalUrl || options.url,
          responseHeaders: res.responseHeaders || '',
        });
      },
      onerror: (err: any) => {
        reject(new Error(err?.error || 'GM_xmlhttpRequest network error'));
      },
      ontimeout: () => {
        reject(new Error('GM_xmlhttpRequest timeout'));
      },
    });
  });
}

/**
 * Crée un lecteur HTML5 `<video>` autonome encapsulé dans un `blob:` URL
 * pour lire les flux MP4/M3U8 proxifiés par `window.GM_openMediaProxy` à l'intérieur
 * de l'iframe d'EmbedPlayerChrome (zéro pub, plein écran et contrôles natifs).
 */
const directProxyUrlCache = new Map<string, string | null>();
const blobPlayerCache = new Map<string, string>();

function sanitizeMediaProxyHeaders(headers: Record<string, string>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(headers || {})) {
    if (k.toLowerCase() === 'origin' || !v) continue;
    out[k] = v;
  }
  return out;
}

async function createDirectMediaProxyUrl(
  streamUrl: string,
  headers: Record<string, string>
): Promise<string | null> {
  if (!streamUrl || !streamUrl.startsWith('http')) return null;
  const cleanHeaders = sanitizeMediaProxyHeaders(headers);
  const cacheKey = `${streamUrl}|${JSON.stringify(cleanHeaders)}`;
  if (directProxyUrlCache.has(cacheKey)) {
    return directProxyUrlCache.get(cacheKey) || null;
  }

  const openProxy = typeof window !== 'undefined' ? (window as any).GM_openMediaProxy : undefined;
  if (typeof openProxy === 'function') {
    try {
      const proxied = await openProxy({
        url: streamUrl,
        method: 'GET',
        headers: cleanHeaders,
      });
      if (proxied && typeof proxied === 'string') {
        const tagged = proxied.includes('#') ? proxied : `${proxied}#mp4`;
        directProxyUrlCache.set(cacheKey, tagged);
        return tagged;
      }
    } catch (e) {
      console.warn('[StandaloneAPI] GM_openMediaProxy failed:', e);
    }
    // Sur mobile natif, ne jamais retomber silencieusement sur l'URL CDN brute bloquée par Referer/Origin
    return null;
  }

  const fallback = streamUrl.includes('#') ? streamUrl : `${streamUrl}#mp4`;
  directProxyUrlCache.set(cacheKey, fallback);
  return fallback;
}

async function createProxiedVideoEmbedUrl(
  streamUrl: string,
  headers: Record<string, string>,
  title = 'Lecteur Direct',
  preResolvedDirectUrl?: string | null
): Promise<string | null> {
  const cleanHeaders = sanitizeMediaProxyHeaders(headers);
  const cacheKey = `${streamUrl}|${JSON.stringify(cleanHeaders)}`;
  const cached = blobPlayerCache.get(cacheKey);
  if (cached) return cached;

  const directUrl = preResolvedDirectUrl !== undefined
    ? preResolvedDirectUrl
    : await createDirectMediaProxyUrl(streamUrl, cleanHeaders);
  if (!directUrl) return null;

  const cleanPlayableUrl = directUrl.split('#')[0];
  const safeUrl = cleanPlayableUrl.replace(/"/g, '&quot;');
  const html = `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no" />
<title>${title.replace(/</g, '&lt;')}</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  html, body { width: 100%; height: 100%; background: #000; overflow: hidden; display: flex; align-items: center; justify-content: center; }
  video { width: 100%; height: 100%; object-fit: contain; background: #000; outline: none; }
</style>
</head>
<body>
  <video id="v" src="${safeUrl}" controls autoplay playsinline preload="auto"></video>
  <script>
    const v = document.getElementById('v');
    v.play().catch(() => {});
  </script>
</body>
</html>`;

  if (typeof Blob !== 'undefined' && typeof URL !== 'undefined' && typeof URL.createObjectURL === 'function') {
    const blob = new Blob([html], { type: 'text/html' });
    const blobUrl = URL.createObjectURL(blob);
    blobPlayerCache.set(cacheKey, blobUrl);
    return blobUrl;
  }
  return directUrl;
}

function parseSizeInGb(rawSize: unknown): number {
  if (typeof rawSize !== 'string') return 0;
  const m = rawSize.trim().match(/([\d.,]+)\s*(tb|to|gb|go|mb|mo)?/i);
  if (!m) return 0;
  const val = parseFloat(m[1].replace(',', '.'));
  if (!Number.isFinite(val)) return 0;
  const unit = (m[2] || '').toLowerCase();
  if (unit === 'tb' || unit === 'to') return val * 1024;
  if (unit === 'mb' || unit === 'mo') return val / 1024;
  return val;
}

function isTrue4KStream(rawSize: unknown, url?: string, quality?: string): boolean {
  const hasGbUnit = typeof rawSize === 'string' && /(gb|go|tb|to)\b/i.test(rawSize);
  const gb = hasGbUnit ? parseSizeInGb(rawSize) : 0;
  return (
    gb >= 7.5 ||
    /\b(4k|2160p?|uhd)\b/i.test(String(url || '')) ||
    /\b(4k|2160p?|uhd)\b/i.test(String(quality || ''))
  );
}

function decodeBase64Utf8(raw: string): string | null {
  try {
    const clean = raw.replace(/[^A-Za-z0-9+/_-]/g, '').replace(/-/g, '+').replace(/_/g, '/');
    if (!clean) return null;
    const padded = clean.padEnd(clean.length + ((4 - (clean.length % 4)) % 4), '=');
    if (typeof atob === 'function') {
      const bin = atob(padded);
      const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
      return new TextDecoder().decode(bytes);
    }
    if (typeof Buffer !== 'undefined') {
      return Buffer.from(padded, 'base64').toString('utf8');
    }
  } catch {}
  return null;
}

// ─── Cache mémoire local (TTL 15 min) ───────────────────────────────────────
const apiCache = new Map<string, { data: any; ts: number }>();
const API_CACHE_TTL = 15 * 60 * 1000;

function getCached(key: string): any | null {
  const entry = apiCache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.ts > API_CACHE_TTL) {
    apiCache.delete(key);
    return null;
  }
  return entry.data;
}

function setCached(key: string, data: any): void {
  apiCache.set(key, { data, ts: Date.now() });
}

// ─── Helper TMDB (Direct) ───────────────────────────────────────────────────
async function fetchTmdbInfo(
  tmdbId: string | number,
  type: 'movie' | 'tv'
): Promise<{ title: string; originalTitle: string; year: string | null } | null> {
  const cacheKey = `tmdb_info:${type}:${tmdbId}`;
  const cached = getCached(cacheKey);
  if (cached) return cached;

  try {
    const url = `https://api.themoviedb.org/3/${type}/${tmdbId}?api_key=${TMDB_API_KEY}&language=fr-FR`;
    let data: any = null;
    if (hasNativeBridge()) {
      const r = await gmRequest({ url, timeout: 6000 });
      if (r.status === 200) data = JSON.parse(r.responseText);
    } else {
      const r = await fetch(url);
      if (r.ok) data = await r.json();
    }
    if (!data) return null;
    const title = (type === 'movie' ? data.title || data.original_title : data.name || data.original_name) || '';
    const originalTitle = (type === 'movie' ? data.original_title : data.original_name) || title;
    const dateStr = (type === 'movie' ? data.release_date : data.first_air_date) || '';
    const year = dateStr ? dateStr.split('-')[0] : null;
    const info = { title, originalTitle, year };
    setCached(cacheKey, info);
    return info;
  } catch {
    return null;
  }
}

function normalizeStr(s: string): string {
  return String(s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function slugifyMiaw(text: string): string {
  return String(text || '')
    .toString()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/['’]/g, '-')
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/--+/g, '-')
    .replace(/^-+|-+$/g, '');
}

// ─── 1. WEBFLIX (FastFlux MP4 + Nexus + Vidzy + Frembed + Cinesrc) ──────────
async function handleWebflixMovie(tmdbId: string): Promise<any> {
  const cacheKey = `webflix:movie:${tmdbId}`;
  const cached = getCached(cacheKey);
  if (cached) return cached;

  const players: { vf: any[]; vostfr: any[] } = { vf: [], vostfr: [] };

  const [ffResp, vidzyApiResp] = await Promise.all([
    gmRequest({
      url: `https://webflix.bio/api/fastflux?type=movie&tmdb_id=${tmdbId}`,
      headers: { Referer: 'https://webflix.bio/', Accept: 'application/json' },
      timeout: 6500,
    }).catch(() => null),
    gmRequest({
      url: `https://vidzy.org/api/${tmdbId}`,
      headers: { Referer: 'https://webflix.bio/', Accept: 'application/json' },
      timeout: 5000,
    }).catch(() => null),
  ]);

  if (ffResp && ffResp.status === 200) {
    try {
      const ffJson = JSON.parse(ffResp.responseText);
      if (ffJson?.available && ffJson?.data?.url) {
        const d = ffJson.data;
        const rawSize = d.size || '';
        const is4K = isTrue4KStream(rawSize, d.url, d.quality);
        const qualityLabel = is4K ? '4K Ultra HD' : (d.quality || '1080p FHD');
        const displayName = is4K
          ? `👑 FastFlux 4K Ultra HD (VF)${rawSize ? ` (${rawSize})` : ''}`
          : `FastFlux 1080p FHD (VF)${rawSize ? ` (${rawSize})` : ''}`;
        const directProxyUrl = await createDirectMediaProxyUrl(d.url, { Referer: 'https://webflix.bio/' });
        if (directProxyUrl) {
          const proxiedEmbed = await createProxiedVideoEmbedUrl(
            d.url,
            { Referer: 'https://webflix.bio/' },
            displayName,
            directProxyUrl
          );
          players.vf.unshift({
            name: displayName,
            url: proxiedEmbed || directProxyUrl,
            directUrl: directProxyUrl,
            rawUrl: d.url,
            hoster: 'fastflux',
            quality: qualityLabel,
            size: rawSize,
            is4K,
            language: 'vf',
            type: 'webflix',
          });
        }
      }
    } catch {}
  }

  let vidzyVffAvailable = true;
  let vidzyVostfrAvailable = false;
  if (vidzyApiResp && vidzyApiResp.status === 200) {
    try {
      const vj = JSON.parse(vidzyApiResp.responseText);
      vidzyVffAvailable = !!(vj.vf || vj.vff || vj.vfq);
      vidzyVostfrAvailable = !!vj.vostfr;
    } catch {}
  }

  players.vf.push({
    name: 'Nexus (VF)',
    url: `https://api.moviez.ac/${tmdbId}?lang=vf&color=a78bfa&hide=download`,
    hoster: 'nexus',
    language: 'vf',
    type: 'embed',
  });
  players.vostfr.push({
    name: 'Nexus (VOSTFR)',
    url: `https://api.moviez.ac/${tmdbId}?lang=vostfr&color=a78bfa&hide=download`,
    hoster: 'nexus',
    language: 'vostfr',
    type: 'embed',
  });

  if (vidzyVffAvailable) {
    players.vf.push({
      name: 'Vidzy (VF)',
      url: `https://vidzy.org/movie/${tmdbId}/vf?autoplay=1`,
      hoster: 'vidzy',
      language: 'vf',
      type: 'embed',
    });
  }
  if (vidzyVostfrAvailable) {
    players.vostfr.push({
      name: 'Vidzy (VOSTFR)',
      url: `https://vidzy.org/movie/${tmdbId}/vostfr?autoplay=1`,
      hoster: 'vidzy',
      language: 'vostfr',
      type: 'embed',
    });
  }

  players.vf.push({
    name: 'Frembed (VF)',
    url: `https://frembed.uno/api/film.php?id=${tmdbId}`,
    hoster: 'frembed',
    language: 'vf',
    type: 'embed',
  });
  players.vf.push({
    name: 'Cinesrc (Multi)',
    url: `https://cinesrc.st/embed/movie/${tmdbId}`,
    hoster: 'cinesrc',
    language: 'vf',
    type: 'embed',
  });

  const result = {
    success: true,
    source: 'webflix',
    tmdbId: Number(tmdbId),
    players,
    embedUrl: players.vf[0]?.url || players.vostfr[0]?.url,
  };
  setCached(cacheKey, result);
  return result;
}

async function handleWebflixTv(tmdbId: string, season: string | number, episode: string | number): Promise<any> {
  const cacheKey = `webflix:tv:${tmdbId}:${season}:${episode}`;
  const cached = getCached(cacheKey);
  if (cached) return cached;

  const players: { vf: any[]; vostfr: any[] } = { vf: [], vostfr: [] };

  const [ffResp, vidzyApiResp] = await Promise.all([
    gmRequest({
      url: `https://webflix.bio/api/fastflux?type=episode&tmdb_id=${tmdbId}&season=${season}&episode=${episode}`,
      headers: { Referer: 'https://webflix.bio/', Accept: 'application/json' },
      timeout: 6500,
    }).catch(() => null),
    gmRequest({
      url: `https://vidzy.org/api/${tmdbId}`,
      headers: { Referer: 'https://webflix.bio/', Accept: 'application/json' },
      timeout: 5000,
    }).catch(() => null),
  ]);

  if (ffResp && ffResp.status === 200) {
    try {
      const ffJson = JSON.parse(ffResp.responseText);
      if (ffJson?.available && ffJson?.data?.url) {
        const d = ffJson.data;
        const rawSize = d.size || '';
        const is4K = isTrue4KStream(rawSize, d.url, d.quality);
        const qualityLabel = is4K ? '4K Ultra HD' : (d.quality || '1080p FHD');
        const displayName = is4K
          ? `👑 FastFlux 4K Ultra HD (VF)${rawSize ? ` (${rawSize})` : ''}`
          : `FastFlux 1080p FHD (VF)${rawSize ? ` (${rawSize})` : ''}`;
        const directProxyUrl = await createDirectMediaProxyUrl(d.url, { Referer: 'https://webflix.bio/' });
        if (directProxyUrl) {
          const proxiedEmbed = await createProxiedVideoEmbedUrl(
            d.url,
            { Referer: 'https://webflix.bio/' },
            displayName,
            directProxyUrl
          );
          players.vf.unshift({
            name: displayName,
            url: proxiedEmbed || directProxyUrl,
            directUrl: directProxyUrl,
            rawUrl: d.url,
            hoster: 'fastflux',
            quality: qualityLabel,
            size: rawSize,
            is4K,
            language: 'vf',
            type: 'webflix',
          });
        }
      }
    } catch {}
  }

  let vidzyVffAvailable = true;
  let vidzyVostfrAvailable = false;
  if (vidzyApiResp && vidzyApiResp.status === 200) {
    try {
      const vj = JSON.parse(vidzyApiResp.responseText);
      const sData = vj?.seasons?.[String(season)]?.episodes?.[String(episode)];
      if (sData) {
        vidzyVffAvailable = !!(sData.vf || sData.vff || sData.vfq);
        vidzyVostfrAvailable = !!sData.vostfr;
      }
    } catch {}
  }

  players.vf.push({
    name: 'Nexus (VF)',
    url: `https://api.moviez.ac/serie/${tmdbId}/${season}/${episode}?lang=vf&color=a78bfa&hide=download`,
    hoster: 'nexus',
    language: 'vf',
    type: 'embed',
  });
  players.vostfr.push({
    name: 'Nexus (VOSTFR)',
    url: `https://api.moviez.ac/serie/${tmdbId}/${season}/${episode}?lang=vostfr&color=a78bfa&hide=download`,
    hoster: 'nexus',
    language: 'vostfr',
    type: 'embed',
  });

  if (vidzyVffAvailable) {
    players.vf.push({
      name: 'Vidzy (VF)',
      url: `https://vidzy.org/serie/${tmdbId}/${season}/${episode}/vf?autoplay=1`,
      hoster: 'vidzy',
      language: 'vf',
      type: 'embed',
    });
  }
  if (vidzyVostfrAvailable) {
    players.vostfr.push({
      name: 'Vidzy (VOSTFR)',
      url: `https://vidzy.org/serie/${tmdbId}/${season}/${episode}/vostfr?autoplay=1`,
      hoster: 'vidzy',
      language: 'vostfr',
      type: 'embed',
    });
  }

  players.vf.push({
    name: 'Frembed (VF)',
    url: `https://frembed.uno/api/serie.php?id=${tmdbId}&sa=${season}&epi=${episode}`,
    hoster: 'frembed',
    language: 'vf',
    type: 'embed',
  });
  players.vf.push({
    name: 'Cinesrc (Multi)',
    url: `https://cinesrc.st/embed/tv/${tmdbId}?s=${season}&e=${episode}`,
    hoster: 'cinesrc',
    language: 'vf',
    type: 'embed',
  });

  const result = {
    success: true,
    source: 'webflix',
    tmdbId: Number(tmdbId),
    season: Number(season),
    episode: Number(episode),
    players,
    embedUrl: players.vf[0]?.url || players.vostfr[0]?.url,
  };
  setCached(cacheKey, result);
  return result;
}

// ─── 2. MIAW (miaw.tv direct + r.jina.ai fallback + Blink proxy) ────────────
async function fetchMiawPage(targetUrl: string): Promise<{ html: string; finalUrl: string }> {
  try {
    const r = await gmRequest({
      url: targetUrl,
      headers: {
        Referer: 'https://miaw.tv/',
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
      timeout: 7000,
    });
    if (
      r.status === 200 &&
      r.responseText &&
      !r.responseText.includes('Just a moment...') &&
      r.responseText.length > 400
    ) {
      return { html: r.responseText, finalUrl: r.finalUrl || targetUrl };
    }
  } catch {}

  try {
    const jina = await gmRequest({
      url: `https://r.jina.ai/${targetUrl}`,
      headers: {
        'X-Return-Format': 'html',
        Accept: 'text/html,text/plain,*/*',
      },
      timeout: 9000,
    });
    if (jina.status === 200 && jina.responseText) {
      return { html: jina.responseText, finalUrl: targetUrl };
    }
  } catch {}

  return { html: '', finalUrl: targetUrl };
}

function extractMiawPlayersArray(html: string): any[] {
  if (!html) return [];
  // Next.js RSC payload : JSON échappé (\"players\":[) — même logique que le backend PC
  let marker = '\\"players\\":[';
  let isEscaped = true;
  let idx = html.indexOf(marker);
  if (idx === -1) {
    marker = '"players":[';
    isEscaped = false;
    idx = html.indexOf(marker);
  }
  if (idx === -1) {
    marker = '&quot;players&quot;:[';
    idx = html.indexOf(marker);
    if (idx !== -1) {
      html = html.replace(/&quot;/g, '"');
      marker = '"players":[';
      idx = html.indexOf(marker);
    }
  }
  if (idx === -1) return [];
  const start = idx + marker.length - 1;
  let depth = 0;
  let end = -1;
  for (let i = start; i < html.length; i++) {
    if (html[i] === '[') depth++;
    else if (html[i] === ']') {
      depth--;
      if (depth === 0) {
        end = i + 1;
        break;
      }
    }
  }
  if (end === -1) return [];
  try {
    const raw = html.slice(start, end);
    const jsonStr = isEscaped ? raw.replace(/\\"/g, '"').replace(/\\\\/g, '\\') : raw;
    const parsed = JSON.parse(jsonStr);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function classifyMiawEmbed(rawUrl: string, choiceKey?: string, rawType?: string): { namePrefix: string; hoster: string } {
  const lower = rawUrl.toLowerCase();
  const ck = String(choiceKey || '').toLowerCase();
  const tp = String(rawType || '').toLowerCase();

  if (ck.includes('sharecloudy') || lower.includes('sharecloudy')) {
    return { namePrefix: 'Miaw ShareCloudy', hoster: 'sharecloudy' };
  }
  if (lower.includes('moviez')) {
    return { namePrefix: 'Miaw Moviez', hoster: 'moviez' };
  }
  if (lower.includes('uqload')) {
    return { namePrefix: 'Miaw Uqload', hoster: 'uqload' };
  }
  if (tp === 'vidzy' || lower.includes('vidzy')) {
    return { namePrefix: 'Miaw Vidzy', hoster: 'vidzy' };
  }
  try {
    const host = new URL(rawUrl).hostname.replace(/^www\./i, '');
    if (host) {
      const short = host.split('.')[0];
      const label = short ? short.charAt(0).toUpperCase() + short.slice(1) : host;
      return { namePrefix: `Miaw ${label}`, hoster: short || 'embed' };
    }
  } catch {}
  return { namePrefix: 'Miaw', hoster: tp || 'embed' };
}

async function formatMiawPlayers(rawPlayers: any[]): Promise<{ vf: any[]; vostfr: any[] }> {
  const vf: any[] = [];
  const vostfr: any[] = [];
  const seen = new Set<string>();

  for (let i = 0; i < rawPlayers.length; i++) {
    const p = rawPlayers[i];
    if (!p || !p.src || typeof p.src !== 'string') continue;
    if (p.src.includes('t.me') || p.src.includes('telegram')) continue;
    const lang = String(p.language || p.lang || 'vf').toLowerCase() === 'vostfr' ? 'vostfr' : 'vf';
    const langUpper = lang.toUpperCase();

    let srcUrl = p.src.trim();
    if (srcUrl.includes('/api/uqload/v/')) {
      const rawPart = srcUrl.split('/api/uqload/v/')[1]?.split(/[?#]/)[0] || '';
      const decoded = rawPart ? decodeBase64Utf8(rawPart) : null;
      const match = decoded?.match(/https?:\/\/[^"'\s\\<>]+/);
      if (!match) continue;
      srcUrl = match[0];
    }

    if (!/^https?:\/\//i.test(srcUrl)) continue;
    if (seen.has(`${lang}:${srcUrl}`)) continue;
    seen.add(`${lang}:${srcUrl}`);

    const isBlink =
      p.type === 'blink' ||
      srcUrl.includes('/api/blink/') ||
      srcUrl.includes('zen-blk.store') ||
      /\.mp4($|\?)/i.test(srcUrl);

    if (isBlink) {
      const directProxyUrl = await createDirectMediaProxyUrl(srcUrl, { Referer: 'https://miaw.tv/' });
      if (!directProxyUrl) continue;
      const proxiedEmbed = await createProxiedVideoEmbedUrl(
        srcUrl,
        { Referer: 'https://miaw.tv/' },
        `Miaw Direct 1080p (${langUpper})`,
        directProxyUrl
      );
      const entry = {
        name: `Miaw Direct 1080p (${langUpper})`,
        url: proxiedEmbed || directProxyUrl,
        directUrl: directProxyUrl,
        rawUrl: srcUrl,
        hoster: 'blink',
        language: lang,
        type: 'miaw',
        quality: '1080p FHD',
      };
      if (lang === 'vostfr') vostfr.push(entry);
      else vf.push(entry);
      continue;
    }

    const { namePrefix, hoster } = classifyMiawEmbed(srcUrl, p.choiceKey, p.type);
    const entry = {
      name: `${namePrefix} (${langUpper})`,
      url: srcUrl,
      hoster,
      language: lang,
      type: 'miaw',
    };
    if (lang === 'vostfr') vostfr.push(entry);
    else vf.push(entry);
  }
  return { vf, vostfr };
}

async function handleMiawMovie(tmdbId: string): Promise<any> {
  const cacheKey = `miaw:movie:${tmdbId}`;
  const cached = getCached(cacheKey);
  if (cached) return cached;

  const redirectPage = await fetchMiawPage(`https://miaw.tv/movie/${tmdbId}`);
  const m =
    redirectPage.finalUrl.match(/\/film\/([a-z0-9-]+)/i) ||
    redirectPage.html.match(/miaw\.tv\/film\/([a-z0-9-]+)/i) ||
    redirectPage.html.match(/\/film\/([a-z0-9-]+)/i);

  let slug = m ? m[1] : null;
  if (!slug) {
    const info = await fetchTmdbInfo(tmdbId, 'movie');
    if (info?.title) slug = slugifyMiaw(info.title);
  }
  if (!slug) return { success: false, error: 'Film introuvable sur Miaw' };

  const watchPage = await fetchMiawPage(`https://miaw.tv/film/${slug}/regarder`);
  const rawPlayers = extractMiawPlayersArray(watchPage.html || redirectPage.html);
  const players = await formatMiawPlayers(rawPlayers);

  if (players.vf.length === 0 && players.vostfr.length === 0) {
    return { success: false, error: 'Aucun lecteur Miaw disponible' };
  }

  const result = {
    success: true,
    source: 'miaw',
    tmdbId: Number(tmdbId),
    slug,
    players,
    embedUrl: players.vf[0]?.url || players.vostfr[0]?.url,
  };
  setCached(cacheKey, result);
  return result;
}

async function handleMiawSeriesOrAnime(
  kind: 'series' | 'anime',
  tmdbId: string,
  season: string | number,
  episode: string | number,
  queryTitle?: string
): Promise<any> {
  const cacheKey = `miaw:${kind}:${tmdbId}:${season}:${episode}`;
  const cached = getCached(cacheKey);
  if (cached) return cached;

  const [info, ...redirs] = await Promise.all([
    fetchTmdbInfo(tmdbId, 'tv'),
    ...['series', 'anime'].map((endpoint) =>
      fetchMiawPage(`https://miaw.tv/${endpoint}/${tmdbId}`).catch(() => ({ html: '', finalUrl: '' }))
    ),
  ]);
  const discoveredSlugs: string[] = [];
  for (const redir of redirs) {
    const sm =
      redir.finalUrl.match(/miaw\.tv\/(?:series|serie|anime)\/([a-z0-9-]+)/i) ||
      redir.html.match(/miaw\.tv\/(?:series|serie|anime)\/([a-z0-9-]+)/i);
    if (sm && sm[1]) discoveredSlugs.push(sm[1]);
  }

  const candidateTitles = [queryTitle, info?.title, info?.originalTitle].filter(Boolean) as string[];
  const slugs = Array.from(new Set([...discoveredSlugs, ...candidateTitles.map(slugifyMiaw).filter(Boolean)])).slice(0, 3);

  const prefixes = kind === 'anime' ? ['anime', 'series'] : ['series', 'anime'];

  // Essais en parallèle (le premier qui renvoie des lecteurs gagne)
  const attempts: Array<Promise<any>> = [];
  for (const prefix of prefixes) {
    for (const slug of slugs) {
      attempts.push(
        (async () => {
          const page = await fetchMiawPage(`https://miaw.tv/${prefix}/${slug}/episode/${episode}/saison/${season}`);
          const rawPlayers = extractMiawPlayersArray(page.html);
          if (rawPlayers.length === 0) throw new Error('none');
          const players = await formatMiawPlayers(rawPlayers);
          if (players.vf.length === 0 && players.vostfr.length === 0) throw new Error('none');
          return { slug, players };
        })()
      );
    }
  }

  try {
    const { slug, players } = await (Promise as any).any(attempts);
    const result = {
      success: true,
      source: 'miaw',
      tmdbId: Number(tmdbId),
      season: Number(season),
      episode: Number(episode),
      slug,
      players,
      embedUrl: players.vf[0]?.url || players.vostfr[0]?.url,
    };
    setCached(cacheKey, result);
    return result;
  } catch {}

  return { success: false, error: 'Aucun lecteur Miaw trouvé' };
}

// ─── 3. MOVIEZ (api.moviez.ac) ──────────────────────────────────────────────
async function checkMoviezEmbed(url: string): Promise<boolean> {
  try {
    const r = await gmRequest({
      url,
      headers: { Referer: 'https://moviez.ac/' },
      timeout: 5500,
    });
    return r.status === 200 && r.responseText.includes('window.P2');
  } catch {
    return false;
  }
}

async function handleMoviezMovie(tmdbId: string): Promise<any> {
  const cacheKey = `moviez:movie:${tmdbId}`;
  const cached = getCached(cacheKey);
  if (cached) return cached;

  const vfUrl = `https://api.moviez.ac/${tmdbId}?lang=vf&autoplay=1`;
  const vostfrUrl = `https://api.moviez.ac/${tmdbId}?lang=vostfr&autoplay=1`;
  const [hasVf, hasVostfr] = await Promise.all([checkMoviezEmbed(vfUrl), checkMoviezEmbed(vostfrUrl)]);

  if (!hasVf && !hasVostfr) {
    return { success: false, error: 'Aucun lecteur Moviez disponible' };
  }

  const players = {
    vf: hasVf ? [{ name: 'Moviez (VF)', url: vfUrl, hoster: 'moviez', language: 'vf', type: 'moviez' }] : [],
    vostfr: hasVostfr
      ? [{ name: 'Moviez (VOSTFR)', url: vostfrUrl, hoster: 'moviez', language: 'vostfr', type: 'moviez' }]
      : [],
  };

  const result = {
    success: true,
    source: 'moviez',
    tmdbId: Number(tmdbId),
    players,
    embedUrl: hasVf ? vfUrl : vostfrUrl,
  };
  setCached(cacheKey, result);
  return result;
}

async function handleMoviezTv(tmdbId: string, season: string | number, episode: string | number): Promise<any> {
  const cacheKey = `moviez:tv:${tmdbId}:${season}:${episode}`;
  const cached = getCached(cacheKey);
  if (cached) return cached;

  const vfUrl = `https://api.moviez.ac/serie/${tmdbId}/${season}/${episode}?lang=vf&autoplay=1`;
  const vostfrUrl = `https://api.moviez.ac/serie/${tmdbId}/${season}/${episode}?lang=vostfr&autoplay=1`;
  const [hasVf, hasVostfr] = await Promise.all([checkMoviezEmbed(vfUrl), checkMoviezEmbed(vostfrUrl)]);

  if (!hasVf && !hasVostfr) {
    return { success: false, error: 'Aucun lecteur Moviez disponible' };
  }

  const players = {
    vf: hasVf ? [{ name: 'Moviez (VF)', url: vfUrl, hoster: 'moviez', language: 'vf', type: 'moviez' }] : [],
    vostfr: hasVostfr
      ? [{ name: 'Moviez (VOSTFR)', url: vostfrUrl, hoster: 'moviez', language: 'vostfr', type: 'moviez' }]
      : [],
  };

  const result = {
    success: true,
    source: 'moviez',
    tmdbId: Number(tmdbId),
    season: Number(season),
    episode: Number(episode),
    players,
    embedUrl: hasVf ? vfUrl : vostfrUrl,
  };
  setCached(cacheKey, result);
  return result;
}

// ─── 4. VIDZY & FSTREAM (french-stream.ac AJAX + vidzy.org direct) ──────────
const FS_DOMAINS = ['https://french-stream.my', 'https://french-stream.net', 'https://french-stream.cv'];

function decodeHtmlEntitiesMinimal(str: string): string {
  return str
    .replace(/&quot;/g, '"')
    .replace(/&#039;|&apos;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/\\\//g, '/');
}

async function searchFrenchStreamAjax(query: string): Promise<{ baseUrl: string; items: Array<{ newsid: string; title: string }> }> {
  for (const baseUrl of FS_DOMAINS) {
    try {
      const r = await gmRequest({
        url: `${baseUrl}/engine/ajax/search.php`,
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
          'X-Requested-With': 'XMLHttpRequest',
          Referer: `${baseUrl}/`,
          Origin: baseUrl,
        },
        data: `query=${encodeURIComponent(query)}&page=1`,
        timeout: 6500,
      });
      if (r.status === 200 && r.responseText && r.responseText.includes('search-item')) {
        const items: Array<{ newsid: string; title: string }> = [];
        const seenIds = new Set<string>();
        const pushItem = (newsid: string, title: string) => {
          const cleanTitle = title.trim();
          if (!newsid || !cleanTitle || seenIds.has(newsid)) return;
          seenIds.add(newsid);
          items.push({ newsid, title: cleanTitle });
        };

        // 1. Films / items simples avec showFilmModal('newsid')
        const movieRe = /onclick=["']showFilmModal\(['"](\d+)['"]\)["'][\s\S]*?<div\s+class=["']search-title["']>([^<]+)<\/div>/g;
        let m: RegExpExecArray | null;
        while ((m = movieRe.exec(r.responseText)) !== null) {
          pushItem(m[1], m[2]);
        }

        // 2. Séries avec onclick='showSeasons(this)' et data-seasons='[...]'
        const seriesRe = /<div\b[^>]*class=["'][^"']*search-series[^"']*["'][^>]*data-seasons=(['"])([\s\S]*?)\1[\s\S]*?<div\s+class=["']search-title["']>([^<]+)<\/div>/g;
        while ((m = seriesRe.exec(r.responseText)) !== null) {
          const rawSeasons = m[2];
          const baseTitle = m[3].replace(/\s*-\s*s[ée]rie\s*$/i, '').trim();
          try {
            const parsedSeasons = JSON.parse(decodeHtmlEntitiesMinimal(rawSeasons));
            if (Array.isArray(parsedSeasons)) {
              for (const s of parsedSeasons) {
                const pathStr = String(s?.l || '');
                const idMatch = pathStr.match(/\/?(\d+)(?:-|\.html|$)/);
                const seasonNum = s?.n != null ? s.n : '';
                if (idMatch?.[1]) {
                  pushItem(idMatch[1], `${baseTitle}${seasonNum !== '' ? ` - Saison ${seasonNum}` : ''}`);
                }
              }
            }
          } catch {}
        }

        if (items.length > 0) return { baseUrl, items };
      }
    } catch {}
  }
  return { baseUrl: FS_DOMAINS[0], items: [] };
}

function pickFsMovieMatch(results: Array<{ newsid: string; title: string }>, normTitle: string) {
  const movies = results.filter((r) => !/saison\s*\d+/i.test(r.title));
  const pool = movies.length ? movies : results;
  return (
    pool.find((r) => normalizeStr(r.title) === normTitle) ||
    pool.find((r) => normalizeStr(r.title).startsWith(normTitle)) ||
    pool.find((r) => normTitle.startsWith(normalizeStr(r.title))) ||
    pool[0]
  );
}

function pickFsSeasonMatch(results: Array<{ newsid: string; title: string }>, normTitle: string, season: string | number) {
  const seasonRe = new RegExp(`\\bsaison\\s*${season}\\b`, 'i');
  const words = normTitle.split(' ').filter((w) => w.length > 2);
  return (
    results.find((r) => seasonRe.test(normalizeStr(r.title)) && words.every((w) => normalizeStr(r.title).includes(w))) ||
    results.find((r) => seasonRe.test(normalizeStr(r.title)) && words.slice(0, 2).every((w) => normalizeStr(r.title).includes(w))) ||
    results.find((r) => seasonRe.test(normalizeStr(r.title))) ||
    results[0]
  );
}

async function checkVidzyDirect(url: string): Promise<boolean> {
  try {
    const r = await gmRequest({
      url,
      headers: { Referer: 'https://vidzy.org/' },
      timeout: 5500,
    });
    const html = r.responseText || '';
    return r.status === 200 && html.length > 500 && (html.includes('embed-') || html.includes('iframe') || html.includes('player'));
  } catch {
    return false;
  }
}

async function handleVidzyMovie(tmdbId: string): Promise<any> {
  const cacheKey = `vidzy:movie:${tmdbId}`;
  const cached = getCached(cacheKey);
  if (cached) return cached;

  const directVf = `https://vidzy.org/movie/${tmdbId}/vf`;
  const directVostfr = `https://vidzy.org/movie/${tmdbId}/vostfr`;
  const [hasVf, hasVostfr] = await Promise.all([checkVidzyDirect(directVf), checkVidzyDirect(directVostfr)]);

  if (hasVf || hasVostfr) {
    const players = {
      vf: hasVf ? [{ name: 'Vidzy (VF)', url: directVf, hoster: 'vidzy', language: 'vf', type: 'vidzy' }] : [],
      vostfr: hasVostfr ? [{ name: 'Vidzy (VOSTFR)', url: directVostfr, hoster: 'vidzy', language: 'vostfr', type: 'vidzy' }] : [],
    };
    const result = {
      success: true,
      source: 'vidzy',
      tmdbId: Number(tmdbId),
      players,
      embedUrl: hasVf ? directVf : directVostfr,
    };
    setCached(cacheKey, result);
    return result;
  }

  // Fallback FrenchStream film_api.php
  const fstreamData = await handleFstreamMovie(tmdbId);
  if (fstreamData?.success && fstreamData?.players) {
    const allPlayers = [
      ...(fstreamData.players.VFF || []),
      ...(fstreamData.players.VFQ || []),
      ...(fstreamData.players.Default || []),
    ];
    const vidzyPlayer = allPlayers.find((p: any) => String(p.url || '').toLowerCase().includes('vidzy'));
    if (vidzyPlayer) {
      const result = {
        success: true,
        source: 'vidzy',
        tmdbId: Number(tmdbId),
        embedUrl: vidzyPlayer.url,
        players: {
          vf: [{ name: 'Vidzy (VF)', url: vidzyPlayer.url, hoster: 'vidzy', language: 'vf', type: 'vidzy' }],
          vostfr: [],
        },
      };
      setCached(cacheKey, result);
      return result;
    }
  }

  return { success: false, error: 'Aucun lecteur Vidzy trouvé' };
}

async function handleVidzyTv(tmdbId: string, season: string | number, episode: string | number): Promise<any> {
  const cacheKey = `vidzy:tv:${tmdbId}:${season}:${episode}`;
  const cached = getCached(cacheKey);
  if (cached) return cached;

  const directVf = `https://vidzy.org/serie/${tmdbId}/${season}/${episode}/vf`;
  const directVostfr = `https://vidzy.org/serie/${tmdbId}/${season}/${episode}/vostfr`;
  const [hasVf, hasVostfr] = await Promise.all([checkVidzyDirect(directVf), checkVidzyDirect(directVostfr)]);

  if (hasVf || hasVostfr) {
    const players = {
      vf: hasVf ? [{ name: 'Vidzy (VF)', url: directVf, hoster: 'vidzy', language: 'vf', type: 'vidzy' }] : [],
      vostfr: hasVostfr ? [{ name: 'Vidzy (VOSTFR)', url: directVostfr, hoster: 'vidzy', language: 'vostfr', type: 'vidzy' }] : [],
    };
    const result = {
      success: true,
      source: 'vidzy',
      tmdbId: Number(tmdbId),
      season: Number(season),
      episode: Number(episode),
      players,
      embedUrl: hasVf ? directVf : directVostfr,
    };
    setCached(cacheKey, result);
    return result;
  }

  const fstreamData = await handleFstreamTv(tmdbId, season);
  const epObj = fstreamData?.episodes?.[Number(episode)] || fstreamData?.episodes?.[String(episode)];
  if (epObj?.languages) {
    const vfList = epObj.languages.VF || [];
    const vostfrList = epObj.languages.VOSTFR || [];
    const vidzyVf = vfList.find((p: any) => String(p.url || '').toLowerCase().includes('vidzy'));
    const vidzyVo = vostfrList.find((p: any) => String(p.url || '').toLowerCase().includes('vidzy'));
    if (vidzyVf || vidzyVo) {
      const result = {
        success: true,
        source: 'vidzy',
        tmdbId: Number(tmdbId),
        season: Number(season),
        episode: Number(episode),
        embedUrl: vidzyVf?.url || vidzyVo?.url,
        players: {
          vf: vidzyVf ? [{ name: 'Vidzy (VF)', url: vidzyVf.url, hoster: 'vidzy', language: 'vf', type: 'vidzy' }] : [],
          vostfr: vidzyVo ? [{ name: 'Vidzy (VOSTFR)', url: vidzyVo.url, hoster: 'vidzy', language: 'vostfr', type: 'vidzy' }] : [],
        },
      };
      setCached(cacheKey, result);
      return result;
    }
  }

  return { success: false, error: 'Aucun lecteur Vidzy trouvé' };
}

// ─── 5. FSTREAM COMPLET (Alimente Nexus HLS : Fsvid, Vidzy, Voe, Uqload) ────
async function handleFstreamMovie(tmdbId: string): Promise<any> {
  const cacheKey = `fstream:movie:${tmdbId}`;
  const cached = getCached(cacheKey);
  if (cached) return cached;

  const info = await fetchTmdbInfo(tmdbId, 'movie');
  if (!info?.title) return { success: false, error: 'Film introuvable sur TMDB' };

  let searchRes = await searchFrenchStreamAjax(info.title);
  if (searchRes.items.length === 0 && info.originalTitle && info.originalTitle !== info.title) {
    searchRes = await searchFrenchStreamAjax(info.originalTitle);
  }
  if (searchRes.items.length === 0) {
    return { success: false, error: 'Film introuvable sur FrenchStream' };
  }

  const match = pickFsMovieMatch(searchRes.items, normalizeStr(info.title));
  if (!match) return { success: false, error: 'Aucune correspondance FrenchStream' };

  try {
    const r = await gmRequest({
      url: `${searchRes.baseUrl}/engine/ajax/film_api.php?id=${match.newsid}`,
      headers: {
        Referer: `${searchRes.baseUrl}/`,
        Accept: 'application/json, text/plain, */*',
      },
      timeout: 7000,
    });
    if (r.status !== 200 || !r.responseText) return { success: false, error: 'Erreur film_api' };

    const data = JSON.parse(r.responseText);
    const organized: Record<string, any[]> = { VFQ: [], VFF: [], VOSTFR: [], Default: [] };
    const versionMap: Record<string, string> = {
      default: 'Default',
      vf: 'VFF',
      vfq: 'VFQ',
      vff: 'VFF',
      vostfr: 'VOSTFR',
    };

    let total = 0;
    if (data?.players && typeof data.players === 'object') {
      for (const [provider, versions] of Object.entries(data.players)) {
        if (!versions || typeof versions !== 'object') continue;
        let displayName = provider;
        if (provider === 'premium') displayName = 'Premium';
        else if (provider === 'vidzy') displayName = 'Vidzy';
        else if (provider === 'uqload') displayName = 'Uqload';
        else if (provider === 'voe') displayName = 'Voe';
        else displayName = provider.charAt(0).toUpperCase() + provider.slice(1);

        for (const [verKey, url] of Object.entries(versions as Record<string, string>)) {
          if (!url || typeof url !== 'string' || !url.startsWith('http')) continue;
          const cat = versionMap[verKey.toLowerCase()] || 'Default';
          organized[cat].push({
            url,
            type: 'embed',
            quality: 'HD',
            player: displayName,
          });
          total++;
        }
      }
    }

    if (total === 0) return { success: false, error: 'Aucun lecteur dans film_api' };

    const result = {
      success: true,
      source: 'FStream',
      type: 'movie',
      tmdb: info,
      players: organized,
      total,
    };
    setCached(cacheKey, result);
    return result;
  } catch (e: any) {
    return { success: false, error: e?.message || 'Erreur FStream' };
  }
}

async function handleFstreamTv(tmdbId: string, season: string | number): Promise<any> {
  const cacheKey = `fstream:tv:${tmdbId}:${season}`;
  const cached = getCached(cacheKey);
  if (cached) return cached;

  const info = await fetchTmdbInfo(tmdbId, 'tv');
  if (!info?.title) return { success: false, error: 'Série introuvable sur TMDB' };

  let searchRes = await searchFrenchStreamAjax(`${info.title} - Saison ${season}`);
  if (searchRes.items.length === 0) {
    searchRes = await searchFrenchStreamAjax(info.title);
  }
  if (searchRes.items.length === 0 && info.originalTitle && info.originalTitle !== info.title) {
    searchRes = await searchFrenchStreamAjax(info.originalTitle);
  }
  if (searchRes.items.length === 0) {
    return { success: false, error: 'Série introuvable sur FrenchStream' };
  }

  const match = pickFsSeasonMatch(searchRes.items, normalizeStr(info.title), season);
  if (!match) return { success: false, error: 'Saison introuvable sur FrenchStream' };

  try {
    const r = await gmRequest({
      url: `${searchRes.baseUrl}/engine/ajax/episodes_p.php?id=${match.newsid}`,
      headers: {
        Referer: `${searchRes.baseUrl}/`,
        Accept: 'application/json, text/plain, */*',
      },
      timeout: 7500,
    });
    if (r.status !== 200 || !r.responseText) return { success: false, error: 'Erreur episodes_p' };

    const data = JSON.parse(r.responseText);
    const episodes: Record<number, any> = {};
    const langMap: Record<string, string> = { vf: 'VF', vostfr: 'VOSTFR', vo: 'VOENG' };
    let total = 0;

    for (const [langKey, langLabel] of Object.entries(langMap)) {
      const langData = data?.[langKey];
      if (!langData || typeof langData !== 'object') continue;
      for (const [epNum, providers] of Object.entries(langData)) {
        const epNumber = parseInt(epNum, 10);
        if (isNaN(epNumber) || epNumber === 0 || !providers || typeof providers !== 'object') continue;
        if (!episodes[epNumber]) {
          episodes[epNumber] = {
            number: epNumber,
            title: `Épisode ${epNumber}`,
            languages: { VF: [], VOSTFR: [], VOENG: [], Default: [] },
          };
        }
        for (const [provider, url] of Object.entries(providers as Record<string, string>)) {
          if (!url || typeof url !== 'string' || !url.startsWith('http')) continue;
          let displayName = provider;
          if (provider === 'premium') displayName = 'Premium';
          else if (provider === 'vidzy') displayName = 'Vidzy';
          else if (provider === 'uqload') displayName = 'Uqload';
          else if (provider === 'voe') displayName = 'Voe';
          else displayName = provider.charAt(0).toUpperCase() + provider.slice(1);

          episodes[epNumber].languages[langLabel].push({
            url,
            type: 'embed',
            quality: 'HD',
            player: displayName,
          });
          total++;
        }
      }
    }

    const result = {
      success: total > 0,
      source: 'FStream',
      type: 'tv',
      tmdb: info,
      episodes,
      total,
    };
    setCached(cacheKey, result);
    return result;
  } catch (e: any) {
    return { success: false, error: e?.message || 'Erreur FStream TV' };
  }
}

// ─── 6. WIFLIX STANDALONE (Agrégation FStream + Moviez + Vidzy) ───────────────
async function aggregateMovieFallbackSources(tmdbId: string): Promise<{
  title: string;
  vf: Array<{ name: string; url: string }>;
  vostfr: Array<{ name: string; url: string }>;
}> {
  const [info, fs, mz, vz] = await Promise.all([
    fetchTmdbInfo(tmdbId, 'movie').catch(() => null),
    handleFstreamMovie(tmdbId).catch(() => null),
    handleMoviezMovie(tmdbId).catch(() => null),
    handleVidzyMovie(tmdbId).catch(() => null),
  ]);

  const vf: Array<{ name: string; url: string }> = [];
  const vostfr: Array<{ name: string; url: string }> = [];
  const seen = new Set<string>();

  const add = (lang: 'vf' | 'vostfr', label: string, url: string) => {
    if (!url || !url.startsWith('http') || url.toLowerCase().includes('fsvid') || seen.has(url)) return;
    seen.add(url);
    const domainMatch = url.match(/https?:\/\/(?:www\.)?([^/]+)/);
    const cleanName = label && !/^(lecteur|player)/i.test(label) ? label : (domainMatch ? domainMatch[1] : 'Serveur');
    if (lang === 'vostfr') vostfr.push({ name: cleanName, url });
    else vf.push({ name: cleanName, url });
  };

  if (fs?.success && fs.players) {
    for (const p of [...(fs.players.VFF || []), ...(fs.players.VFQ || []), ...(fs.players.Default || [])]) {
      add('vf', p.player || 'FStream VF', p.url);
    }
    for (const p of [...(fs.players.VOSTFR || []), ...(fs.players.VOENG || [])]) {
      add('vostfr', p.player || 'FStream VOSTFR', p.url);
    }
  }
  if (mz?.success && mz.players) {
    for (const p of mz.players.vf || []) add('vf', 'Moviez VF', p.url);
    for (const p of mz.players.vostfr || []) add('vostfr', 'Moviez VOSTFR', p.url);
  }
  if (vz?.success && vz.players) {
    for (const p of vz.players.vf || []) add('vf', 'Vidzy VF', p.url);
    for (const p of vz.players.vostfr || []) add('vostfr', 'Vidzy VOSTFR', p.url);
  }

  return { title: info?.title || '', vf, vostfr };
}

async function handleWiflixMovie(tmdbId: string): Promise<any> {
  const cacheKey = `wiflix:movie:${tmdbId}`;
  const cached = getCached(cacheKey);
  if (cached) return cached;

  const { title, vf, vostfr } = await aggregateMovieFallbackSources(tmdbId);
  if (vf.length > 0 || vostfr.length > 0) {
    const result = {
      success: true,
      tmdb_id: tmdbId,
      title,
      source: 'wiflix-standalone',
      players: {
        vf: vf.map((p) => ({ ...p, episode: 1, type: 'VF' })),
        vostfr: vostfr.map((p) => ({ ...p, episode: 1, type: 'VOSTFR' })),
      },
    };
    setCached(cacheKey, result);
    return result;
  }

  return { success: false, error: 'Aucun lecteur Wiflix trouvé' };
}

async function handleWiflixTv(tmdbId: string, season: string | number): Promise<any> {
  const cacheKey = `wiflix:tv:${tmdbId}:${season}`;
  const cached = getCached(cacheKey);
  if (cached) return cached;

  const info = await fetchTmdbInfo(tmdbId, 'tv').catch(() => null);

  // Agrégation autonome depuis FrenchStream TV pour alimenter Lynx/Wiflix TV, Multi, Omega, 1J1F et Viper
  try {
    const fsData = await handleFstreamTv(tmdbId, season);
    if (fsData && fsData.success && fsData.episodes) {
      const episodes: Record<string, { vf: any[]; vostfr: any[] }> = {};
      for (const [epKey, epVal] of Object.entries(fsData.episodes as Record<string, any>)) {
        const vfList: any[] = [];
        const vostfrList: any[] = [];
        const langs = epVal?.languages || {};
        for (const p of [...(langs.VF || []), ...(langs.Default || [])]) {
          if (p?.url && !String(p.url).toLowerCase().includes('fsvid')) {
            vfList.push({ name: p.player || 'Lecteur VF', url: p.url, episode: Number(epKey), type: 'VF' });
          }
        }
        for (const p of [...(langs.VOSTFR || []), ...(langs.VOENG || [])]) {
          if (p?.url && !String(p.url).toLowerCase().includes('fsvid')) {
            vostfrList.push({ name: p.player || 'Lecteur VOSTFR', url: p.url, episode: Number(epKey), type: 'VOSTFR' });
          }
        }
        if (vfList.length > 0 || vostfrList.length > 0) {
          episodes[String(epKey)] = { vf: vfList, vostfr: vostfrList };
        }
      }
      if (Object.keys(episodes).length > 0) {
        const result = {
          success: true,
          tmdb_id: tmdbId,
          season: Number(season),
          title: info?.title || '',
          source: 'cinestream-tv',
          episodes,
        };
        setCached(cacheKey, result);
        return result;
      }
    }
  } catch {}

  return { success: false, error: 'Aucun lecteur Wiflix TV trouvé' };
}

// ─── 6b. COFLIX / MULTI, OMEGA, 1J1F, VIPER (Agrégateur Autonome Mobile) ────
async function collectMovieFallbackPlayers(tmdbId: string): Promise<{ vf: Array<{ name: string; url: string }>; vostfr: Array<{ name: string; url: string }> }> {
  const { vf, vostfr } = await aggregateMovieFallbackSources(tmdbId);
  return { vf, vostfr };
}

async function handleCoflixMovie(tmdbId: string): Promise<any> {
  const { vf, vostfr } = await collectMovieFallbackPlayers(tmdbId);
  const player_links = [
    ...vf.map((p) => ({ name: `${p.name} (VF)`, decoded_url: p.url, url: p.url, language: 'VF', quality: 'HD' })),
    ...vostfr.map((p) => ({ name: `${p.name} (VOSTFR)`, decoded_url: p.url, url: p.url, language: 'VOSTFR', quality: 'HD' })),
  ];
  return { success: player_links.length > 0, player_links };
}

async function handleCoflixTv(tmdbId: string, season: string | number, episode: string | number): Promise<any> {
  const wf = await handleWiflixTv(tmdbId, season).catch(() => null);
  const epData = wf?.episodes?.[String(episode)] || { vf: [], vostfr: [] };
  const player_links = [
    ...(epData.vf || []).map((p: any) => ({ name: `${p.name} (VF)`, decoded_url: p.url, url: p.url, language: 'VF', quality: 'HD' })),
    ...(epData.vostfr || []).map((p: any) => ({ name: `${p.name} (VOSTFR)`, decoded_url: p.url, url: p.url, language: 'VOSTFR', quality: 'HD' })),
  ];
  return {
    success: player_links.length > 0,
    player_links,
    current_episode: { player_links },
  };
}

async function handleJ1fMovie(tmdbId: string): Promise<any> {
  const players = await collectMovieFallbackPlayers(tmdbId);
  return {
    success: players.vf.length > 0 || players.vostfr.length > 0,
    players,
  };
}

async function handleJ1fTv(tmdbId: string, season: string | number): Promise<any> {
  return handleWiflixTv(tmdbId, season);
}

async function handleViperMovie(tmdbId: string): Promise<any> {
  const { vf, vostfr } = await collectMovieFallbackPlayers(tmdbId);
  return {
    success: vf.length > 0 || vostfr.length > 0,
    links: {
      vf: vf.map((p) => ({ server: p.name, url: p.url })),
      vostfr: vostfr.map((p) => ({ server: p.name, url: p.url })),
    },
  };
}

async function handleViperTv(tmdbId: string, season: string | number, episode: string | number): Promise<any> {
  const wf = await handleWiflixTv(tmdbId, season).catch(() => null);
  const epData = wf?.episodes?.[String(episode)] || { vf: [], vostfr: [] };
  return {
    success: (epData.vf?.length || 0) > 0 || (epData.vostfr?.length || 0) > 0,
    links: {
      vf: (epData.vf || []).map((p: any) => ({ server: p.name, url: p.url })),
      vostfr: (epData.vostfr || []).map((p: any) => ({ server: p.name, url: p.url })),
    },
  };
}

// ─── 7. FREMBED & FRANIME ───────────────────────────────────────────────────
const FREMBED_BASE = 'https://frembed.uno';
const FREMBED_BLOCKED_HOSTS = ['playmogo.com', 'streamtales.cc', 'fsvid'];

async function resolveFrembedStreamUrl(candidatePath: string): Promise<string | null> {
  try {
    let current = candidatePath.startsWith('http') ? candidatePath : `${FREMBED_BASE}${candidatePath}`;
    let alreadyVerifiedDestination = false;
    for (let hop = 0; hop < 2; hop++) {
      const r = await gmRequest({
        url: current,
        headers: { Referer: `${FREMBED_BASE}/` },
        redirect: 'manual',
        timeout: 3800,
      }).catch(() => null);
      if (!r) return null;
      const locMatch = r.responseHeaders?.match(/^location:\s*(.+)$/im);
      const next = locMatch ? locMatch[1].trim() : null;
      if (r.status >= 300 && r.status < 400 && next) {
        current = next.startsWith('http') ? next : new URL(next, current).toString();
        continue;
      }
      if (r.status >= 400 || r.status === 0) return null;
      if (r.finalUrl && r.finalUrl !== current) {
        current = r.finalUrl;
        alreadyVerifiedDestination = r.status >= 200 && r.status < 400;
      }
      break;
    }
    const lower = current.toLowerCase();
    // Un /api/stream non redirigé renvoie HTTP 403 dans une <iframe> sans Referer frembed.uno
    if (lower.includes('/api/stream')) return null;
    if (FREMBED_BLOCKED_HOSTS.some((b) => lower.includes(b))) return null;
    if (!alreadyVerifiedDestination) {
      const check = await gmRequest({
        url: current,
        headers: { Referer: `${FREMBED_BASE}/` },
        timeout: 3500,
      }).catch(() => null);
      if (!check || check.status >= 400 || check.status === 0) return null;
    }
    return current;
  } catch {
    return null;
  }
}

async function resolveFrembedEndpoint(apiUrl: string, fallbackEmbedUrl: string, cacheKey: string): Promise<any> {
  const cached = getCached(cacheKey);
  if (cached) return cached;

  try {
    const resp = await gmRequest({
      url: apiUrl,
      headers: { Referer: `${FREMBED_BASE}/`, Accept: 'application/json' },
      timeout: 4000,
    });
    if (resp.status === 200 && resp.responseText) {
      const json = JSON.parse(resp.responseText);
      const candidates: Array<{ label: string; lang: string; path: string }> = [];
      if (Array.isArray(json?.links)) {
        for (const item of json.links) {
          if (item?.url) {
            candidates.push({
              label: item.label || item.host?.name || 'Serveur',
              lang: String(item.lang || 'vf').toLowerCase(),
              path: item.url,
            });
          }
        }
      }
      for (const k of ['link1', 'link2', 'link3', 'link4', 'link5', 'link6', 'link7', 'link1vostfr', 'link2vostfr', 'link3vostfr']) {
        const v = json?.[k];
        if (typeof v === 'string' && v) {
          candidates.push({
            label: k,
            lang: k.includes('vostfr') ? 'vostfr' : 'vf',
            path: v,
          });
        }
      }

      const resolved = await Promise.all(
        candidates.slice(0, 8).map(async (c) => {
          const url = await resolveFrembedStreamUrl(c.path);
          return url ? { label: c.label, lang: c.lang, url } : null;
        })
      );
      const servers = resolved.filter(Boolean) as Array<{ label: string; lang: string; url: string }>;
      const uniqueServers: Array<{ label: string; lang: string; url: string }> = [];
      const seenUrl = new Set<string>();
      for (const srv of servers) {
        if (seenUrl.has(srv.url)) continue;
        seenUrl.add(srv.url);
        uniqueServers.push(srv);
      }

      if (uniqueServers.length > 0) {
        const vfBest = uniqueServers.find((srv) => srv.lang === 'vf') || uniqueServers[0];
        const out = { success: true, embedUrl: vfBest.url, fallbackEmbedUrl, servers: uniqueServers };
        setCached(cacheKey, out);
        return out;
      }
    }
  } catch {}

  return { success: false, embedUrl: fallbackEmbedUrl, fallbackEmbedUrl, servers: [] };
}

function handleFrembedMovie(tmdbId: string) {
  const fallback = `${FREMBED_BASE}/embed/movie/${tmdbId}`;
  return resolveFrembedEndpoint(`${FREMBED_BASE}/api/films?id=${tmdbId}&idType=tmdb`, fallback, `frembed:movie:${tmdbId}`);
}

function handleFrembedTv(tmdbId: string, sa?: string | null, epi?: string | null) {
  const qs = sa && epi ? `?sa=${sa}&epi=${epi}` : '';
  const fallback = `${FREMBED_BASE}/embed/serie/${tmdbId}${qs}`;
  const apiQs = sa && epi ? `&sa=${sa}&epi=${epi}` : '';
  return resolveFrembedEndpoint(`${FREMBED_BASE}/api/series?id=${tmdbId}&idType=tmdb${apiQs}`, fallback, `frembed:tv:${tmdbId}:${sa || ''}=${epi || ''}`);
}

// ─── Routeur Principal Mobile Standalone ────────────────────────────────────
export async function resolveStandaloneApiRoute(fullUrl: string): Promise<{ handled: boolean; status?: number; data?: any; rawText?: string; contentType?: string }> {
  let parsed: URL;
  try {
    parsed = new URL(fullUrl, typeof window !== 'undefined' ? window.location.origin : 'http://localhost');
  } catch {
    return { handled: false };
  }

  const pathname = parsed.pathname;
  const searchParams = parsed.searchParams;

  // Ne jamais intercepter TMDB ou AniCloud (déjà appelés en direct)
  if (
    parsed.hostname === 'api.themoviedb.org' ||
    parsed.hostname === 'anicloud.top' ||
    parsed.hostname.endsWith('.themoviedb.org')
  ) {
    return { handled: false };
  }

  const isMobile = isMobileAppEnvironment();
  if (!isMobile && !hasNativeBridge()) {
    return { handled: false };
  }

  await waitForNativeBridge(800);

  // 0. Relais universel `/proxy/<encodedUrl>` via gmRequest() (débloque Wavewatch, Rivestream VO/VOSTFR HLS, et les extracteurs M3U8)
  if (pathname.startsWith('/proxy/')) {
    try {
      const encodedPart = pathname.slice('/proxy/'.length);
      let targetUrl = decodeURIComponent(encodedPart);
      if (parsed.search && !encodedPart.includes('%3F')) {
        targetUrl += parsed.search;
      }
      const targetOrigin = new URL(targetUrl).origin;
      const r = await gmRequest({
        url: targetUrl,
        headers: {
          Referer: `${targetOrigin}/`,
          Origin: targetOrigin,
          Accept: '*/*',
        },
        timeout: 8000,
      });
      const bodyText = r.responseText || '';
      let parsedData: any = bodyText;
      let contentType = 'text/html; charset=utf-8';
      const trimmed = bodyText.trim();
      if ((trimmed.startsWith('{') && trimmed.endsWith('}')) || (trimmed.startsWith('[') && trimmed.endsWith(']'))) {
        try {
          parsedData = JSON.parse(trimmed);
          contentType = 'application/json; charset=utf-8';
        } catch {}
      }
      return {
        handled: true,
        status: r.status || 200,
        data: parsedData,
        rawText: bodyText,
        contentType,
      };
    } catch {
      return {
        handled: true,
        status: 502,
        data: { error: 'Proxy error' },
        rawText: '',
        contentType: 'text/plain',
      };
    }
  }

  // 1. Webflix
  let m = pathname.match(/\/api\/webflix\/movie\/(\d+)/);
  if (m) {
    const data = await handleWebflixMovie(m[1]);
    return { handled: true, status: 200, data };
  }
  m = pathname.match(/\/api\/webflix\/tv\/(\d+)\/season\/(\d+)\/episode\/(\d+)/);
  if (m) {
    const data = await handleWebflixTv(m[1], m[2], m[3]);
    return { handled: true, status: 200, data };
  }
  m = pathname.match(/\/api\/webflix\/tv\/(\d+)/);
  if (m) {
    const s = searchParams.get('season') || searchParams.get('s') || '1';
    const e = searchParams.get('episode') || searchParams.get('e') || '1';
    const data = await handleWebflixTv(m[1], s, e);
    return { handled: true, status: 200, data };
  }

  // 2. Miaw
  m = pathname.match(/\/api\/miaw\/movie\/(\d+)/);
  if (m) {
    const data = await handleMiawMovie(m[1]);
    return { handled: true, status: data.success ? 200 : 404, data };
  }
  m = pathname.match(/\/api\/miaw\/(tv|anime)\/(\d+)\/season\/(\d+)\/episode\/(\d+)/);
  if (m) {
    const kind = m[1] === 'anime' ? 'anime' : 'series';
    const data = await handleMiawSeriesOrAnime(kind, m[2], m[3], m[4], searchParams.get('title') || undefined);
    return { handled: true, status: data.success ? 200 : 404, data };
  }

  // 3. Moviez
  m = pathname.match(/\/api\/moviez\/movie\/(\d+)/);
  if (m) {
    const data = await handleMoviezMovie(m[1]);
    return { handled: true, status: data.success ? 200 : 404, data };
  }
  m = pathname.match(/\/api\/moviez\/tv\/(\d+)\/season\/(\d+)\/episode\/(\d+)/);
  if (m) {
    const data = await handleMoviezTv(m[1], m[2], m[3]);
    return { handled: true, status: data.success ? 200 : 404, data };
  }

  // 4. Vidzy
  m = pathname.match(/\/api\/vidzy\/movie\/(\d+)/);
  if (m) {
    const data = await handleVidzyMovie(m[1]);
    return { handled: true, status: data.success ? 200 : 404, data };
  }
  m = pathname.match(/\/api\/vidzy\/tv\/(\d+)\/season\/(\d+)\/episode\/(\d+)/);
  if (m) {
    const data = await handleVidzyTv(m[1], m[2], m[3]);
    return { handled: true, status: data.success ? 200 : 404, data };
  }

  // 5. FStream
  m = pathname.match(/\/api\/fstream\/movie\/(\d+)/);
  if (m && !pathname.endsWith('/clear-cache')) {
    const data = await handleFstreamMovie(m[1]);
    return { handled: true, status: data.success ? 200 : 404, data };
  }
  m = pathname.match(/\/api\/fstream\/tv\/(\d+)\/season\/(\d+)/);
  if (m && !pathname.endsWith('/clear-cache')) {
    const data = await handleFstreamTv(m[1], m[2]);
    return { handled: true, status: data.success ? 200 : 404, data };
  }

  // 6. Wiflix / CineStream (Movie & TV)
  m = pathname.match(/\/api\/wiflix\/movie\/(\d+)/);
  if (m) {
    const data = await handleWiflixMovie(m[1]);
    return { handled: true, status: data.success ? 200 : 404, data };
  }
  m = pathname.match(/\/api\/wiflix\/tv\/(\d+)\/(\d+)/);
  if (m) {
    const data = await handleWiflixTv(m[1], m[2]);
    return { handled: true, status: data.success ? 200 : 404, data };
  }

  // 6b. Coflix / Multi, 1jour1film, Viper
  m = pathname.match(/\/api\/tmdb\/movie\/(\d+)/);
  if (m) {
    const data = await handleCoflixMovie(m[1]);
    return { handled: true, status: 200, data };
  }
  m = pathname.match(/\/api\/tmdb\/tv\/(\d+)/);
  if (m) {
    const s = searchParams.get('season') || '1';
    const e = searchParams.get('episode') || '1';
    const data = await handleCoflixTv(m[1], s, e);
    return { handled: true, status: 200, data };
  }
  m = pathname.match(/\/api\/j1f\/movie\/(\d+)/);
  if (m) {
    const data = await handleJ1fMovie(m[1]);
    return { handled: true, status: data.success ? 200 : 404, data };
  }
  m = pathname.match(/\/api\/j1f\/tv\/(\d+)\/season\/(\d+)/);
  if (m) {
    const data = await handleJ1fTv(m[1], m[2]);
    return { handled: true, status: data.success ? 200 : 404, data };
  }
  m = pathname.match(/\/api\/cpasmal\/movie\/(\d+)/);
  if (m) {
    const data = await handleViperMovie(m[1]);
    return { handled: true, status: data.success ? 200 : 404, data };
  }
  m = pathname.match(/\/api\/cpasmal\/tv\/(\d+)\/(\d+)\/(\d+)/);
  if (m) {
    const data = await handleViperTv(m[1], m[2], m[3]);
    return { handled: true, status: data.success ? 200 : 404, data };
  }

  // 7. Frembed
  m = pathname.match(/\/api\/frembed\/movie\/(\d+)/);
  if (m) {
    const data = await handleFrembedMovie(m[1]);
    return { handled: true, status: 200, data };
  }
  m = pathname.match(/\/api\/frembed\/tv\/(\d+)/);
  if (m) {
    const data = await handleFrembedTv(m[1], searchParams.get('sa'), searchParams.get('epi'));
    return { handled: true, status: 200, data };
  }

  // 8. Fail-fast instantané (0ms) sur les routes purement serveur PC quand on est dans l'APK mobile
  // afin de ne jamais bloquer le chargement pendant 5 à 8 secondes par route !
  if (isMobile) {
    if (
      pathname.startsWith('/api/darkiworld/') ||
      pathname.startsWith('/api/imdb/') ||
      pathname.startsWith('/api/links/') ||
      pathname.startsWith('/api/top10') ||
      pathname.startsWith('/api/wrapped') ||
      pathname.startsWith('/api/comments') ||
      pathname.startsWith('/api/likes') ||
      pathname.startsWith('/api/shared-lists') ||
      pathname.startsWith('/api/wishboard') ||
      pathname.startsWith('/api/download-links') ||
      pathname.startsWith('/api/sync')
    ) {
      return {
        handled: true,
        status: 200,
        data: { success: false, available: false, data: [], results: [], players: { vf: [], vostfr: [] } },
      };
    }
  }

  return { handled: false };
}

/**
 * Installe l'intercepteur autonome sur une instance Axios ainsi que sur `window.fetch`
 * (pour intercepter aussi les appels `fetch(`${MAIN_API}/proxy/...`)`).
 */
let fetchPatched = false;

export function installMobileStandaloneApi(axiosInstance: AxiosInstance): void {
  if (typeof window === 'undefined') return;

  // 1. Intercepteur Axios via custom adapter sur les routes autonomes
  axiosInstance.interceptors.request.use(async (config: InternalAxiosRequestConfig) => {
    if (!isMobileAppEnvironment() && !hasNativeBridge()) {
      return config;
    }

    const baseURL = config.baseURL || '';
    const rawUrl = config.url || '';
    let fullUrl = rawUrl.startsWith('http')
      ? rawUrl
      : `${baseURL.replace(/\/+$/, '')}/${rawUrl.replace(/^\/+/, '')}`;

    if (config.params && typeof config.params === 'object') {
      const sp = new URLSearchParams();
      for (const [k, v] of Object.entries(config.params)) {
        if (v !== undefined && v !== null) sp.append(k, String(v));
      }
      const qs = sp.toString();
      if (qs) fullUrl += (fullUrl.includes('?') ? '&' : '?') + qs;
    }

    const resolution = await resolveStandaloneApiRoute(fullUrl);
    if (resolution.handled) {
      config.adapter = async (): Promise<AxiosResponse> => ({
        data: resolution.data,
        status: resolution.status || 200,
        statusText: 'OK',
        headers: {},
        config,
      });
    }

    return config;
  });

  // 2. Patch `window.fetch` une seule fois pour supporter `/proxy/...` (HTML/texte brut pour Wavewatch & JSON pour Rivestream)
  if (!fetchPatched && typeof window.fetch === 'function') {
    fetchPatched = true;
    const originalFetch = window.fetch.bind(window);
    window.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
      try {
        const urlStr = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
        if (isMobileAppEnvironment()) {
          const res = await resolveStandaloneApiRoute(urlStr);
          if (res.handled) {
            if (typeof res.rawText === 'string') {
              return new Response(res.rawText, {
                status: res.status || 200,
                headers: { 'Content-Type': res.contentType || 'text/html; charset=utf-8' },
              });
            }
            return new Response(JSON.stringify(res.data ?? {}), {
              status: res.status || 200,
              headers: { 'Content-Type': 'application/json' },
            });
          }
        }
      } catch {}
      return originalFetch(input, init);
    };
  }
}
