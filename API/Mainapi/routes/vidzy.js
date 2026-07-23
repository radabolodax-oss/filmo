/**
 * Vidzy routes — récupère les embed URLs Vidzy via french-stream.ac (public, sans auth).
 * Mount point: app.use('/api/vidzy', router)
 *
 *   GET /api/vidzy/movie/:tmdbId
 *   GET /api/vidzy/tv/:tmdbId?season=&episode=
 */

const express = require('express');
const router = express.Router();
const axios = require('axios');

const TMDB_API_KEY = process.env.TMDB_API_KEY || '';
const TMDB_BASE = 'https://api.themoviedb.org/3';
const FS_BASE = process.env.FSTREAM_BASE_URL || 'https://french-stream.ac';

const fsAxios = axios.create({
  timeout: 9000,
  headers: {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    'X-Requested-With': 'XMLHttpRequest',
    'Referer': FS_BASE + '/',
  },
});

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
  // Retourne tous les résultats avec title et newsid
  const results = [];
  const re = /onclick="location\.href='\/(\d+)-([^'"]+)'"/g;
  const titleRe = /class='search-title'>([^<]+)</g;
  const hrefs = [...data.matchAll(/location\.href='\/(\d+)-([^'"]+)'/g)];
  const titles = [...data.matchAll(/class='search-title'>([^<]+)</g)];
  hrefs.forEach((m, i) => {
    results.push({ newsid: m[1], slug: m[2], title: titles[i]?.[1]?.trim() || '' });
  });
  return results;
}

// Film: film_api.php → cherche toutes les keys Vidzy connues
async function getMovieVidzy(newsid) {
  const { data } = await fsAxios.get(`${FS_BASE}/engine/ajax/film_api.php?id=${newsid}`);
  const v = data?.players?.vidzy;
  if (!v) return null;
  return v.vff || v.vf || v.default || v.hd || v.fhd || v.sd || Object.values(v).find(Boolean) || null;
}

// Série: episodes_p.php → essaye les deux formats de clé (3 et 03)
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

// Mots significatifs du titre (ignore les mots courts : articles, prépositions…)
function titleWords(normTitle) {
  return normTitle.split(' ').filter(w => w.length > 2);
}

// Sélectionne le meilleur résultat de recherche pour un film (pas de "saison" dans le titre)
function pickMovieMatch(results, normTitle) {
  const words = titleWords(normTitle);
  // 1) tous les mots significatifs correspondent
  const full = results.find(r => !r.title.toLowerCase().includes('saison') && words.length > 0 && words.every(w => normalize(r.title).includes(w)));
  if (full) return full;
  // 2) les deux premiers mots suffisent
  const two = results.find(r => !r.title.toLowerCase().includes('saison') && words.slice(0, 2).every(w => normalize(r.title).includes(w)));
  if (two) return two;
  // 3) premier mot significatif (longueur > 3 pour éviter "the", "les"…)
  const fw = words.find(w => w.length > 3);
  if (fw) {
    const one = results.find(r => !r.title.toLowerCase().includes('saison') && normalize(r.title).includes(fw));
    if (one) return one;
  }
  return results[0];
}

// Sélectionne le meilleur résultat pour une saison précise
function pickSeasonMatch(results, normTitle, season) {
  const words = titleWords(normTitle);
  const seasonStr = `saison ${season}`;
  // 1) saison + tous les mots
  const full = results.find(r => normalize(r.title).includes(seasonStr) && words.every(w => normalize(r.title).includes(w)));
  if (full) return full;
  // 2) saison + 2 premiers mots
  const two = results.find(r => normalize(r.title).includes(seasonStr) && words.slice(0, 2).every(w => normalize(r.title).includes(w)));
  if (two) return two;
  // 3) saison + premier mot significatif
  const fw = words.find(w => w.length > 3);
  if (fw) {
    const one = results.find(r => normalize(r.title).includes(seasonStr) && normalize(r.title).includes(fw));
    if (one) return one;
  }
  // 4) n'importe quel résultat avec "saison N" (au moins la bonne saison)
  const anySeason = results.find(r => normalize(r.title).includes(seasonStr));
  if (anySeason) return anySeason;
  // 5) titre sans filtre saison (séries sans numéro explicite de saison)
  const titleOnly = results.find(r => words.slice(0, 2).every(w => normalize(r.title).includes(w)));
  if (titleOnly) return titleOnly;
  return results[0];
}

// ─── GET /api/vidzy/movie/:tmdbId ─────────────────────────────────────────────
router.get('/movie/:tmdbId', async (req, res) => {
  const { tmdbId } = req.params;
  try {
    const title = await getTmdbTitle(tmdbId, 'movie');
    if (!title) return res.status(404).json({ error: 'Film introuvable sur TMDB' });

    const results = await searchFStream(title);
    if (!results.length) return res.status(404).json({ error: 'Film introuvable sur french-stream' });

    const match = pickMovieMatch(results, normalize(title));

    const embedUrl = await getMovieVidzy(match.newsid);
    if (!embedUrl) return res.status(404).json({ error: 'Pas de lecteur Vidzy pour ce film' });

    res.json({ embedUrl: embedUrl, newsid: match.newsid, source: 'vidzy' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── GET /api/vidzy/tv/:tmdbId?season=&episode= ───────────────────────────────
router.get('/tv/:tmdbId', async (req, res) => {
  const { tmdbId } = req.params;
  const season = parseInt(req.query.season, 10);
  const episode = parseInt(req.query.episode, 10);
  if (!season || !episode) return res.status(400).json({ error: 'Paramètres season et episode requis' });

  try {
    const title = await getTmdbTitle(tmdbId, 'tv');
    if (!title) return res.status(404).json({ error: 'Série introuvable sur TMDB' });

    const results = await searchFStream(title);
    if (!results.length) return res.status(404).json({ error: 'Série introuvable sur french-stream' });

    const match = pickSeasonMatch(results, normalize(title), season);

    const embedUrl = await getEpisodeVidzy(match.newsid, episode);
    if (!embedUrl) return res.status(404).json({ error: `Pas de lecteur Vidzy pour S${String(season).padStart(2,'0')}E${String(episode).padStart(2,'0')}` });

    res.json({ embedUrl: embedUrl, newsid: match.newsid, source: 'vidzy' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
