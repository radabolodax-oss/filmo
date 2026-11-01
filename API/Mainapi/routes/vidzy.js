/**
 * Vidzy routes — Résolveur hybride Vidzy :
 * 1. Vérification directe haute performance par ID TMDB (vidzy.org).
 * 2. Fallback via recherche French-Stream si non indexé directement.
 *
 * Mount point: app.use('/api/vidzy', router)
 *
 *   GET /api/vidzy/movie/:tmdbId
 *   GET /api/vidzy/tv/:tmdbId?season=&episode=
 *   GET /api/vidzy/tv/:tmdbId/season/:season/episode/:episode
 */

const express = require('express');
const router = express.Router();
const axios = require('axios');

const TMDB_API_KEY = process.env.TMDB_API_KEY || '';
const TMDB_BASE = 'https://api.themoviedb.org/3';
const FS_BASE = process.env.FSTREAM_BASE_URL || 'https://french-stream.ac';
const VIDZY_BASE = 'https://vidzy.org';

const vidzyClient = axios.create({
  timeout: 5000,
  headers: {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
    'Referer': 'https://miaw.tv/',
  },
  validateStatus: () => true,
});

const fsAxios = axios.create({
  timeout: 9000,
  headers: {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    'X-Requested-With': 'XMLHttpRequest',
    'Referer': FS_BASE + '/',
  },
});

const CACHE_TTL_MS = 60 * 60 * 1000;
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

async function checkVidzyDirect(url) {
  try {
    const resp = await vidzyClient.get(url);
    if (resp.status === 200 && typeof resp.data === 'string' && (resp.data.includes('embed-') || resp.data.includes('iframe'))) {
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

async function getTmdbTitle(tmdbId, type) {
  const url = `${TMDB_BASE}/${type}/${tmdbId}?api_key=${TMDB_API_KEY}&language=fr-FR`;
  const { data } = await axios.get(url, { timeout: 5000 });
  return type === 'movie' ? (data.title || data.original_title) : (data.name || data.original_name);
}

async function searchFStream(query) {
  const body = new URLSearchParams({ query, page: '1' });
  const { data } = await fsAxios.post(`${FS_BASE}/engine/ajax/search.php`, body.toString(), {
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  });
  const results = [];
  const hrefs = [...data.matchAll(/location\.href='\/(\d+)-([^'"]+)'/g)];
  const titles = [...data.matchAll(/class='search-title'>([^<]+)</g)];
  hrefs.forEach((m, i) => {
    results.push({ newsid: m[1], slug: m[2], title: titles[i]?.[1]?.trim() || '' });
  });
  return results;
}

async function getMovieVidzy(newsid) {
  const { data } = await fsAxios.get(`${FS_BASE}/engine/ajax/film_api.php?id=${newsid}`);
  const v = data?.players?.vidzy;
  if (!v) return null;
  return v.vff || v.vf || v.default || v.hd || v.fhd || v.sd || Object.values(v).find(Boolean) || null;
}

async function getEpisodeVidzy(newsid, episode) {
  const { data } = await fsAxios.get(`${FS_BASE}/engine/ajax/episodes_p.php?id=${newsid}`);
  const ep = String(episode);
  const epPad = String(episode).padStart(2, '0');
  const langs = ['vf', 'vostfr', 'vff', 'vo'];
  for (const lang of langs) {
    const found = data?.[lang]?.[ep]?.vidzy || data?.[lang]?.[epPad]?.vidzy;
    if (found) return found;
  }
  return null;
}

function normalize(s) {
  return (s || '').toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
}

function titleWords(normTitle) {
  return normTitle.split(' ').filter(w => w.length > 2);
}

function pickMovieMatch(results, normTitle) {
  const words = titleWords(normTitle);
  const full = results.find(r => !r.title.toLowerCase().includes('saison') && words.length > 0 && words.every(w => normalize(r.title).includes(w)));
  if (full) return full;
  const two = results.find(r => !r.title.toLowerCase().includes('saison') && words.slice(0, 2).every(w => normalize(r.title).includes(w)));
  if (two) return two;
  const fw = words.find(w => w.length > 3);
  if (fw) {
    const one = results.find(r => !r.title.toLowerCase().includes('saison') && normalize(r.title).includes(fw));
    if (one) return one;
  }
  return results[0];
}

function pickSeasonMatch(results, normTitle, season) {
  const words = titleWords(normTitle);
  const seasonStr = `saison ${season}`;
  const full = results.find(r => normalize(r.title).includes(seasonStr) && words.every(w => normalize(r.title).includes(w)));
  if (full) return full;
  const two = results.find(r => normalize(r.title).includes(seasonStr) && words.slice(0, 2).every(w => normalize(r.title).includes(w)));
  if (two) return two;
  const fw = words.find(w => w.length > 3);
  if (fw) {
    const one = results.find(r => normalize(r.title).includes(seasonStr) && normalize(r.title).includes(fw));
    if (one) return one;
  }
  const anySeason = results.find(r => normalize(r.title).includes(seasonStr));
  if (anySeason) return anySeason;
  const titleOnly = results.find(r => words.slice(0, 2).every(w => normalize(r.title).includes(w)));
  if (titleOnly) return titleOnly;
  return results[0];
}

// ─── GET /api/vidzy/movie/:tmdbId ─────────────────────────────────────────────
router.get('/movie/:tmdbId', async (req, res) => {
  const { tmdbId } = req.params;
  if (!tmdbId) return res.status(400).json({ error: 'tmdbId requis' });

  const cacheKey = `movie:${tmdbId}`;
  const cached = getCached(cacheKey);
  if (cached) return res.json(cached);

  const directVf = `${VIDZY_BASE}/movie/${tmdbId}/vf`;
  const directVostfr = `${VIDZY_BASE}/movie/${tmdbId}/vostfr`;

  try {
    // 1. Essai direct Vidzy par ID TMDB
    const [hasVf, hasVostfr] = await Promise.all([
      checkVidzyDirect(directVf),
      checkVidzyDirect(directVostfr),
    ]);

    if (hasVf || hasVostfr) {
      const players = { vf: [], vostfr: [] };
      if (hasVf) {
        players.vf.push({ name: 'Vidzy VF', url: directVf, hoster: 'vidzy', language: 'vf', type: 'vidzy' });
      }
      if (hasVostfr) {
        players.vostfr.push({ name: 'Vidzy VOSTFR', url: directVostfr, hoster: 'vidzy', language: 'vostfr', type: 'vidzy' });
      }

      const result = {
        success: true,
        source: 'vidzy',
        tmdbId: Number(tmdbId),
        players,
        embedUrl: hasVf ? directVf : directVostfr,
      };
      setCached(cacheKey, result);
      return res.json(result);
    }

    // 2. Fallback FrenchStream
    const title = await getTmdbTitle(tmdbId, 'movie');
    if (!title) return res.status(404).json({ success: false, error: 'Film introuvable sur TMDB' });

    const results = await searchFStream(title);
    if (!results.length) return res.status(404).json({ success: false, error: 'Film introuvable sur french-stream' });

    const match = pickMovieMatch(results, normalize(title));
    const embedUrl = await getMovieVidzy(match.newsid);
    if (!embedUrl) return res.status(404).json({ success: false, error: 'Pas de lecteur Vidzy pour ce film' });

    const result = {
      success: true,
      source: 'vidzy',
      tmdbId: Number(tmdbId),
      embedUrl,
      newsid: match.newsid,
      players: {
        vf: [{ name: 'Vidzy VF', url: embedUrl, hoster: 'vidzy', language: 'vf', type: 'vidzy' }],
        vostfr: [],
      },
    };
    setCached(cacheKey, result);
    res.json(result);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─── Helper TV ───────────────────────────────────────────────────────────────
async function handleTv(tmdbId, season, episode, res) {
  if (!tmdbId || !season || !episode) {
    return res.status(400).json({ error: 'Paramètres tmdbId, season et episode requis' });
  }

  const cacheKey = `tv:${tmdbId}:${season}:${episode}`;
  const cached = getCached(cacheKey);
  if (cached) return res.json(cached);

  const directVf = `${VIDZY_BASE}/serie/${tmdbId}/${season}/${episode}/vf`;
  const directVostfr = `${VIDZY_BASE}/serie/${tmdbId}/${season}/${episode}/vostfr`;

  try {
    // 1. Essai direct Vidzy par ID TMDB
    const [hasVf, hasVostfr] = await Promise.all([
      checkVidzyDirect(directVf),
      checkVidzyDirect(directVostfr),
    ]);

    if (hasVf || hasVostfr) {
      const players = { vf: [], vostfr: [] };
      if (hasVf) {
        players.vf.push({ name: 'Vidzy VF', url: directVf, hoster: 'vidzy', language: 'vf', type: 'vidzy' });
      }
      if (hasVostfr) {
        players.vostfr.push({ name: 'Vidzy VOSTFR', url: directVostfr, hoster: 'vidzy', language: 'vostfr', type: 'vidzy' });
      }

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
      return res.json(result);
    }

    // 2. Fallback FrenchStream
    const title = await getTmdbTitle(tmdbId, 'tv');
    if (!title) return res.status(404).json({ success: false, error: 'Série introuvable sur TMDB' });

    const results = await searchFStream(title);
    if (!results.length) return res.status(404).json({ success: false, error: 'Série introuvable sur french-stream' });

    const match = pickSeasonMatch(results, normalize(title), season);
    const embedUrl = await getEpisodeVidzy(match.newsid, episode);
    if (!embedUrl) {
      return res.status(404).json({
        success: false,
        error: `Pas de lecteur Vidzy pour S${String(season).padStart(2,'0')}E${String(episode).padStart(2,'0')}`,
      });
    }

    const result = {
      success: true,
      source: 'vidzy',
      tmdbId: Number(tmdbId),
      season: Number(season),
      episode: Number(episode),
      embedUrl,
      newsid: match.newsid,
      players: {
        vf: [{ name: 'Vidzy VF', url: embedUrl, hoster: 'vidzy', language: 'vf', type: 'vidzy' }],
        vostfr: [],
      },
    };
    setCached(cacheKey, result);
    res.json(result);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
}

// ─── GET /api/vidzy/tv/:tmdbId/season/:season/episode/:episode ──────────────
router.get('/tv/:tmdbId/season/:season/episode/:episode', (req, res) => {
  const { tmdbId, season, episode } = req.params;
  return handleTv(tmdbId, season, episode, res);
});

// ─── GET /api/vidzy/tv/:tmdbId?season=&episode= ───────────────────────────────
router.get('/tv/:tmdbId', (req, res) => {
  const { tmdbId } = req.params;
  const season = parseInt(req.query.season || req.query.s, 10);
  const episode = parseInt(req.query.episode || req.query.e, 10);
  return handleTv(tmdbId, season, episode, res);
});

module.exports = router;
