/**
 * Moviez API route — Ad-free multi-language streaming resolver & HLS extractor.
 * Mount point: app.use('/api/moviez', router)
 *
 *   GET /api/moviez/movie/:tmdbId
 *   GET /api/moviez/tv/:tmdbId?season=1&episode=1
 *   GET /api/moviez/tv/:tmdbId/season/:season/episode/:episode
 *   GET /api/moviez/stream?url=...
 */

const express = require('express');
const router = express.Router();
const axios = require('axios');

const MOVIEZ_BASE = 'https://api.moviez.ac';
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 heure
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

const moviezClient = axios.create({
  timeout: 5000,
  headers: {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
    'Referer': `${MOVIEZ_BASE}/`,
    'Accept-Language': 'fr-FR,fr;q=0.9,en-US;q=0.8,en;q=0.7',
  },
  validateStatus: () => true, // Don't throw on 404
});

/**
 * Vérifie si une URL Moviez est disponible et valide
 */
async function checkAvailability(url) {
  try {
    const resp = await moviezClient.get(url);
    if (resp.status === 200 && typeof resp.data === 'string' && resp.data.includes('window.P2')) {
      return { available: true, html: resp.data };
    }
    return { available: false, html: null };
  } catch (e) {
    return { available: false, html: null, error: e.message };
  }
}

// ─── GET /api/moviez/movie/:tmdbId ───────────────────────────────────────────
router.get('/movie/:tmdbId', async (req, res) => {
  const { tmdbId } = req.params;
  if (!tmdbId) return res.status(400).json({ error: 'tmdbId requis' });

  const cacheKey = `movie:${tmdbId}`;
  const cached = getCached(cacheKey);
  if (cached) return res.json(cached);

  const vfUrl = `${MOVIEZ_BASE}/${tmdbId}?lang=vf&autoplay=1`;
  const vostfrUrl = `${MOVIEZ_BASE}/${tmdbId}?lang=vostfr&autoplay=1`;

  try {
    const [vfCheck, vostfrCheck] = await Promise.all([
      checkAvailability(vfUrl),
      checkAvailability(vostfrUrl),
    ]);

    const players = { vf: [], vostfr: [] };

    if (vfCheck.available) {
      players.vf.push({
        name: 'Moviez VF',
        url: vfUrl,
        hoster: 'moviez',
        language: 'vf',
        type: 'moviez',
      });
    }

    if (vostfrCheck.available) {
      players.vostfr.push({
        name: 'Moviez VOSTFR',
        url: vostfrUrl,
        hoster: 'moviez',
        language: 'vostfr',
        type: 'moviez',
      });
    }

    if (!players.vf.length && !players.vostfr.length) {
      return res.status(404).json({
        success: false,
        error: 'Film non disponible sur Moviez',
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
async function handleTv(tmdbId, season, episode, res) {
  if (!tmdbId || !season || !episode) {
    return res.status(400).json({ error: 'Paramètres tmdbId, season et episode requis' });
  }

  const cacheKey = `tv:${tmdbId}:${season}:${episode}`;
  const cached = getCached(cacheKey);
  if (cached) return res.json(cached);

  const vfUrl = `${MOVIEZ_BASE}/serie/${tmdbId}/${season}/${episode}?lang=vf&autoplay=1`;
  const vostfrUrl = `${MOVIEZ_BASE}/serie/${tmdbId}/${season}/${episode}?lang=vostfr&autoplay=1`;

  try {
    const [vfCheck, vostfrCheck] = await Promise.all([
      checkAvailability(vfUrl),
      checkAvailability(vostfrUrl),
    ]);

    const players = { vf: [], vostfr: [] };

    if (vfCheck.available) {
      players.vf.push({
        name: 'Moviez VF',
        url: vfUrl,
        hoster: 'moviez',
        language: 'vf',
        type: 'moviez',
      });
    }

    if (vostfrCheck.available) {
      players.vostfr.push({
        name: 'Moviez VOSTFR',
        url: vostfrUrl,
        hoster: 'moviez',
        language: 'vostfr',
        type: 'moviez',
      });
    }

    if (!players.vf.length && !players.vostfr.length) {
      return res.status(404).json({
        success: false,
        error: `Épisode S${season}E${episode} non disponible sur Moviez`,
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
  return handleTv(tmdbId, season, episode, res);
});

// ─── GET /api/moviez/tv/:tmdbId?season=&episode= ──────────────────────────────
router.get('/tv/:tmdbId', (req, res) => {
  const { tmdbId } = req.params;
  const season = req.query.season || req.query.s;
  const episode = req.query.episode || req.query.e;
  return handleTv(tmdbId, season, episode, res);
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
