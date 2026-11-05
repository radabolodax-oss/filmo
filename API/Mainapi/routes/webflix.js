/**
 * Webflix API route — Scraper & résolveur de flux FastFlux (MP4 CDN), Nexus & Vidzy
 * Source : https://webflix.bio
 * Mount point: app.use('/api/webflix', router)
 *
 *   GET /api/webflix/movie/:tmdbId
 *   GET /api/webflix/tv/:tmdbId?season=1&episode=1
 *   GET /api/webflix/tv/:tmdbId/season/:season/episode/:episode
 *   GET /api/webflix/discovery/:tmdbId
 *   GET /api/webflix/embed?url=...
 *   GET /api/webflix/video?url=...
 */

const express = require('express');
const router = express.Router();
const axios = require('axios');
const https = require('https');

const WEBFLIX_BASE = 'https://webflix.bio';
const VIDZY_BASE = 'https://vidzy.org';
const MOVIEZ_BASE = 'https://api.moviez.ac';
const CACHE_TTL_MS = 15 * 60 * 1000; // 15 minutes de cache
const cache = new Map();

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

const webflixClient = axios.create({
  timeout: 6500,
  headers: {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
    'Referer': `${WEBFLIX_BASE}/`,
    'Accept': 'application/json, text/plain, */*',
  },
  validateStatus: () => true,
});

function getBaseApiUrl(req) {
  const proto = req.headers['x-forwarded-proto'] || req.protocol || 'http';
  const host = req.headers['x-forwarded-host'] || req.get('host') || 'localhost:25565';
  return `${proto}://${host}`;
}

// ─── GET /api/webflix/video (Proxy streaming 206 Range avec Referer) ────────
router.get('/video', (req, res) => {
  const targetUrl = req.query.url;
  if (!targetUrl || typeof targetUrl !== 'string' || !targetUrl.startsWith('https://')) {
    return res.status(400).send('Invalid video URL');
  }

  let parsed;
  try {
    parsed = new URL(targetUrl);
  } catch {
    return res.status(400).send('Malformed URL');
  }

  const headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
    'Referer': `${WEBFLIX_BASE}/`,
  };
  if (req.headers.range) {
    headers['Range'] = req.headers.range;
  }

  const upstreamReq = https.get(parsed.toString(), { headers }, (upstreamRes) => {
    const code = upstreamRes.statusCode || 200;
    if ([301, 302, 303, 307, 308].includes(code) && upstreamRes.headers.location) {
      upstreamRes.resume();
      const nextUrl = new URL(upstreamRes.headers.location, parsed).toString();
      req.query.url = nextUrl;
      return router.handle(req, res);
    }

    res.status(code);
    const passthrough = ['content-length', 'content-range', 'accept-ranges', 'last-modified', 'etag'];
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
});

// ─── GET /api/webflix/embed (Lecteur HTML5 sans pub pour FastFlux) ───────────
router.get('/embed', (req, res) => {
  const targetUrl = req.query.url;
  if (!targetUrl || typeof targetUrl !== 'string') {
    return res.status(400).send('Missing url');
  }
  const baseApiUrl = getBaseApiUrl(req);
  const videoSrc = `${baseApiUrl}/api/webflix/video?url=${encodeURIComponent(targetUrl)}`;
  const title = req.query.title || 'Webflix FastFlux 1080p';

  res.removeHeader('X-Frame-Options');
  res.setHeader('Content-Security-Policy', 'frame-ancestors *');
  res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.send(`<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${title}</title>
<style>
  html, body { margin: 0; padding: 0; width: 100%; height: 100%; background: #000; overflow: hidden; font-family: system-ui, -apple-system, sans-serif; }
  video { width: 100%; height: 100%; object-fit: contain; background: #000; outline: none; }
  #unmute-btn {
    display: none;
    position: fixed;
    bottom: 68px;
    right: 24px;
    z-index: 50;
    background: rgba(168, 85, 247, 0.92);
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

// ─── GET /api/webflix/movie/:tmdbId ──────────────────────────────────────────
router.get('/movie/:tmdbId', async (req, res) => {
  const { tmdbId } = req.params;
  if (!tmdbId) return res.status(400).json({ error: 'tmdbId requis' });

  const cacheKey = `movie:${tmdbId}`;
  const cached = getCached(cacheKey);
  if (cached) return res.json(cached);

  const baseApiUrl = getBaseApiUrl(req);

  try {
    const [fastfluxResp, vidzyCheckResp] = await Promise.all([
      webflixClient.get(`${WEBFLIX_BASE}/api/fastflux?type=movie&tmdb_id=${tmdbId}`).catch(() => ({ status: 500 })),
      webflixClient.get(`${VIDZY_BASE}/api/${tmdbId}`).catch(() => ({ status: 500 })),
    ]);

    const vf = [];
    const vostfr = [];

    // 1. FastFlux MP4 direct (via embed HTML5 contrôlé)
    if (fastfluxResp.status === 200 && fastfluxResp.data?.available && fastfluxResp.data?.data?.url) {
      const d = fastfluxResp.data.data;
      const embedUrl = `${baseApiUrl}/api/webflix/embed?url=${encodeURIComponent(d.url)}`;
      const proxyUrl = `${baseApiUrl}/api/webflix/video?url=${encodeURIComponent(d.url)}`;
      vf.push({
        name: 'Webflix FastFlux 1080p (VF)',
        url: embedUrl,
        directUrl: proxyUrl,
        rawUrl: d.url,
        hoster: 'fastflux',
        language: 'vf',
        type: 'webflix',
        quality: '1080p FHD',
        size: d.size || null,
      });
    }

    // 2. Nexus player (direct Moviez avec theme violet Webflix)
    vf.push({
      name: 'Webflix Nexus (VF)',
      url: `${MOVIEZ_BASE}/${tmdbId}?lang=vf&color=a78bfa&hide=download`,
      hoster: 'webflix',
      language: 'vf',
      type: 'webflix',
      quality: '1080p HD',
    });
    vostfr.push({
      name: 'Webflix Nexus (VOSTFR)',
      url: `${MOVIEZ_BASE}/${tmdbId}?lang=vostfr&color=a78bfa&hide=download`,
      hoster: 'webflix',
      language: 'vostfr',
      type: 'webflix',
      quality: '1080p HD',
    });

    // 3. Vidzy player
    if (vidzyCheckResp.status === 200 && vidzyCheckResp.data?.available) {
      vf.push({
        name: 'Webflix Vidzy (VF)',
        url: `${VIDZY_BASE}/movie/${tmdbId}/vf?autoplay=1`,
        hoster: 'vidzy',
        language: 'vf',
        type: 'webflix',
      });
      vostfr.push({
        name: 'Webflix Vidzy (VOSTFR)',
        url: `${VIDZY_BASE}/movie/${tmdbId}/vostfr?autoplay=1`,
        hoster: 'vidzy',
        language: 'vostfr',
      });
    }

    // 4. Frembed & Cinesrc
    vf.push({
      name: 'Webflix Frembed (VF)',
      url: `https://frembed.cyou/api/film.php?id=${tmdbId}`,
      hoster: 'frembed',
      language: 'vf',
      type: 'webflix',
    });
    vostfr.push({
      name: 'Webflix Cinesrc (VOSTFR)',
      url: `https://cinesrc.st/embed/movie/${tmdbId}`,
      hoster: 'cinesrc',
      language: 'vostfr',
      type: 'webflix',
    });

    if (!vf.length && !vostfr.length) {
      return res.status(404).json({ success: false, error: 'Film non disponible sur Webflix' });
    }

    const result = {
      success: true,
      source: 'webflix',
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

// ─── Helper TV ───────────────────────────────────────────────────────────────
async function handleTv(tmdbId, season, episode, req, res) {
  if (!tmdbId || !season || !episode) {
    return res.status(400).json({ error: 'tmdbId, season et episode requis' });
  }

  const cacheKey = `tv:${tmdbId}:${season}:${episode}`;
  const cached = getCached(cacheKey);
  if (cached) return res.json(cached);

  const baseApiUrl = getBaseApiUrl(req);

  try {
    const [fastfluxResp, vidzyCheckResp] = await Promise.all([
      webflixClient.get(`${WEBFLIX_BASE}/api/fastflux?type=episode&tmdb_id=${tmdbId}&season=${season}&episode=${episode}`).catch(() => ({ status: 500 })),
      webflixClient.get(`${VIDZY_BASE}/api/${tmdbId}`).catch(() => ({ status: 500 })),
    ]);

    const vf = [];
    const vostfr = [];

    // 1. FastFlux MP4 direct
    if (fastfluxResp.status === 200 && fastfluxResp.data?.available && fastfluxResp.data?.data?.url) {
      const d = fastfluxResp.data.data;
      const embedUrl = `${baseApiUrl}/api/webflix/embed?url=${encodeURIComponent(d.url)}`;
      const proxyUrl = `${baseApiUrl}/api/webflix/video?url=${encodeURIComponent(d.url)}`;
      vf.push({
        name: 'Webflix FastFlux 1080p (VF)',
        url: embedUrl,
        directUrl: proxyUrl,
        rawUrl: d.url,
        hoster: 'fastflux',
        language: 'vf',
        type: 'webflix',
        quality: '1080p FHD',
        size: d.size || null,
      });
    }

    // 2. Nexus player TV
    vf.push({
      name: 'Webflix Nexus (VF)',
      url: `${MOVIEZ_BASE}/serie/${tmdbId}/${season}/${episode}?lang=vf&color=a78bfa&hide=download`,
      hoster: 'webflix',
      language: 'vf',
      type: 'webflix',
      quality: '1080p HD',
    });
    vostfr.push({
      name: 'Webflix Nexus (VOSTFR)',
      url: `${MOVIEZ_BASE}/serie/${tmdbId}/${season}/${episode}?lang=vostfr&color=a78bfa&hide=download`,
      hoster: 'webflix',
      language: 'vostfr',
      type: 'webflix',
      quality: '1080p HD',
    });

    // 3. Vidzy TV
    if (vidzyCheckResp.status === 200 && vidzyCheckResp.data?.available) {
      vf.push({
        name: 'Webflix Vidzy (VF)',
        url: `${VIDZY_BASE}/serie/${tmdbId}/${season}/${episode}/vf?autoplay=1`,
        hoster: 'vidzy',
        language: 'vf',
        type: 'webflix',
      });
      vostfr.push({
        name: 'Webflix Vidzy (VOSTFR)',
        url: `${VIDZY_BASE}/serie/${tmdbId}/${season}/${episode}/vostfr?autoplay=1`,
        hoster: 'vidzy',
        language: 'vostfr',
      });
    }

    // 4. Frembed & Cinesrc TV
    vf.push({
      name: 'Webflix Frembed (VF)',
      url: `https://frembed.cyou/api/serie.php?id=${tmdbId}&sa=${season}&epi=${episode}`,
      hoster: 'frembed',
      language: 'vf',
      type: 'webflix',
    });
    vostfr.push({
      name: 'Webflix Cinesrc (VOSTFR)',
      url: `https://cinesrc.st/embed/tv/${tmdbId}?s=${season}&e=${episode}`,
      hoster: 'cinesrc',
      language: 'vostfr',
      type: 'webflix',
    });

    if (!vf.length && !vostfr.length) {
      return res.status(404).json({ success: false, error: `S${season}E${episode} non disponible sur Webflix` });
    }

    const result = {
      success: true,
      source: 'webflix',
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

// ─── GET /api/webflix/tv/:tmdbId/season/:season/episode/:episode ─────────────
router.get('/tv/:tmdbId/season/:season/episode/:episode', (req, res) => {
  const { tmdbId, season, episode } = req.params;
  return handleTv(tmdbId, season, episode, req, res);
});

// ─── GET /api/webflix/tv/:tmdbId?season=&episode= ─────────────────────────────
router.get('/tv/:tmdbId', (req, res) => {
  const { tmdbId } = req.params;
  const season = req.query.season || req.query.s;
  const episode = req.query.episode || req.query.e;
  return handleTv(tmdbId, season, episode, req, res);
});

// ─── GET /api/webflix/discovery/:tmdbId ──────────────────────────────────────
router.get('/discovery/:tmdbId', async (req, res) => {
  const { tmdbId } = req.params;
  if (!tmdbId) return res.status(400).json({ error: 'tmdbId requis' });

  const cacheKey = `discovery:${tmdbId}`;
  const cached = getCached(cacheKey);
  if (cached) return res.json(cached);

  try {
    const resp = await webflixClient.get(`${WEBFLIX_BASE}/api/series-season-discovery?tmdb_id=${tmdbId}`);
    if (resp.status === 200 && resp.data) {
      setCached(cacheKey, resp.data);
      return res.json(resp.data);
    }
    return res.status(404).json({ success: false, error: 'Série introuvable sur Webflix' });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
