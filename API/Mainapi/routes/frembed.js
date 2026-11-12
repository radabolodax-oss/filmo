/**
 * Frembed routes — utilise frembed.uno et résout un serveur fonctionnel (sans playmogo 403)
 * avec fallback propre sur /embed/...
 * Mount point: app.use('/api/frembed', router)
 *
 *   GET /api/frembed/movie/:tmdbId            → { embedUrl, fallbackEmbedUrl, servers }
 *   GET /api/frembed/tv/:tmdbId?sa=1&epi=1    → { embedUrl, fallbackEmbedUrl, servers }
 */

const express = require('express');
const router = express.Router();
const axios = require('axios');

const FREMBED_API_BASE = process.env.FREMBED_API_BASE || 'https://frembed.uno';
const FREMBED_EMBED_BASE = process.env.FREMBED_EMBED_BASE || `${FREMBED_API_BASE}/embed`;
const BLOCKED_HOSTS = ['playmogo.com', 'streamtales.cc', 'fsvid'];

const frembedClient = axios.create({
  timeout: 4000,
  headers: {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
    'Referer': `${FREMBED_API_BASE}/`,
  },
  maxRedirects: 0,
  validateStatus: () => true,
});

const frembedCache = new Map();
const CACHE_TTL_MS = 20 * 60 * 1000;

async function resolveStreamUrl(candidatePath) {
  try {
    let current = candidatePath.startsWith('http') ? candidatePath : `${FREMBED_API_BASE}${candidatePath}`;
    for (let hop = 0; hop < 2; hop++) {
      const resp = await frembedClient.get(current);
      if (resp.status >= 300 && resp.status < 400 && resp.headers.location) {
        current = new URL(resp.headers.location, current).toString();
        continue;
      }
      if (resp.status >= 400 || resp.status === 0) return null;
      break;
    }
    const lower = current.toLowerCase();
    if (lower.includes('/api/stream')) return null;
    if (BLOCKED_HOSTS.some((b) => lower.includes(b))) return null;
    const check = await axios.get(current, {
      timeout: 3500,
      headers: { Referer: `${FREMBED_API_BASE}/`, 'User-Agent': 'Mozilla/5.0' },
      validateStatus: () => true,
    });
    if (!check || check.status >= 400) return null;
    return current;
  } catch {
    return null;
  }
}

async function resolveFrembed(apiUrl, fallbackEmbedUrl, cacheKey) {
  const cached = frembedCache.get(cacheKey);
  if (cached && Date.now() - cached.ts < CACHE_TTL_MS) {
    return cached.data;
  }

  try {
    const resp = await axios.get(apiUrl, {
      timeout: 4500,
      headers: { Referer: `${FREMBED_API_BASE}/`, 'User-Agent': 'Mozilla/5.0', Accept: 'application/json' },
      validateStatus: () => true,
    });
    if (resp.status === 200 && resp.data && typeof resp.data === 'object') {
      const json = resp.data;
      const candidates = [];
      if (Array.isArray(json.links)) {
        for (const item of json.links) {
          if (item && item.url) {
            candidates.push({
              label: item.label || item.host?.name || 'Serveur',
              lang: String(item.lang || 'vf').toLowerCase(),
              path: item.url,
            });
          }
        }
      }
      for (const k of ['link1', 'link2', 'link3', 'link4', 'link5', 'link6', 'link7', 'link1vostfr', 'link2vostfr', 'link3vostfr']) {
        if (typeof json[k] === 'string' && json[k]) {
          candidates.push({
            label: k,
            lang: k.includes('vostfr') ? 'vostfr' : 'vf',
            path: json[k],
          });
        }
      }

      const resolved = await Promise.all(
        candidates.slice(0, 8).map(async (c) => {
          const url = await resolveStreamUrl(c.path);
          return url ? { label: c.label, lang: c.lang, url } : null;
        })
      );
      const servers = [];
      const seen = new Set();
      for (const srv of resolved) {
        if (!srv || seen.has(srv.url)) continue;
        seen.add(srv.url);
        servers.push(srv);
      }

      if (servers.length > 0) {
        const best = servers.find((s) => s.lang === 'vf') || servers[0];
        const out = { success: true, embedUrl: best.url, fallbackEmbedUrl, servers };
        frembedCache.set(cacheKey, { ts: Date.now(), data: out });
        return out;
      }
    }
  } catch {}

  return { success: false, embedUrl: fallbackEmbedUrl, fallbackEmbedUrl, servers: [] };
}

// GET /api/frembed/movie/:tmdbId
router.get('/movie/:tmdbId', async (req, res) => {
  const { tmdbId } = req.params;
  const fallback = `${FREMBED_EMBED_BASE}/movie/${tmdbId}`;
  const data = await resolveFrembed(`${FREMBED_API_BASE}/api/films?id=${tmdbId}&idType=tmdb`, fallback, `movie:${tmdbId}`);
  res.json(data);
});

// GET /api/frembed/tv/:tmdbId?sa=1&epi=1
router.get('/tv/:tmdbId', async (req, res) => {
  const { tmdbId } = req.params;
  const { sa, epi } = req.query;
  const qs = sa && epi ? `?sa=${sa}&epi=${epi}` : '';
  const fallback = `${FREMBED_EMBED_BASE}/serie/${tmdbId}${qs}`;
  const apiQs = sa && epi ? `&sa=${sa}&epi=${epi}` : '';
  const data = await resolveFrembed(`${FREMBED_API_BASE}/api/series?id=${tmdbId}&idType=tmdb${apiQs}`, fallback, `tv:${tmdbId}:${sa || ''}=${epi || ''}`);
  res.json(data);
});

module.exports = router;
