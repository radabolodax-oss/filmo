/**
 * FRAnime route module.
 * Parses franime.fr public sitemap to resolve slug + anime_id from an anime name.
 *
 * Mounted as: app.use('/api/franime', require('./routes/franime'));
 */

const express = require('express');
const router = express.Router();
const axios = require('axios');

let _sitemapData = null;
let _sitemapFetchedAt = 0;
const SITEMAP_TTL = 6 * 60 * 60 * 1000; // 6h

function slugify(name) {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

// Retire les marqueurs de saison/partie et articles courants avant slugification
function normalizeTitle(name) {
  return name
    .replace(/\s*:\s*.+$/, '')           // sous-titre après ":"
    .replace(/\b(saison|season|partie|part|cour)\s*\d+\b/gi, '')
    .replace(/\b(le|la|les|l|un|une|the|a|an)\b/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function wordOverlapScore(slugA, slugB) {
  const wordsA = new Set(slugA.split('-').filter(w => w.length > 1));
  const wordsB = new Set(slugB.split('-').filter(w => w.length > 1));
  if (!wordsA.size || !wordsB.size) return 0;
  let overlap = 0;
  for (const w of wordsA) if (wordsB.has(w)) overlap++;
  return overlap / Math.max(wordsA.size, wordsB.size);
}

async function loadSitemap() {
  const now = Date.now();
  if (_sitemapData && (now - _sitemapFetchedAt) < SITEMAP_TTL) {
    return _sitemapData;
  }

  try {
    const response = await axios.get('https://franime.fr/sitemap_animes.txt', {
      timeout: 10000,
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
    });

    const lines = response.data.split('\n').map(l => l.trim()).filter(Boolean);
    const data = {};

    for (const line of lines) {
      try {
        const url = new URL(line);
        const parts = url.pathname.split('/').filter(Boolean);
        const slug = parts[parts.length - 1];
        const animeId = url.searchParams.get('anime_id');
        const lang = url.searchParams.get('lang');

        if (!slug || !animeId) continue;

        if (!data[slug]) {
          data[slug] = { slug, animeId, langs: [] };
        }
        if (lang && !data[slug].langs.includes(lang)) {
          data[slug].langs.push(lang);
        }
      } catch {}
    }

    _sitemapData = data;
    _sitemapFetchedAt = now;
    console.log(`[FRAnime] Sitemap loaded: ${Object.keys(data).length} animes`);
    return data;
  } catch (err) {
    console.error('[FRAnime] Failed to load sitemap:', err.message);
    return _sitemapData || {};
  }
}

// GET /api/franime/lookup?q=<anime_name>
// Returns { slug, animeId, langs } or 404
router.get('/lookup', async (req, res) => {
  const query = req.query.q;
  if (!query) return res.status(400).json({ error: 'Missing q parameter' });

  try {
    const data = await loadSitemap();
    const rawQuery = decodeURIComponent(query);
    const targetSlug = slugify(rawQuery);
    const normalSlug = slugify(normalizeTitle(rawQuery));

    const slugKeys = Object.keys(data);

    // 1. Exact match (original ou normalisé)
    if (data[targetSlug]) return res.json(data[targetSlug]);
    if (normalSlug !== targetSlug && data[normalSlug]) return res.json(data[normalSlug]);

    // 2. Prefix notre slug → franime (ex: "dr-stone" → "dr-stone-science-future")
    const prefixMatch = slugKeys.find(k => k.startsWith(targetSlug + '-'))
      ?? (normalSlug !== targetSlug ? slugKeys.find(k => k.startsWith(normalSlug + '-')) : null);
    if (prefixMatch) return res.json(data[prefixMatch]);

    // 3. Prefix franime → notre slug (ex: "boruto" ↔ "boruto-naruto-next-generations")
    const reversePrefixMatch = slugKeys.find(k => targetSlug.startsWith(k + '-'))
      ?? (normalSlug !== targetSlug ? slugKeys.find(k => normalSlug.startsWith(k + '-')) : null);
    if (reversePrefixMatch) return res.json(data[reversePrefixMatch]);

    // 4. Substring (l'un contient l'autre)
    const containsMatch = slugKeys.find(k => targetSlug.includes(k) || k.includes(targetSlug))
      ?? (normalSlug !== targetSlug
        ? slugKeys.find(k => normalSlug.includes(k) || k.includes(normalSlug))
        : null);
    if (containsMatch) return res.json(data[containsMatch]);

    // 5. Meilleur score de recouvrement de mots (seuil 0.6)
    let bestKey = null;
    let bestScore = 0.6;
    for (const k of slugKeys) {
      const score = Math.max(
        wordOverlapScore(targetSlug, k),
        wordOverlapScore(normalSlug, k)
      );
      if (score > bestScore) { bestScore = score; bestKey = k; }
    }
    if (bestKey) return res.json(data[bestKey]);

    return res.status(404).json({ error: 'Anime not found on FRAnime' });
  } catch (err) {
    console.error('[FRAnime] Lookup error:', err.message);
    return res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/franime/episode?anime_id=X&s=1&ep=1&lang=vf
// Returns { players: [watch2url, ...] } — one URL per lecteur (0-indexed internally)
router.get('/episode', async (req, res) => {
  const { anime_id, s = '1', ep = '1', lang = 'vf' } = req.query;
  if (!anime_id) return res.status(400).json({ error: 'Missing anime_id' });

  const seasonIdx = Math.max(0, parseInt(s) - 1);
  const epIdx    = Math.max(0, parseInt(ep) - 1);
  const headers  = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Referer': 'https://franime.fr/',
    'Origin': 'https://franime.fr',
  };

  const players = [];
  for (let l = 0; l <= 6; l++) {
    try {
      const apiUrl = `https://api.franime.fr/api/anime/${anime_id}/${seasonIdx}/${l}/${lang}/${epIdx}`;
      const r = await axios.get(apiUrl, { timeout: 5000, headers });
      const url = typeof r.data === 'string' ? r.data.trim() : '';
      if (url.includes('/watch2/')) {
        players.push(url);
      } else {
        break;
      }
    } catch {
      break;
    }
  }

  if (!players.length) {
    return res.status(404).json({ error: 'Épisode non disponible sur FRAnime' });
  }
  return res.json({ players });
});

// GET /api/franime/reload-sitemap (force refresh)
router.post('/reload-sitemap', async (req, res) => {
  _sitemapData = null;
  _sitemapFetchedAt = 0;
  try {
    const data = await loadSitemap();
    res.json({ success: true, count: Object.keys(data).length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
