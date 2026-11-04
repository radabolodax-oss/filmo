/**
 * FRAnime route module.
 * Parses franime.fr public sitemap to resolve slug + anime_id from an anime name.
 *
 * Mounted as: app.use('/api/franime', require('./routes/franime'));
 */

const express = require('express');
const router = express.Router();
const axios = require('axios');
const fs = require('fs');
const path = require('path');

let _sitemapData = null;
let _sitemapFetchedAt = 0;
const SITEMAP_TTL = 6 * 60 * 60 * 1000; // 6h

const LOCAL_SITEMAP_FILE = fs.existsSync(path.join(__dirname, 'franime_sitemap.json'))
  ? path.join(__dirname, 'franime_sitemap.json')
  : path.join(__dirname, '..', 'data', 'franime_sitemap.json');

function slugify(name) {
  return String(name || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function stripDashes(slug) {
  return String(slug || '').replace(/-/g, '');
}

// Retire les marqueurs de saison/partie et articles courants avant slugification
function normalizeTitle(name) {
  return String(name || '')
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

// Dictionnaire d'alias pour les animes dont le titre TMDB FR differe du catalogue FRAnime
const KNOWN_ALIASES = {
  'l-attaque-des-titans': 'attack-on-titan',
  'attaque-des-titans': 'attack-on-titan',
  'shingeki-no-kyojin': 'attack-on-titan',
  'dandadan': 'dan-da-dan',
  'one-piece': 'one-piece-kai',
  'boku-no-hero-academia': 'my-hero-academia',
  'nanatsu-no-taizai': 'the-seven-deadly-sins',
  'kage-no-jitsuryokusha-ni-naritakute': 'the-eminence-in-shadow',
  'moi-quand-je-me-reincarne-en-slime': 'that-time-i-got-reincarnated-as-a-slime',
  'tensei-shitara-slime-datta-ken': 'that-time-i-got-reincarnated-as-a-slime',
  'sono-bisque-doll-wa-koi-wo-suru': 'my-dress-up-darling',
  'tate-no-yuusha-no-nariagari': 'the-rising-of-the-shield-hero',
  'kimetsu-no-yaiba': 'demon-slayer-kimetsu-no-yaiba',
  'haikyu': 'haikyuu'
};

async function refreshSitemapOnline() {
  try {
    const response = await axios.get('https://franime.fr/sitemap_animes.txt', {
      timeout: 10000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
        'Accept': 'text/plain, */*'
      }
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

    if (Object.keys(data).length > 100) {
      _sitemapData = data;
      _sitemapFetchedAt = Date.now();
      console.log(`[FRAnime] Sitemap mis à jour en ligne: ${Object.keys(data).length} animes`);
      try {
        const dir = path.dirname(LOCAL_SITEMAP_FILE);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(LOCAL_SITEMAP_FILE, JSON.stringify(data, null, 2), 'utf8');
      } catch (_) {}
    }
  } catch (err) {
    console.warn('[FRAnime] Notice: rafraîchissement sitemap en ligne échoué, utilisation du cache local:', err.message);
  }
}

async function loadSitemap() {
  const now = Date.now();
  if (_sitemapData && (now - _sitemapFetchedAt) < SITEMAP_TTL) {
    return _sitemapData;
  }

  // 1. Tente de charger depuis le cache disque local (immédiat et 100% fiable)
  if (!_sitemapData && fs.existsSync(LOCAL_SITEMAP_FILE)) {
    try {
      _sitemapData = JSON.parse(fs.readFileSync(LOCAL_SITEMAP_FILE, 'utf8'));
      _sitemapFetchedAt = now;
      console.log(`[FRAnime] Base sitemap chargée depuis disque: ${Object.keys(_sitemapData).length} animes`);
    } catch (_) {}
  }

  // Si on a déjà les données du disque, rafraîchit en arrière-plan sans bloquer
  if (_sitemapData && Object.keys(_sitemapData).length > 0) {
    refreshSitemapOnline().catch(() => {});
    return _sitemapData;
  }

  // Sinon, attend le rafraîchissement en ligne
  await refreshSitemapOnline();
  return _sitemapData || {};
}

// Recherche intelligente d'un anime dans le sitemap
function findAnimeInSitemap(data, title, altTitle = '') {
  const titlesToTry = [title, altTitle].filter(Boolean);
  const slugKeys = Object.keys(data);

  for (const t of titlesToTry) {
    const rawQuery = decodeURIComponent(t).trim();
    const targetSlug = slugify(rawQuery);
    const normalSlug = slugify(normalizeTitle(rawQuery));

    // 0. Dictionnaire d'alias
    if (KNOWN_ALIASES[targetSlug] && data[KNOWN_ALIASES[targetSlug]]) return data[KNOWN_ALIASES[targetSlug]];
    if (KNOWN_ALIASES[normalSlug] && data[KNOWN_ALIASES[normalSlug]]) return data[KNOWN_ALIASES[normalSlug]];

    // 1. Exact match (original ou normalisé)
    if (data[targetSlug]) return data[targetSlug];
    if (normalSlug !== targetSlug && data[normalSlug]) return data[normalSlug];

    // 2. Match sans tirets (ex: "dandadan" <-> "dan-da-dan")
    const targetNoDash = stripDashes(targetSlug);
    const normalNoDash = stripDashes(normalSlug);
    const dashMatch = slugKeys.find(k => stripDashes(k) === targetNoDash || stripDashes(k) === normalNoDash);
    if (dashMatch) return data[dashMatch];

    // 3. Prefix match — priorise la série principale en évitant les films/spinoffs
    const wantsFilm = targetSlug.includes('film') || targetSlug.includes('movie');
    const prefixCandidate = slugKeys
      .filter(k => k.startsWith(targetSlug + '-') || k.startsWith(normalSlug + '-'))
      .sort((a, b) => {
        const aIsFilm = a.includes('-film') || a.includes('-movie') || a.includes('-3d-');
        const bIsFilm = b.includes('-film') || b.includes('-movie') || b.includes('-3d-');
        if (!wantsFilm && aIsFilm !== bIsFilm) return aIsFilm ? 1 : -1;
        return a.length - b.length;
      })[0];
    if (prefixCandidate) return data[prefixCandidate];

    // 4. Prefix inverse (ex: "boruto" ↔ "boruto-naruto-next-generations")
    const reversePrefixMatch = slugKeys.find(k => targetSlug.startsWith(k + '-'))
      ?? (normalSlug !== targetSlug ? slugKeys.find(k => normalSlug.startsWith(k + '-')) : null);
    if (reversePrefixMatch) return data[reversePrefixMatch];

    // 5. Substring (l'un contient l'autre, avec dé-priorisation des films)
    const subCandidates = slugKeys.filter(k => targetSlug.includes(k) || k.includes(targetSlug));
    if (subCandidates.length > 0) {
      const bestSub = subCandidates.sort((a, b) => {
        const aIsFilm = a.includes('-film') || a.includes('-movie');
        const bIsFilm = b.includes('-film') || b.includes('-movie');
        if (!wantsFilm && aIsFilm !== bIsFilm) return aIsFilm ? 1 : -1;
        return a.length - b.length;
      })[0];
      if (bestSub) return data[bestSub];
    }

    // 6. Meilleur score de recouvrement de mots (seuil 0.6)
    let bestKey = null;
    let bestScore = 0.6;
    for (const k of slugKeys) {
      const score = Math.max(
        wordOverlapScore(targetSlug, k),
        wordOverlapScore(normalSlug, k)
      );
      if (score > bestScore) { bestScore = score; bestKey = k; }
    }
    if (bestKey) return data[bestKey];
  }

  return null;
}

// GET /api/franime/lookup?q=<anime_name>&alt=<original_title>
// Returns { slug, animeId, langs } or 404
router.get('/lookup', async (req, res) => {
  const query = req.query.q;
  const alt = req.query.alt || req.query.original_title || '';
  if (!query) return res.status(400).json({ error: 'Missing q parameter' });

  try {
    const data = await loadSitemap();
    const match = findAnimeInSitemap(data, query, alt);

    if (match) {
      return res.json(match);
    }
    return res.status(404).json({ error: 'Anime non trouvé sur FRAnime' });
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
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
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

// POST /api/franime/reload-sitemap (force refresh)
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

router.loadSitemap = loadSitemap;
router.findAnimeInSitemap = findAnimeInSitemap;

module.exports = router;
