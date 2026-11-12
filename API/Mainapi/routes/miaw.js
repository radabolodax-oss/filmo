/**
 * Miaw 1080p API route — Standalone high-definition ad-free streaming resolver & HLS/MP4 extractor.
 * Supports Movies, TV Series & Animes.
 * Source: https://miaw.tv
 * Mount point: app.use('/api/miaw', router)
 *
 *   GET /api/miaw/movie/:tmdbId
 *   GET /api/miaw/tv/:tmdbId?season=1&episode=1
 *   GET /api/miaw/tv/:tmdbId/season/:season/episode/:episode
 *   GET /api/miaw/anime/:tmdbId/season/:season/episode/:episode
 *   GET /api/miaw/miaw-video?url=...
 *   GET /api/miaw/miaw-embed?url=...
 */

const express = require('express');
const router = express.Router();
const axios = require('axios');
const https = require('https');
const { getAmbilightEmbedScript } = require('../utils/ambilightEmbedScript');

const MIAW_BASE = 'https://miaw.tv';
const CACHE_TTL_MS = 2 * 60 * 1000; // 2 minutes (tokens blink miaw.tv)
const CDN_CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes pour URL CDN (zen-blk.store)
const cache = new Map();
const resolvedCdnCache = new Map();

function getCached(key) {
  const item = cache.get(key);
  if (!item) return null;
  if (Date.now() - item.time > CACHE_TTL_MS) {
    cache.delete(key);
    return null;
  }
  return item.data;
}

function setCached(key, data) {
  if (cache.size > 2000) {
    const oldestKey = cache.keys().next().value;
    cache.delete(oldestKey);
  }
  cache.set(key, { data, time: Date.now() });
}

function getResolvedCdn(key) {
  if (!key) return null;
  const item = resolvedCdnCache.get(key);
  if (!item) return null;
  if (Date.now() - item.time > CDN_CACHE_TTL_MS) {
    resolvedCdnCache.delete(key);
    return null;
  }
  return item.cdnUrl;
}

function setResolvedCdn(key, cdnUrl) {
  if (!key || !cdnUrl) return;
  if (resolvedCdnCache.size > 2000) {
    const oldestKey = resolvedCdnCache.keys().next().value;
    resolvedCdnCache.delete(oldestKey);
  }
  resolvedCdnCache.set(key, { cdnUrl, time: Date.now() });
}

const miawClient = axios.create({
  timeout: 3500,
  headers: {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
    'Referer': `${MIAW_BASE}/`,
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
    'Accept-Language': 'fr-FR,fr;q=0.9,en-US;q=0.8,en;q=0.7',
  },
  maxRedirects: 5,
  validateStatus: () => true,
});

/**
 * Requête anti-DPI / anti-blocage FAI.
 * 1. Tente en direct.
 * 2. Si blocage FAI (ECONNRESET, timeout), bascule instantanément vers la passerelle relais.
 */
async function safeMiawGet(url) {
  // 1. Tente direct d'abord
  try {
    const directRes = await miawClient.get(url);
    if (directRes && directRes.status === 200 && typeof directRes.data === 'string' && directRes.data.length > 500) {
      return directRes;
    }
  } catch (_) {}

  // 2. Gateway Relais Anti-DPI (Jina AI) - contourne le TCP RST / SNI filtering des FAI français
  try {
    const relayUrl = `https://r.jina.ai/${url}`;
    const relayRes = await axios.get(relayUrl, {
      timeout: 9000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
        'X-Return-Format': 'html',
        'X-No-Cache': 'true',
      },
      validateStatus: () => true,
    });
    if (relayRes && relayRes.status === 200 && typeof relayRes.data === 'string' && relayRes.data.length > 100) {
      return relayRes;
    }
  } catch (_) {}

  // 3. Fallback secondaire via proxyManager si configuré
  try {
    const { makeRequestWithCorsFallback } = require('../utils/proxyManager');
    if (typeof makeRequestWithCorsFallback === 'function') {
      const resp = await makeRequestWithCorsFallback(url, { timeout: 6000 });
      if (resp && resp.status === 200 && typeof resp.data === 'string') {
        return resp;
      }
    }
  } catch (_) {}

  throw new Error(`Échec de connexion vers Miaw pour ${url}`);
}

function slugifyMiaw(title) {
  if (!title) return '';
  return title
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/['’]/g, '-')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function getBaseApiUrl(req) {
  const proto = req.headers['x-forwarded-proto'] || req.protocol || 'http';
  const host = req.headers['x-forwarded-host'] || req.get('host') || 'localhost:25565';
  return `${proto}://${host}`;
}

/**
 * Extrait le tableau `players` depuis une page `/regarder` ou `/episode/...` de miaw.tv
 */
function parseMiawPlayersFromHtml(html, baseApiUrl, meta = {}) {
  const out = { vf: [], vostfr: [] };
  if (!html || typeof html !== 'string') return out;

  let marker = '\\"players\\":[';
  let isEscaped = true;
  let idx = html.indexOf(marker);
  if (idx === -1) {
    marker = '"players":[';
    isEscaped = false;
    idx = html.indexOf(marker);
  }
  if (idx === -1) return out;

  const arrayStart = idx + marker.length - 1;
  let depth = 0;
  let endIdx = -1;
  for (let i = arrayStart; i < html.length; i++) {
    const ch = html[i];
    if (ch === '[') depth++;
    else if (ch === ']') {
      depth--;
      if (depth === 0) {
        endIdx = i + 1;
        break;
      }
    }
  }
  if (endIdx === -1) return out;

  try {
    const raw = html.slice(arrayStart, endIdx);
    const jsonStr = isEscaped ? raw.replace(/\\"/g, '"').replace(/\\\\/g, '\\') : raw;
    const players = JSON.parse(jsonStr);
    if (!Array.isArray(players)) return out;

    for (const p of players) {
      if (!p || !p.src) continue;
      const lang = (p.language || 'vf').toLowerCase() === 'vostfr' ? 'vostfr' : 'vf';
      const langUpper = lang.toUpperCase();

      if (p.type === 'blink' && p.src.startsWith('https://')) {
        // Ignorer les dummy redirects telegram
        if (p.src.includes('t.me') || p.src.includes('telegram')) continue;

        const params = new URLSearchParams();
        params.set('url', p.src);
        params.set('lang', lang);
        if (meta.kind) params.set('kind', meta.kind);
        if (meta.tmdbId) params.set('tmdbId', String(meta.tmdbId));
        if (meta.season) params.set('season', String(meta.season));
        if (meta.episode) params.set('episode', String(meta.episode));
        if (meta.title) params.set('title', String(meta.title));

        const embedUrl = `${baseApiUrl}/api/miaw/miaw-embed?${params.toString()}`;
        const directProxyUrl = `${baseApiUrl}/api/miaw/miaw-video?${params.toString()}`;
        out[lang].push({
          name: `Miaw Direct 1080p (${langUpper})`,
          url: embedUrl,
          directUrl: directProxyUrl,
          rawUrl: p.src,
          hoster: 'blink',
          language: lang,
          type: 'miaw',
          quality: '1080p FHD',
        });
      } else if (p.choiceKey === 'source:sharecloudy' && p.src.startsWith('https://')) {
        out[lang].push({
          name: `Miaw ShareCloudy (${langUpper})`,
          url: p.src,
          hoster: 'sharecloudy',
          language: lang,
          type: 'miaw',
        });
      } else if (p.type === 'vidzy' && p.src && p.src.startsWith('https://vidzy.org/')) {
        out[lang].push({
          name: `Miaw Vidzy (${langUpper})`,
          url: p.src,
          hoster: 'vidzy',
          language: lang,
          type: 'iframe',
        });
      } else if (p.src && p.src.includes('/api/uqload/v/')) {
        try {
          const rawPart = p.src.split('/api/uqload/v/')[1]?.split(/[?#]/)[0];
          if (rawPart) {
            const decoded = Buffer.from(rawPart, 'base64').toString('utf8');
            const match = decoded.match(/https?:\/\/[^"'\s\\<>]+/);
            if (match) {
              out[lang].push({
                name: `Miaw Uqload (${langUpper})`,
                url: match[0],
                hoster: 'uqload',
                language: lang,
                type: 'iframe',
              });
            }
          }
        } catch (_) {}
      } else if (typeof p.src === 'string' && p.src.startsWith('http') && !p.src.includes('t.me') && !p.src.includes('telegram')) {
        let hostLabel = 'Embed';
        let hosterKey = p.type || 'embed';
        try {
          const h = new URL(p.src).hostname.replace(/^www\./i, '');
          if (h.includes('moviez')) { hostLabel = 'Moviez'; hosterKey = 'moviez'; }
          else if (h.includes('sharecloudy')) { hostLabel = 'ShareCloudy'; hosterKey = 'sharecloudy'; }
          else if (h.includes('uqload')) { hostLabel = 'Uqload'; hosterKey = 'uqload'; }
          else if (h.includes('vidzy')) { hostLabel = 'Vidzy'; hosterKey = 'vidzy'; }
          else if (h) {
            const short = h.split('.')[0];
            hostLabel = short ? short.charAt(0).toUpperCase() + short.slice(1) : h;
            hosterKey = short || hosterKey;
          }
        } catch (_) {}
        out[lang].push({
          name: `Miaw ${hostLabel} (${langUpper})`,
          url: p.src,
          hoster: hosterKey,
          language: lang,
          type: 'iframe',
        });
      }
    }
  } catch (err) {
    console.error('[parseMiawPlayersFromHtml] Parse error:', err.message);
  }

  return out;
}

async function fetchMiawMoviePlayers(tmdbId, baseApiUrl, meta = {}) {
  try {
    let filmPath = null;
    let movieTitle = meta.title || '';

    // Résolution TMDB du titre si absent pour déduire le slug de secours
    if (!movieTitle && tmdbId) {
      try {
        const tmdbKey = process.env.TMDB_API_KEY || '15d2ea6d0dc1d476efbca3eba2b9bbfb';
        const tmdbResp = await axios.get(`https://api.themoviedb.org/3/movie/${tmdbId}?api_key=${tmdbKey}&language=fr-FR`, { timeout: 3500 });
        if (tmdbResp.data) {
          movieTitle = tmdbResp.data.title || tmdbResp.data.original_title || '';
        }
      } catch (_) {}
    }

    try {
      const resp = await safeMiawGet(`${MIAW_BASE}/movie/${tmdbId}`);
      if (resp && resp.status === 200 && typeof resp.data === 'string') {
        const canonMatch = resp.data.match(/rel="canonical"\s+href="https:\/\/miaw\.tv(\/film\/[^"]+)"/);
        filmPath = canonMatch ? canonMatch[1] : null;
        if (!filmPath) {
          const m = resp.data.match(/href="(\/film\/[a-z0-9-]+)"/);
          if (m) filmPath = m[1];
        }
      }
    } catch (_) {}

    // Fallback avec le slug du titre si pas trouvé via /movie/:tmdbId
    if (!filmPath && movieTitle) {
      filmPath = `/film/${slugifyMiaw(movieTitle)}`;
    }

    if (!filmPath) return { vf: [], vostfr: [] };

    const watchResp = await safeMiawGet(`${MIAW_BASE}${filmPath}/regarder`);
    if (watchResp.status !== 200 || typeof watchResp.data !== 'string') return { vf: [], vostfr: [] };

    return parseMiawPlayersFromHtml(watchResp.data, baseApiUrl, {
      ...meta,
      kind: 'movie',
      tmdbId,
      title: movieTitle,
    });
  } catch (_) {
    return { vf: [], vostfr: [] };
  }
}

async function fetchMiawTvOrAnimePlayers(seriesTitle, season, episode, baseApiUrl, meta = {}) {
  try {
    const slug = slugifyMiaw(seriesTitle);
    if (!slug) return { vf: [], vostfr: [] };

    // 1. Tente route standard /series/{slug}/episode/{e}/saison/{s}
    try {
      const watchUrl = `${MIAW_BASE}/series/${slug}/episode/${episode}/saison/${season}`;
      const watchResp = await safeMiawGet(watchUrl);
      if (watchResp && watchResp.status === 200 && typeof watchResp.data === 'string') {
        const players = parseMiawPlayersFromHtml(watchResp.data, baseApiUrl, {
          ...meta,
          kind: meta.kind || 'tv',
          title: seriesTitle,
          season,
          episode,
        });
        if (players.vf.length > 0 || players.vostfr.length > 0) return players;
      }
    } catch (_) {}

    // 2. Si non trouvé ou animé, tente route /anime/{slug}/...
    try {
      const animeWatchUrl = `${MIAW_BASE}/anime/${slug}/episode/${episode}/saison/${season}`;
      const animeResp = await safeMiawGet(animeWatchUrl);
      if (animeResp && animeResp.status === 200 && typeof animeResp.data === 'string') {
        const players = parseMiawPlayersFromHtml(animeResp.data, baseApiUrl, {
          ...meta,
          kind: 'anime',
          title: seriesTitle,
          season,
          episode,
        });
        if (players.vf.length > 0 || players.vostfr.length > 0) return players;
      }
    } catch (_) {}

    return { vf: [], vostfr: [] };
  } catch (_) {
    return { vf: [], vostfr: [] };
  }
}

/**
 * Résout un lien direct ou `https://miaw.tv/api/blink/v/...` en son URL CDN finale (`https://cdn*.zen-blk.store/...`)
 */
function resolveBlinkRedirectOnce(blinkUrl) {
  if (!blinkUrl || typeof blinkUrl !== 'string') return Promise.resolve(null);

  // Si l'URL pointe déjà directement vers le CDN zen-blk.store ou un MP4
  if (blinkUrl.includes('zen-blk.store') || blinkUrl.endsWith('.mp4')) {
    return Promise.resolve(blinkUrl);
  }

  return new Promise((resolve) => {
    try {
      const parsed = new URL(blinkUrl);
      const req = https.get(parsed.toString(), {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
          'Referer': `${MIAW_BASE}/`,
          'Origin': MIAW_BASE,
          'Range': 'bytes=0-1',
        },
      }, (res) => {
        res.resume();
        const code = res.statusCode || 500;
        if ([301, 302, 303, 307, 308].includes(code) && res.headers.location) {
          const nextUrl = new URL(res.headers.location, parsed).toString();
          resolve(nextUrl);
        } else {
          resolve(null);
        }
      });
      req.on('error', () => resolve(null));
      req.setTimeout(5000, () => {
        req.destroy();
        resolve(null);
      });
    } catch {
      resolve(null);
    }
  });
}

function buildCdnCacheKey(query) {
  const kind = query.kind || 'movie';
  const lang = (query.lang || 'vf').toLowerCase();
  if (kind === 'movie' && query.tmdbId) {
    return `cdn:movie:${query.tmdbId}:${lang}`;
  }
  if ((kind === 'tv' || kind === 'anime') && (query.title || query.tmdbId) && query.season && query.episode) {
    return `cdn:${kind}:${slugifyMiaw(query.title || query.tmdbId)}:${query.season}:${query.episode}:${lang}`;
  }
  return null;
}

async function resolveOrRefreshMiawCdnUrl(req) {
  const targetUrl = req.query.url;
  if (!targetUrl || !targetUrl.startsWith('https://')) return null;

  const cacheKey = buildCdnCacheKey(req.query);
  const cachedCdn = cacheKey ? getResolvedCdn(cacheKey) : null;
  if (cachedCdn) return cachedCdn;

  const cdnUrl = await resolveBlinkRedirectOnce(targetUrl);
  if (cdnUrl) {
    if (cacheKey) setResolvedCdn(cacheKey, cdnUrl);
    return cdnUrl;
  }

  // Si le token blink a expiré, rafraîchit automatiquement depuis miaw.tv
  try {
    const baseApiUrl = getBaseApiUrl(req);
    const lang = (req.query.lang || 'vf').toLowerCase();
    let freshPlayers = null;

    if (req.query.kind === 'movie' && req.query.tmdbId) {
      freshPlayers = await fetchMiawMoviePlayers(req.query.tmdbId, baseApiUrl, { title: req.query.title });
    } else if (req.query.title && req.query.season && req.query.episode) {
      freshPlayers = await fetchMiawTvOrAnimePlayers(req.query.title, req.query.season, req.query.episode, baseApiUrl, { kind: req.query.kind });
    }

    if (freshPlayers) {
      const candidate = (freshPlayers[lang] || []).find((p) => p.hoster === 'miaw' && p.rawUrl)
        || (freshPlayers.vf || []).find((p) => p.hoster === 'miaw' && p.rawUrl);
      if (candidate && candidate.rawUrl && candidate.rawUrl !== targetUrl) {
        const freshCdn = await resolveBlinkRedirectOnce(candidate.rawUrl);
        if (freshCdn) {
          if (cacheKey) setResolvedCdn(cacheKey, freshCdn);
          return freshCdn;
        }
      }
    }
  } catch (_) {}

  return null;
}

function proxyMiawVideoStream(targetUrl, req, res, redirectsLeft = 4, retriedRefresh = false) {
  let parsed;
  try {
    parsed = new URL(targetUrl);
  } catch {
    return res.status(400).send('Malformed URL');
  }

  const headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
    'Referer': `${MIAW_BASE}/`,
    ...(parsed.hostname.endsWith('miaw.tv') ? { 'Origin': MIAW_BASE } : {}),
  };
  if (req.headers.range) headers['Range'] = req.headers.range;

  const upstreamReq = https.get(parsed.toString(), { headers }, async (upstreamRes) => {
    const code = upstreamRes.statusCode || 200;

    if ([301, 302, 303, 307, 308].includes(code) && upstreamRes.headers.location && redirectsLeft > 0) {
      upstreamRes.resume();
      const nextUrl = new URL(upstreamRes.headers.location, parsed).toString();
      const cacheKey = buildCdnCacheKey(req.query);
      if (cacheKey && nextUrl.includes('zen-blk.store')) {
        setResolvedCdn(cacheKey, nextUrl);
      }
      return proxyMiawVideoStream(nextUrl, req, res, redirectsLeft - 1, retriedRefresh);
    }

    if ((code === 401 || code === 403 || code === 404 || code === 410) && !retriedRefresh) {
      upstreamRes.resume();
      const cacheKey = buildCdnCacheKey(req.query);
      if (cacheKey) resolvedCdnCache.delete(cacheKey);

      const refreshedUrl = await resolveOrRefreshMiawCdnUrl(req);
      if (refreshedUrl && refreshedUrl !== targetUrl) {
        return proxyMiawVideoStream(refreshedUrl, req, res, 4, true);
      }
    }

    res.status(code);
    const passthrough = ['content-length', 'content-range', 'accept-ranges', 'content-type', 'last-modified', 'etag'];
    for (const h of passthrough) {
      if (upstreamRes.headers[h]) res.setHeader(h, upstreamRes.headers[h]);
    }
    if (!res.getHeader('content-type')) res.setHeader('Content-Type', 'video/mp4');
    res.removeHeader('X-Frame-Options');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');

    upstreamRes.pipe(res);
  });

  upstreamReq.on('error', (err) => {
    if (!res.headersSent) res.status(502).send(`Proxy error: ${err.message}`);
  });
}

// ─── GET /api/miaw/miaw-video (Proxy streaming 206 Range avec cache CDN) ─────
router.get('/miaw-video', async (req, res) => {
  const targetUrl = req.query.url;
  if (!targetUrl || typeof targetUrl !== 'string' || !targetUrl.startsWith('https://')) {
    return res.status(400).send('Invalid video URL');
  }

  const cacheKey = buildCdnCacheKey(req.query);
  const cachedCdn = cacheKey ? getResolvedCdn(cacheKey) : null;
  if (cachedCdn) {
    return proxyMiawVideoStream(cachedCdn, req, res);
  }

  const resolved = await resolveBlinkRedirectOnce(targetUrl);
  if (resolved) {
    if (cacheKey) setResolvedCdn(cacheKey, resolved);
    return proxyMiawVideoStream(resolved, req, res);
  }

  proxyMiawVideoStream(targetUrl, req, res);
});

// ─── GET /api/miaw/miaw-embed (Lecteur HTML5 1080p sans pub pour Miaw) ───────
router.get('/miaw-embed', (req, res) => {
  const targetUrl = req.query.url;
  if (!targetUrl || typeof targetUrl !== 'string' || !targetUrl.startsWith('https://')) {
    return res.status(400).send('Invalid video URL');
  }

  const baseApiUrl = getBaseApiUrl(req);
  const qs = new URLSearchParams();
  qs.set('url', targetUrl);
  if (req.query.lang) qs.set('lang', req.query.lang);
  if (req.query.kind) qs.set('kind', req.query.kind);
  if (req.query.tmdbId) qs.set('tmdbId', req.query.tmdbId);
  if (req.query.season) qs.set('season', req.query.season);
  if (req.query.episode) qs.set('episode', req.query.episode);
  if (req.query.title) qs.set('title', req.query.title);

  const videoSrc = `${baseApiUrl}/api/miaw/miaw-video?${qs.toString()}`;

  res.removeHeader('X-Frame-Options');
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Access-Control-Allow-Origin', '*');

  res.send(`<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no" />
  <title>Lecteur Miaw 1080p</title>
  <style>
    html, body {
      margin: 0; padding: 0; width: 100%; height: 100%;
      background: #000; overflow: hidden;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    }
    video {
      width: 100%; height: 100%; object-fit: contain;
      background: #000; outline: none;
    }
    .unmute-btn {
      position: absolute; top: 16px; left: 16px; z-index: 10;
      background: rgba(16, 185, 129, 0.9); color: #fff;
      border: none; padding: 10px 16px; border-radius: 9999px;
      font-size: 14px; font-weight: 600; cursor: pointer;
      display: none; box-shadow: 0 4px 12px rgba(0, 0, 0, 0.4);
    }
  </style>
</head>
<body>
  <button id="unmuteBtn" class="unmute-btn">🔊 Activer le son</button>
  <video
    id="player"
    src="${videoSrc}"
    controls
    autoplay
    playsinline
    preload="auto"
  ></video>
  <script>
    (function() {
      var v = document.getElementById('player');
      var btn = document.getElementById('unmuteBtn');
      var p = v.play();
      if (p && typeof p.catch === 'function') {
        p.catch(function() {
          v.muted = true;
          btn.style.display = 'block';
          v.play().catch(function() {});
        });
      }
      btn.addEventListener('click', function() {
        v.muted = false;
        btn.style.display = 'none';
        v.play().catch(function() {});
      });
    })();
    ${getAmbilightEmbedScript('player')}
  </script>
</body>
</html>`);
});

// ─── GET /api/miaw/movie/:tmdbId ─────────────────────────────────────────────
router.get('/movie/:tmdbId', async (req, res) => {
  const { tmdbId } = req.params;
  const title = req.query.title || '';
  if (!tmdbId) return res.status(400).json({ error: 'tmdbId requis' });

  const cacheKey = `movie:${tmdbId}`;
  const cached = getCached(cacheKey);
  if (cached) return res.json(cached);

  const baseApiUrl = getBaseApiUrl(req);

  try {
    const miawPlayers = await fetchMiawMoviePlayers(tmdbId, baseApiUrl, { title });
    const vf = miawPlayers.vf || [];
    const vostfr = miawPlayers.vostfr || [];

    if (!vf.length && !vostfr.length) {
      return res.status(404).json({ success: false, error: 'Film non disponible sur Miaw' });
    }

    const result = {
      success: true,
      source: 'miaw',
      tmdbId: Number(tmdbId),
      players: { vf, vostfr },
      embedUrl: vf[0]?.url || vostfr[0]?.url || '',
    };

    setCached(cacheKey, result);
    res.json(result);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─── Helper TV & Anime ───────────────────────────────────────────────────────
async function handleTvOrAnime(tmdbId, season, episode, req, res, isAnime = false) {
  if (!tmdbId || !season || !episode) {
    return res.status(400).json({ error: 'tmdbId, season et episode requis' });
  }

  const cacheKey = `${isAnime ? 'anime' : 'tv'}:${tmdbId}:${season}:${episode}`;
  const cached = getCached(cacheKey);
  if (cached) return res.json(cached);

  const baseApiUrl = getBaseApiUrl(req);
  let seriesTitle = req.query.title || '';

  // Auto-résolution du titre via TMDB si non fourni
  if (!seriesTitle && tmdbId) {
    try {
      const tmdbKey = process.env.TMDB_API_KEY || '15d2ea6d0dc1d476efbca3eba2b9bbfb';
      const tmdbResp = await axios.get(`https://api.themoviedb.org/3/tv/${tmdbId}?api_key=${tmdbKey}&language=fr-FR`, { timeout: 3500 });
      if (tmdbResp.data) {
        seriesTitle = tmdbResp.data.name || tmdbResp.data.original_name || '';
      }
    } catch (_) {}
  }

  try {
    const miawPlayers = seriesTitle
      ? await fetchMiawTvOrAnimePlayers(seriesTitle, season, episode, baseApiUrl, {
          tmdbId,
          kind: isAnime ? 'anime' : 'tv',
        })
      : { vf: [], vostfr: [] };

    const vf = miawPlayers.vf || [];
    const vostfr = miawPlayers.vostfr || [];

    if (!vf.length && !vostfr.length) {
      return res.status(404).json({
        success: false,
        error: `${isAnime ? 'Anime' : 'Épisode'} S${season}E${episode} non disponible sur Miaw`,
      });
    }

    const result = {
      success: true,
      source: 'miaw',
      tmdbId: Number(tmdbId),
      season: Number(season),
      episode: Number(episode),
      players: { vf, vostfr },
      embedUrl: vf[0]?.url || vostfr[0]?.url || '',
    };

    setCached(cacheKey, result);
    res.json(result);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
}

// ─── GET /api/miaw/tv/:tmdbId/season/:season/episode/:episode ────────────────
router.get('/tv/:tmdbId/season/:season/episode/:episode', (req, res) => {
  const { tmdbId, season, episode } = req.params;
  return handleTvOrAnime(tmdbId, season, episode, req, res, false);
});

// ─── GET /api/miaw/tv/:tmdbId?season=&episode= ───────────────────────────────
router.get('/tv/:tmdbId', (req, res) => {
  const { tmdbId } = req.params;
  const season = req.query.season || req.query.s || 1;
  const episode = req.query.episode || req.query.e || 1;
  return handleTvOrAnime(tmdbId, season, episode, req, res, false);
});

// ─── GET /api/miaw/anime/:tmdbId/season/:season/episode/:episode ─────────────
router.get('/anime/:tmdbId/season/:season/episode/:episode', (req, res) => {
  const { tmdbId, season, episode } = req.params;
  return handleTvOrAnime(tmdbId, season, episode, req, res, true);
});

// ─── GET /api/miaw/anime/:tmdbId?season=&episode= ────────────────────────────
router.get('/anime/:tmdbId', (req, res) => {
  const { tmdbId } = req.params;
  const season = req.query.season || req.query.s || 1;
  const episode = req.query.episode || req.query.e || 1;
  return handleTvOrAnime(tmdbId, season, episode, req, res, true);
});

module.exports = router;
