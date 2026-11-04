/**
 * Moviez & Miaw 1080p API route — Ad-free multi-language streaming resolver & HLS/MP4 extractor.
 * Mount point: app.use('/api/moviez', router)
 *
 *   GET /api/moviez/movie/:tmdbId
 *   GET /api/moviez/tv/:tmdbId?season=1&episode=1
 *   GET /api/moviez/tv/:tmdbId/season/:season/episode/:episode
 *   GET /api/moviez/miaw-video?url=...
 *   GET /api/moviez/miaw-embed?url=...
 *   GET /api/moviez/stream?url=...
 */

const express = require('express');
const router = express.Router();
const axios = require('axios');
const https = require('https');

const MOVIEZ_BASE = 'https://api.moviez.ac';
const MIAW_BASE = 'https://miaw.tv';
const CACHE_TTL_MS = 2 * 60 * 1000; // 2 minutes (les tokens blink miaw.tv expirent rapidement)
const CDN_CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes pour l'URL CDN résolue (zen-blk.store)
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

const moviezClient = axios.create({
  timeout: 6000,
  headers: {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
    'Referer': `${MOVIEZ_BASE}/`,
    'Accept-Language': 'fr-FR,fr;q=0.9,en-US;q=0.8,en;q=0.7',
  },
  validateStatus: () => true,
});

const miawClient = axios.create({
  timeout: 6500,
  headers: {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
    'Referer': `${MIAW_BASE}/`,
    'Accept-Language': 'fr-FR,fr;q=0.9,en-US;q=0.8,en;q=0.7',
  },
  maxRedirects: 5,
  validateStatus: () => true,
});

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

  const marker = '\\"players\\":[';
  const idx = html.indexOf(marker);
  if (idx === -1) return out;

  const arrayStart = idx + '\\"players\\":'.length;
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
    const rawEscaped = html.slice(arrayStart, endIdx);
    const unescaped = rawEscaped.replace(/\\"/g, '"').replace(/\\\\/g, '\\');
    const players = JSON.parse(unescaped);
    if (!Array.isArray(players)) return out;

    for (const p of players) {
      if (!p || !p.src) continue;
      const lang = (p.language || 'vf').toLowerCase() === 'vostfr' ? 'vostfr' : 'vf';
      const langUpper = lang.toUpperCase();

      if (p.type === 'blink' && p.src.startsWith('https://')) {
        const params = new URLSearchParams();
        params.set('url', p.src);
        params.set('lang', lang);
        if (meta.kind) params.set('kind', meta.kind);
        if (meta.tmdbId) params.set('tmdbId', String(meta.tmdbId));
        if (meta.season) params.set('season', String(meta.season));
        if (meta.episode) params.set('episode', String(meta.episode));
        if (meta.title) params.set('title', String(meta.title));
        const fallback = lang === 'vostfr' ? meta.fallbackVostfr : meta.fallbackVf;
        if (fallback) params.set('fallback', fallback);

        const embedUrl = `${baseApiUrl}/api/moviez/miaw-embed?${params.toString()}`;
        const directProxyUrl = `${baseApiUrl}/api/moviez/miaw-video?${params.toString()}`;
        out[lang].push({
          name: `Miaw (${langUpper})`,
          url: embedUrl,
          directUrl: directProxyUrl,
          rawUrl: p.src,
          hoster: 'miaw',
          language: lang,
          type: 'moviez',
          quality: '1080p HD',
        });
      } else if (p.choiceKey === 'source:sharecloudy' && p.src.startsWith('https://')) {
        out[lang].push({
          name: `ShareCloudy (${langUpper})`,
          url: p.src,
          hoster: 'sharecloudy',
          language: lang,
          type: 'moviez',
        });
      }
    }
  } catch (_) {}

  return out;
}

async function fetchMiawMoviePlayers(tmdbId, baseApiUrl, meta = {}) {
  try {
    const resp = await miawClient.get(`${MIAW_BASE}/movie/${tmdbId}`);
    if (resp.status !== 200 || typeof resp.data !== 'string') return { vf: [], vostfr: [] };

    const canonMatch = resp.data.match(/rel="canonical"\s+href="https:\/\/miaw\.tv(\/film\/[^"]+)"/);
    const filmPath = canonMatch ? canonMatch[1] : null;
    if (!filmPath) return { vf: [], vostfr: [] };

    const watchResp = await miawClient.get(`${MIAW_BASE}${filmPath}/regarder`);
    if (watchResp.status !== 200 || typeof watchResp.data !== 'string') return { vf: [], vostfr: [] };

    return parseMiawPlayersFromHtml(watchResp.data, baseApiUrl, {
      ...meta,
      kind: 'movie',
      tmdbId,
    });
  } catch (_) {
    return { vf: [], vostfr: [] };
  }
}

async function fetchMiawTvPlayers(seriesTitle, season, episode, baseApiUrl, meta = {}) {
  try {
    const slug = slugifyMiaw(seriesTitle);
    if (!slug) return { vf: [], vostfr: [] };
    const watchUrl = `${MIAW_BASE}/series/${slug}/episode/${episode}/saison/${season}`;
    const watchResp = await miawClient.get(watchUrl);
    if (watchResp.status !== 200 || typeof watchResp.data !== 'string') return { vf: [], vostfr: [] };
    return parseMiawPlayersFromHtml(watchResp.data, baseApiUrl, {
      ...meta,
      kind: 'tv',
      title: seriesTitle,
      season,
      episode,
    });
  } catch (_) {
    return { vf: [], vostfr: [] };
  }
}

/**
 * Résout un lien `https://miaw.tv/api/blink/v/...` en son URL CDN finale (`https://cdn*.zen-blk.store/...`)
 */
function resolveBlinkRedirectOnce(blinkUrl) {
  return new Promise((resolve) => {
    try {
      const parsed = new URL(blinkUrl);
      const req = https.get(parsed.toString(), {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
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

function getMediaCacheKey(query) {
  const lang = (query.lang || 'vf').toLowerCase();
  if (query.kind === 'movie' && query.tmdbId) {
    return `cdn:movie:${query.tmdbId}:${lang}`;
  }
  if (query.kind === 'tv' && (query.title || query.tmdbId) && query.season && query.episode) {
    return `cdn:tv:${slugifyMiaw(query.title || query.tmdbId)}:${query.season}:${query.episode}:${lang}`;
  }
  return null;
}

async function resolveOrRefreshMiawCdnUrl(req) {
  const rawUrl = req.query.url;
  const mediaKey = getMediaCacheKey(req.query);

  // 1. Vérifier le cache d'URL CDN déjà résolue
  const cachedByMedia = getResolvedCdn(mediaKey);
  if (cachedByMedia) return cachedByMedia;
  const cachedByUrl = getResolvedCdn(rawUrl);
  if (cachedByUrl) return cachedByUrl;

  // 2. Si c'est déjà une URL CDN directe (pas blink), la retourner directement
  if (rawUrl && !rawUrl.includes('/api/blink/v/')) {
    return rawUrl;
  }

  // 3. Tenter de résoudre le token blink fourni
  if (rawUrl) {
    const resolved = await resolveBlinkRedirectOnce(rawUrl);
    if (resolved) {
      setResolvedCdn(rawUrl, resolved);
      if (mediaKey) setResolvedCdn(mediaKey, resolved);
      return resolved;
    }
  }

  // 4. Si le token blink a expiré, rafraîchir automatiquement depuis miaw.tv !
  const baseApiUrl = getBaseApiUrl(req);
  const lang = (req.query.lang || 'vf').toLowerCase() === 'vostfr' ? 'vostfr' : 'vf';
  let freshPlayers = { vf: [], vostfr: [] };

  if (req.query.kind === 'movie' && req.query.tmdbId) {
    freshPlayers = await fetchMiawMoviePlayers(req.query.tmdbId, baseApiUrl);
  } else if (req.query.kind === 'tv' && req.query.title && req.query.season && req.query.episode) {
    freshPlayers = await fetchMiawTvPlayers(req.query.title, req.query.season, req.query.episode, baseApiUrl);
  }

  const candidate = (freshPlayers[lang] || []).find((p) => p.hoster === 'miaw' && p.rawUrl)
    || (freshPlayers.vf || []).find((p) => p.hoster === 'miaw' && p.rawUrl);

  if (candidate && candidate.rawUrl) {
    const resolved = await resolveBlinkRedirectOnce(candidate.rawUrl);
    if (resolved) {
      setResolvedCdn(candidate.rawUrl, resolved);
      if (rawUrl) setResolvedCdn(rawUrl, resolved);
      if (mediaKey) setResolvedCdn(mediaKey, resolved);
      return resolved;
    }
  }

  return rawUrl;
}

/**
 * Vérifie si une URL Moviez est disponible et valide
 */
async function checkAvailability(url) {
  try {
    const resp = await moviezClient.get(url);
    if (resp.status === 200 && typeof resp.data === 'string' && resp.data.includes('window.P2')) {
      const titleMatch = resp.data.match(/<title>(.*?)<\/title>/i);
      const rawTitle = titleMatch ? titleMatch[1].replace(/\s+S\d+E\d+$/i, '').trim() : '';
      return { available: true, html: resp.data, title: rawTitle };
    }
    return { available: false, html: null, title: '' };
  } catch (e) {
    return { available: false, html: null, title: '', error: e.message };
  }
}

// ─── GET /api/moviez/miaw-video (Proxy streaming 206 Range avec cache CDN) ──
function proxyMiawVideoStream(targetUrl, req, res, redirectsLeft = 4, retriedRefresh = false) {
  let parsed;
  try {
    parsed = new URL(targetUrl);
  } catch {
    if (!res.headersSent) res.status(400).send('Invalid URL');
    return;
  }

  const headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
    'Referer': `${MIAW_BASE}/`,
  };
  if (req.headers.range) {
    headers['Range'] = req.headers.range;
  }

  const upstreamReq = https.get(parsed.toString(), { headers }, async (upstreamRes) => {
    const code = upstreamRes.statusCode || 200;
    if ([301, 302, 303, 307, 308].includes(code) && upstreamRes.headers.location && redirectsLeft > 0) {
      upstreamRes.resume();
      const nextUrl = new URL(upstreamRes.headers.location, parsed).toString();
      if (req.query.url) setResolvedCdn(req.query.url, nextUrl);
      const mediaKey = getMediaCacheKey(req.query);
      if (mediaKey) setResolvedCdn(mediaKey, nextUrl);
      return proxyMiawVideoStream(nextUrl, req, res, redirectsLeft - 1, retriedRefresh);
    }

    // Si le token blink a expiré (401/403/404/410), rafraîchir automatiquement une fois
    if ([401, 403, 404, 410].includes(code) && !retriedRefresh) {
      upstreamRes.resume();
      const mediaKey = getMediaCacheKey(req.query);
      if (mediaKey) resolvedCdnCache.delete(mediaKey);
      if (req.query.url) resolvedCdnCache.delete(req.query.url);
      const refreshedUrl = await resolveOrRefreshMiawCdnUrl(req);
      if (refreshedUrl && refreshedUrl !== targetUrl) {
        return proxyMiawVideoStream(refreshedUrl, req, res, 4, true);
      }
    }

    res.status(code);
    const passthrough = ['content-length', 'content-range', 'accept-ranges'];
    for (const h of passthrough) {
      if (upstreamRes.headers[h]) {
        res.setHeader(h, upstreamRes.headers[h]);
      }
    }
    res.removeHeader('X-Frame-Options');
    res.setHeader('Content-Type', 'video/mp4');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
    upstreamRes.pipe(res);
  });

  upstreamReq.on('error', (err) => {
    if (!res.headersSent) {
      res.status(502).send(err.message);
    }
  });

  req.on('close', () => {
    upstreamReq.destroy();
  });
}

router.get('/miaw-video', (req, res) => {
  const targetUrl = req.query.url;
  if (!targetUrl || typeof targetUrl !== 'string' || !targetUrl.startsWith('https://')) {
    return res.status(400).send('Invalid video URL');
  }
  const mediaKey = getMediaCacheKey(req.query);
  const cachedCdn = getResolvedCdn(mediaKey) || getResolvedCdn(targetUrl);
  proxyMiawVideoStream(cachedCdn || targetUrl, req, res);
});

// ─── GET /api/moviez/miaw-embed (Lecteur HTML5 1080p sans pub pour Miaw) ──────
router.get('/miaw-embed', (req, res) => {
  const targetUrl = req.query.url;
  if (!targetUrl || typeof targetUrl !== 'string') {
    return res.status(400).send('Missing url');
  }
  const baseApiUrl = getBaseApiUrl(req);
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(req.query)) {
    if (typeof v === 'string') qs.set(k, v);
  }
  const videoSrc = `${baseApiUrl}/api/moviez/miaw-video?${qs.toString()}`;
  const fallbackUrl = typeof req.query.fallback === 'string' && req.query.fallback.startsWith('https://')
    ? req.query.fallback
    : '';

  res.removeHeader('X-Frame-Options');
  res.setHeader('Content-Security-Policy', 'frame-ancestors *');
  res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.send(`<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Lecteur Miaw 1080p</title>
<style>
  html, body { margin: 0; padding: 0; width: 100%; height: 100%; background: #000; overflow: hidden; font-family: system-ui, -apple-system, sans-serif; }
  video { width: 100%; height: 100%; object-fit: contain; background: #000; outline: none; }
  #unmute-btn {
    display: none;
    position: fixed;
    bottom: 68px;
    right: 24px;
    z-index: 50;
    background: rgba(16, 185, 129, 0.92);
    color: #fff;
    border: none;
    border-radius: 9999px;
    padding: 10px 18px;
    font-size: 14px;
    font-weight: 600;
    cursor: pointer;
    box-shadow: 0 8px 24px rgba(0,0,0,0.5);
  }
</style>
</head>
<body>
  <video id="v" src="${videoSrc}" controls autoplay playsinline preload="auto"></video>
  <button id="unmute-btn">🔊 Activer le son</button>
  <script>
    (function() {
      var v = document.getElementById('v');
      var btn = document.getElementById('unmute-btn');
      var fallback = ${JSON.stringify(fallbackUrl)};
      var didFallback = false;

      function triggerFallback() {
        if (didFallback || !fallback) return;
        didFallback = true;
        window.location.replace(fallback);
      }

      v.addEventListener('error', function() {
        triggerFallback();
      });

      v.addEventListener('loadedmetadata', function() {
        if (v.videoWidth === 0) {
          v.pause();
          triggerFallback();
        }
      });

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
  </script>
</body>
</html>`);
});

// ─── GET /api/moviez/movie/:tmdbId ───────────────────────────────────────────
router.get('/movie/:tmdbId', async (req, res) => {
  const { tmdbId } = req.params;
  if (!tmdbId) return res.status(400).json({ error: 'tmdbId requis' });

  const cacheKey = `movie:${tmdbId}`;
  const cached = getCached(cacheKey);
  if (cached) return res.json(cached);

  const baseApiUrl = getBaseApiUrl(req);
  const vfUrl = `${MOVIEZ_BASE}/${tmdbId}?lang=vf&autoplay=1`;
  const vostfrUrl = `${MOVIEZ_BASE}/${tmdbId}?lang=vostfr&autoplay=1`;

  try {
    const [vfCheck, vostfrCheck, miawPlayers] = await Promise.all([
      checkAvailability(vfUrl),
      checkAvailability(vostfrUrl),
      fetchMiawMoviePlayers(tmdbId, baseApiUrl, {
        fallbackVf: vfUrl,
        fallbackVostfr: vostfrUrl,
      }),
    ]);

    const players = {
      vf: [...(miawPlayers.vf || [])],
      vostfr: [...(miawPlayers.vostfr || [])],
    };

    if (vfCheck.available) {
      players.vf.push({
        name: 'Moviez (VF)',
        url: vfUrl,
        hoster: 'moviez',
        language: 'vf',
        type: 'moviez',
      });
    }

    if (vostfrCheck.available) {
      players.vostfr.push({
        name: 'Moviez (VOSTFR)',
        url: vostfrUrl,
        hoster: 'moviez',
        language: 'vostfr',
        type: 'moviez',
      });
    }

    if (!players.vf.length && !players.vostfr.length) {
      return res.status(404).json({
        success: false,
        error: 'Film non disponible sur Moviez/Miaw',
      });
    }

    const result = {
      success: true,
      source: 'moviez',
      tmdbId: Number(tmdbId),
      players,
      embedUrl: players.vf[0]?.url || players.vostfr[0]?.url || '',
    };

    setCached(cacheKey, result);
    res.json(result);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─── Helper pour TV ──────────────────────────────────────────────────────────
async function handleTv(tmdbId, season, episode, req, res) {
  if (!tmdbId || !season || !episode) {
    return res.status(400).json({ error: 'Paramètres tmdbId, season et episode requis' });
  }

  const cacheKey = `tv:${tmdbId}:${season}:${episode}`;
  const cached = getCached(cacheKey);
  if (cached) return res.json(cached);

  const baseApiUrl = getBaseApiUrl(req);
  const vfUrl = `${MOVIEZ_BASE}/serie/${tmdbId}/${season}/${episode}?lang=vf&autoplay=1`;
  const vostfrUrl = `${MOVIEZ_BASE}/serie/${tmdbId}/${season}/${episode}?lang=vostfr&autoplay=1`;

  try {
    const [vfCheck, vostfrCheck] = await Promise.all([
      checkAvailability(vfUrl),
      checkAvailability(vostfrUrl),
    ]);

    const seriesTitle = vfCheck.title || vostfrCheck.title || req.query.title || '';
    const miawPlayers = seriesTitle
      ? await fetchMiawTvPlayers(seriesTitle, season, episode, baseApiUrl, {
          tmdbId,
          fallbackVf: vfUrl,
          fallbackVostfr: vostfrUrl,
        })
      : { vf: [], vostfr: [] };

    const players = {
      vf: [...(miawPlayers.vf || [])],
      vostfr: [...(miawPlayers.vostfr || [])],
    };

    if (vfCheck.available) {
      players.vf.push({
        name: 'Moviez (VF)',
        url: vfUrl,
        hoster: 'moviez',
        language: 'vf',
        type: 'moviez',
      });
    }

    if (vostfrCheck.available) {
      players.vostfr.push({
        name: 'Moviez (VOSTFR)',
        url: vostfrUrl,
        hoster: 'moviez',
        language: 'vostfr',
        type: 'moviez',
      });
    }

    if (!players.vf.length && !players.vostfr.length) {
      return res.status(404).json({
        success: false,
        error: `Épisode S${season}E${episode} non disponible sur Moviez/Miaw`,
      });
    }

    const result = {
      success: true,
      source: 'moviez',
      tmdbId: Number(tmdbId),
      season: Number(season),
      episode: Number(episode),
      players,
      embedUrl: players.vf[0]?.url || players.vostfr[0]?.url || '',
    };

    setCached(cacheKey, result);
    res.json(result);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
}

// ─── GET /api/moviez/tv/:tmdbId/season/:season/episode/:episode ──────────────
router.get('/tv/:tmdbId/season/:season/episode/:episode', (req, res) => {
  const { tmdbId, season, episode } = req.params;
  return handleTv(tmdbId, season, episode, req, res);
});

// ─── GET /api/moviez/tv/:tmdbId?season=&episode= ──────────────────────────────
router.get('/tv/:tmdbId', (req, res) => {
  const { tmdbId } = req.params;
  const season = req.query.season || req.query.s;
  const episode = req.query.episode || req.query.e;
  return handleTv(tmdbId, season, episode, req, res);
});

// ─── GET /api/moviez/stream (Extracteur HLS natif direct) ─────────────────────
router.get('/stream', async (req, res) => {
  const targetUrl = req.query.url;
  if (!targetUrl) return res.status(400).json({ error: 'URL requise' });

  try {
    const pageResp = await moviezClient.get(targetUrl);
    if (pageResp.status !== 200 || typeof pageResp.data !== 'string') {
      return res.status(502).json({ error: 'Impossible de charger la page Moviez' });
    }

    const match = pageResp.data.match(/window\.P2\s*=\s*({[^;]+});/);
    if (!match) {
      return res.status(502).json({ error: 'Token P2 introuvable dans la page' });
    }

    let p2;
    try {
      p2 = JSON.parse(match[1]);
    } catch {
      return res.status(502).json({ error: 'Format P2 invalide' });
    }

    const streamResp = await axios.post(`${MOVIEZ_BASE}/api/v2/stream`, { t: p2.t }, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Referer': targetUrl,
        'Origin': MOVIEZ_BASE,
        'Content-Type': 'application/json',
      },
      timeout: 6000,
    });

    if (streamResp.data && streamResp.data.hls) {
      return res.json({
        success: true,
        hls: streamResp.data.hls,
        duration: streamResp.data.duration,
        expires: streamResp.data.expires,
        thumbs: streamResp.data.thumbs || null,
      });
    }

    res.status(502).json({ error: 'Flux HLS non retourné par Moviez' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
