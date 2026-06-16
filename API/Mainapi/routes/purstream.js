/**
 * PurStream routes module.
 * Proxy vers l'API PurStream pour récupérer les streams de films et séries.
 * Résolution TMDB → PurStream ID via recherche par titre + poster.
 * Cache fichier L2 + memoryCache L1 (pattern identique aux autres routes).
 * Pattern stale-while-revalidate : on sert le cache, on update en background.
 *
 * Mounted at /api/purstream
 */

const express = require('express');
const axios = require('axios');
const router = express.Router();
const { generateCacheKey, CACHE_DIR } = require('../utils/cacheManager');
const { fetchTmdbDetails, fetchTmdbImages } = require('../utils/tmdbCache');
const { pickRandomProxy, getProxyAgent } = require('../utils/proxyManager');

const PURSTREAM_BASE = 'https://api.purstream.ch/api/v1';
const PURSTREAM_CACHE_DIR = CACHE_DIR.PURSTREAM;

// ---------------------------------------------------------------------------
// Auth Purstream — Bearer token (prioritaire) + session cookie (fallback)
// Renouvellement automatique toutes les 90 minutes
// ---------------------------------------------------------------------------
let currentSession = process.env.PURSTREAM_SESSION || '';
let currentBearerToken = process.env.PURSTREAM_BEARER_TOKEN || '';
let _renewalInterval = null;

const PURSTREAM_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36';

/** Tente le login API JSON (→ Bearer token). Retourne le token ou null. */
async function tryApiLogin(email, password) {
  const endpoints = [
    'https://api.purstream.ch/api/v1/auth/login',
    'https://purstream.ch/api/v1/auth/login',
    'https://api.purstream.ch/api/v1/login',
  ];
  for (const url of endpoints) {
    try {
      const res = await axios.post(url, { email, password }, {
        timeout: 12000,
        validateStatus: s => s < 500,
        headers: {
          'User-Agent': PURSTREAM_UA,
          'Accept': 'application/json',
          'Content-Type': 'application/json',
          'Origin': 'https://purstream.ch',
          'Referer': 'https://purstream.ch/',
        },
      });
      const token = res.data?.token || res.data?.access_token || res.data?.api_token
        || res.data?.data?.token || res.data?.data?.access_token;
      if (res.status === 200 && token) {
        console.log(`[PURSTREAM] Bearer token obtenu via ${url}`);
        return token;
      }
    } catch {}
  }
  return null;
}

/** Se connecte sur purstream.ch et met à jour currentSession + tente d'obtenir currentBearerToken. */
async function loginPurstream() {
  const email = process.env.PURSTREAM_EMAIL;
  const password = process.env.PURSTREAM_PASSWORD;

  if (!email || !password) {
    console.warn('[PURSTREAM] PURSTREAM_EMAIL / PURSTREAM_PASSWORD absents — renouvellement désactivé');
    return false;
  }

  // 1. Essai login API JSON → Bearer token
  const apiToken = await tryApiLogin(email, password);
  if (apiToken) {
    currentBearerToken = apiToken;
    return true;
  }

  try {
    // 2. Fallback : login web form → session cookie
    const pageRes = await axios.get('https://purstream.ch/login', {
      timeout: 15000,
      headers: {
        'User-Agent': PURSTREAM_UA,
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
    });

    const tokenMatch = pageRes.data.match(/name="_token"[^>]+value="([^"]+)"/);
    if (!tokenMatch) throw new Error('Token CSRF introuvable dans la page de login');
    const csrfToken = tokenMatch[1];

    const initialCookies = (pageRes.headers['set-cookie'] || [])
      .map(c => c.split(';')[0])
      .join('; ');

    const body = new URLSearchParams({ _token: csrfToken, email, password }).toString();
    const loginRes = await axios.post('https://purstream.ch/login', body, {
      timeout: 15000,
      maxRedirects: 5,
      validateStatus: s => s < 500,
      headers: {
        'User-Agent': PURSTREAM_UA,
        'Content-Type': 'application/x-www-form-urlencoded',
        'Referer': 'https://purstream.ch/login',
        'Cookie': initialCookies,
      },
    });

    const setCookies = loginRes.headers['set-cookie'] || [];
    const sessionCookie = setCookies
      .map(c => c.match(/(?:purstream_session|session)=([^;]+)/))
      .find(Boolean)?.[1];

    if (!sessionCookie) throw new Error('Cookie purstream_session absent de la réponse login');
    currentSession = sessionCookie;

    // 3. Tenter d'obtenir le Bearer token via la session active
    const allCookies = [initialCookies, `purstream_session=${sessionCookie}`].filter(Boolean).join('; ');
    try {
      const userRes = await axios.get('https://api.purstream.ch/api/v1/user', {
        timeout: 10000,
        validateStatus: () => true,
        headers: {
          'User-Agent': PURSTREAM_UA,
          'Accept': 'application/json',
          'Origin': 'https://purstream.ch',
          'Referer': 'https://purstream.ch/',
          'Cookie': allCookies,
        },
      });
      const tok = userRes.data?.api_token || userRes.data?.token || userRes.data?.access_token;
      if (userRes.status === 200 && tok) {
        currentBearerToken = tok;
        console.log('[PURSTREAM] Bearer token extrait depuis /user');
      }
    } catch {}

    console.log('[PURSTREAM] Session renouvelée avec succès');
    return true;
  } catch (err) {
    console.error(`[PURSTREAM] Échec du renouvellement de session: ${err.message}`);
    return false;
  }
}

/** Démarre le renouvellement automatique (appel initial + setInterval 90 min). */
function startSessionRenewal() {
  if (_renewalInterval) return;
  loginPurstream().catch(() => {});
  _renewalInterval = setInterval(() => loginPurstream().catch(() => {}), 90 * 60 * 1000);
  if (_renewalInterval.unref) _renewalInterval.unref();
}

// ---------------------------------------------------------------------------
// Dependencies injected via configure()
// ---------------------------------------------------------------------------
let TMDB_API_KEY;
let TMDB_API_URL;
let PROXY_SERVER_URL;
let verifyAccessKey;
let getFromCacheNoExpiration;
let saveToCache;
let shouldUpdateCache;

function configure(deps) {
  if (deps.TMDB_API_KEY) TMDB_API_KEY = deps.TMDB_API_KEY;
  if (deps.TMDB_API_URL) TMDB_API_URL = deps.TMDB_API_URL;
  if (deps.PROXY_SERVER_URL) PROXY_SERVER_URL = deps.PROXY_SERVER_URL;
  if (deps.verifyAccessKey) verifyAccessKey = deps.verifyAccessKey;
  if (deps.getFromCacheNoExpiration) getFromCacheNoExpiration = deps.getFromCacheNoExpiration;
  if (deps.saveToCache) saveToCache = deps.saveToCache;
  if (deps.shouldUpdateCache) shouldUpdateCache = deps.shouldUpdateCache;
  startSessionRenewal();
}

/** Wrap une URL m3u8 dans le proxy cinep si VIP et PROXY_SERVER_URL configuré */
function wrapSourceUrl(url, isVip) {
  if (isVip && PROXY_SERVER_URL && url) {
    // PROXY_SERVER_URL = "https://proxy.movix.tax/proxy" → on veut la base sans /proxy
    const serverBase = PROXY_SERVER_URL.replace(/\/proxy\/?$/, '').replace(/\/+$/, '');
    return `${serverBase}/cinep-proxy?url=${encodeURIComponent(url)}`;
  }
  return url;
}

/** Fait une requête vers PurStream */
async function purstreamRequest(urlPath) {
  const proxy = pickRandomProxy();
  const agent = proxy ? getProxyAgent(proxy) : null;

  const headers = {
    'User-Agent': PURSTREAM_UA,
    'Accept': 'application/json',
    'Content-Type': 'application/json',
    'Origin': 'https://purstream.ch',
    'Referer': 'https://purstream.ch/',
  };
  if (currentBearerToken) {
    headers['Authorization'] = `Bearer ${currentBearerToken}`;
  } else if (currentSession) {
    headers['Cookie'] = `purstream_session=${currentSession}`;
  }

  return axios({
    url: `${PURSTREAM_BASE}${urlPath}`,
    method: 'get',
    timeout: 10000,
    headers,
    ...(agent ? { httpAgent: agent, httpsAgent: agent, proxy: false } : {}),
    decompress: true
  });
}

// Marqueur pour les résultats négatifs cachés
const NOT_FOUND_MARKER = { __not_found: true };

// ---------------------------------------------------------------------------
// Résolution TMDB ID → PurStream ID
// ---------------------------------------------------------------------------
async function resolvePurstreamId(tmdbId, type) {
  const cacheKey = generateCacheKey(`purstream_map_${type}_${tmdbId}`);

  const cached = await getFromCacheNoExpiration(PURSTREAM_CACHE_DIR, cacheKey);

  if (cached) {
    if (cached.__not_found) {
      const stale = await shouldUpdateCache(PURSTREAM_CACHE_DIR, cacheKey);
      if (stale) {
        backgroundUpdateMapping(tmdbId, type, cacheKey).catch(() => {});
      }
      return false; // not-found confirmé (déjà en cache) — distinct d'un échec transitoire
    }
    const stale = await shouldUpdateCache(PURSTREAM_CACHE_DIR, cacheKey);
    if (stale) {
      backgroundUpdateMapping(tmdbId, type, cacheKey).catch(() => {});
    }
    return cached;
  }

  return await fetchAndCacheMapping(tmdbId, type, cacheKey);
}

/** Fallback : lire le cache TMDB via la route interne (cache fichier Coflix) */
async function fetchTmdbFallback(tmdbId, type) {
  const port = process.env.PORT || 25565;
  try {
    const res = await axios.get(`http://localhost:${port}/api/tmdb/${type}/${tmdbId}`, {
      timeout: 8000,
      headers: { Accept: 'application/json' },
      validateStatus: () => true,
    });
    if (res.status !== 200) return null;
    const d = res.data?.tmdb_details || res.data;
    if (d && (d.title || d.name)) return d;
  } catch {}
  return null;
}

/**
 * Recherche et cache le mapping TMDB → PurStream.
 * Convention de retour : objet mapping (succès) | `false` (not-found confirmé,
 * mis en cache) | `null` (échec transitoire — réseau/TMDB/PurStream indisponible,
 * jamais mis en cache pour ne pas figer un faux négatif pendant 40 min).
 */
async function fetchAndCacheMapping(tmdbId, type, cacheKey) {
  let tmdbData = await fetchTmdbDetails(TMDB_API_URL, TMDB_API_KEY, tmdbId, type, 'fr-FR');
  if (!tmdbData) {
    tmdbData = await fetchTmdbFallback(tmdbId, type);
  }
  if (!tmdbData) {
    // Impossible de distinguer "ID TMDB invalide" d'un blip réseau/TMDB —
    // on traite comme transitoire pour ne pas caching un faux not_found.
    console.warn(`[PURSTREAM] TMDB ${type}:${tmdbId} introuvable (direct + cache interne) — traité comme transitoire`);
    return null;
  }

  const tmdbTitle = type === 'movie' ? tmdbData.title : tmdbData.name;
  const tmdbOriginalTitle = type === 'movie' ? tmdbData.original_title : tmdbData.original_name;
  if (!tmdbTitle) {
    console.warn(`[PURSTREAM] TMDB ${type}:${tmdbId} n'a pas de titre — traité comme transitoire`);
    return null;
  }

  // Collecter TOUS les posters TMDB (toutes langues, cache Redis intégré)
  const tmdbPosters = new Set();
  if (tmdbData.poster_path) tmdbPosters.add(tmdbData.poster_path);
  if (tmdbData.backdrop_path) tmdbPosters.add(tmdbData.backdrop_path);
  const imagesData = await fetchTmdbImages(TMDB_API_URL, TMDB_API_KEY, tmdbId, type);
  if (imagesData?.posters) {
    for (const p of imagesData.posters) {
      if (p.file_path) tmdbPosters.add(p.file_path);
    }
  }
  if (imagesData?.backdrops) {
    for (const b of imagesData.backdrops) {
      if (b.file_path) tmdbPosters.add(b.file_path);
    }
  }

  // Chercher sur PurStream (titre FR puis titre original si différent)
  const searchQueries = [tmdbTitle];
  if (tmdbOriginalTitle && tmdbOriginalTitle !== tmdbTitle) {
    searchQueries.push(tmdbOriginalTitle);
  }

  let allItems = [];
  let searchError = false;
  for (const query of searchQueries) {
    try {
      const response = await purstreamRequest(`/search-bar/search/${encodeURIComponent(query)}`);
      if (response.data?.type === 'success') {
        const searchData = response.data.data?.items || {};
        // Pour films : movies.items ; pour séries : series.items (plusieurs noms possibles)
        let items = [];
        if (type === 'movie') {
          items = searchData.movies?.items || [];
        } else {
          items = searchData.series?.items || searchData.shows?.items || searchData.tv?.items || searchData.tvShows?.items || [];
        }
        for (const item of items) {
          if (!allItems.some(existing => existing.id === item.id)) {
            allItems.push(item);
          }
        }
      }
    } catch (err) {
      searchError = true;
      console.warn(`[PURSTREAM] Recherche échouée pour "${query}": ${err.response?.status || err.message}`);
    }
  }

  // Erreur réseau/429/5xx → ne PAS cacher (résultat temporaire)
  if (allItems.length === 0 && searchError) {
    return null;
  }

  if (allItems.length === 0) {
    await saveToCache(PURSTREAM_CACHE_DIR, cacheKey, NOT_FOUND_MARKER);
    return false;
  }

  // Extraire posters PurStream
  const extractPosterPath = (url) => {
    if (!url) return '';
    const m = url.match(/\/([^/]+\.jpg)$/);
    return m ? `/${m[1]}` : '';
  };

  // Matcher strictement par type + poster TMDB
  const getPurstreamPosters = (item) => {
    const posters = new Set();
    const p1 = extractPosterPath(item.large_poster_path);
    const p2 = extractPosterPath(item.small_poster_path);
    const p3 = extractPosterPath(item.wallpaper_poster_path);
    if (p1) posters.add(p1);
    if (p2) posters.add(p2);
    if (p3) posters.add(p3);
    return posters;
  };

  const posterMatch = (item) => {
    if (tmdbPosters.size === 0) return false;
    const purPosters = getPurstreamPosters(item);
    for (const p of purPosters) {
      if (tmdbPosters.has(p)) return true;
    }
    return false;
  };

  // Poster match en priorité, puis fallback titre exact si pas de match poster
  let best = allItems.find(item => posterMatch(item));
  if (!best) {
    const normalizeTitle = s => s?.toLowerCase().replace(/[^a-z0-9]/g, '') || '';
    const tmdbNorm = normalizeTitle(tmdbTitle);
    const tmdbOrigNorm = normalizeTitle(tmdbOriginalTitle);
    best = allItems.find(item => {
      const itemNorm = normalizeTitle(item.title);
      return itemNorm === tmdbNorm || (tmdbOrigNorm && itemNorm === tmdbOrigNorm);
    });
  }

  if (!best) {
    console.warn(`[PURSTREAM] Aucun match pour ${type}:${tmdbId} "${tmdbTitle}"`);
    await saveToCache(PURSTREAM_CACHE_DIR, cacheKey, NOT_FOUND_MARKER);
    return false;
  }

  const result = { purstream_id: best.id, title: best.title, type: best.type };
  await saveToCache(PURSTREAM_CACHE_DIR, cacheKey, result);
  return result;
}

/** Revalidation background du mapping — ne jamais écraser un mapping valide par un échec */
async function backgroundUpdateMapping(tmdbId, type, cacheKey) {
  const existing = await getFromCacheNoExpiration(PURSTREAM_CACHE_DIR, cacheKey);
  const hasValidMapping = existing && !existing.__not_found && existing.purstream_id;

  try {
    const result = await fetchAndCacheMapping(tmdbId, type, cacheKey);
    if (!result && hasValidMapping) {
      await saveToCache(PURSTREAM_CACHE_DIR, cacheKey, existing);
    }
  } catch (err) {
    console.warn(`[PURSTREAM] BG mapping ${type}:${tmdbId} erreur: ${err.message}`);
    if (hasValidMapping) {
      await saveToCache(PURSTREAM_CACHE_DIR, cacheKey, existing);
    }
  }
}

/** Fetch stream depuis PurStream, retourne les sources ou marqueur erreur */
async function fetchStream(purstreamId, urlPath) {
  try {
    const response = await purstreamRequest(urlPath);
    if (response.data?.type !== 'success') return null;
    return response.data.data?.items || null;
  } catch (err) {
    console.warn(`[PURSTREAM] Erreur fetch stream purstream:${purstreamId}: ${err.response?.status || err.message}`);
    return { __error: true, status: err.response?.status || 0 };
  }
}

// ---------------------------------------------------------------------------
// GET /api/purstream/movie/:tmdbId/stream
// ---------------------------------------------------------------------------
router.get('/movie/:tmdbId/stream', async (req, res) => {
  try {
    const { tmdbId } = req.params;
    if (!tmdbId || isNaN(tmdbId)) return res.status(400).json({ error: 'TMDB ID invalide' });

    const accessKey = req.headers['x-access-key'] || null;
    const vipStatus = verifyAccessKey ? await verifyAccessKey(accessKey) : { vip: false };
    const isVip = vipStatus.vip;

    // Vérifier uniquement le marqueur not_found (pas les stream URLs — elles expirent)
    const notFoundKey = generateCacheKey(`purstream_nf_movie_${tmdbId}`);
    const nf = await getFromCacheNoExpiration(PURSTREAM_CACHE_DIR, notFoundKey);
    if (nf?.__not_found) {
      const stale = await shouldUpdateCache(PURSTREAM_CACHE_DIR, notFoundKey);
      if (!stale) return res.status(404).json({ error: 'Film non trouvé sur PurStream' });
    }

    const mapping = await resolvePurstreamId(tmdbId, 'movie');
    if (mapping === false) {
      await saveToCache(PURSTREAM_CACHE_DIR, notFoundKey, NOT_FOUND_MARKER);
      return res.status(404).json({ error: 'Film non trouvé sur PurStream' });
    }
    if (!mapping) {
      // Échec transitoire (TMDB/PurStream temporairement indisponible) — on ne
      // pollue pas le cache "non trouvé" avec un faux négatif, on réessaiera.
      return res.status(502).json({ error: 'Erreur temporaire lors de la résolution PurStream' });
    }

    const streamData = await fetchStream(mapping.purstream_id, `/stream/${mapping.purstream_id}`);

    if (streamData?.__error) {
      if (streamData.status === 404) {
        await saveToCache(PURSTREAM_CACHE_DIR, notFoundKey, NOT_FOUND_MARKER);
        return res.status(404).json({ error: 'Film non trouvé sur PurStream' });
      }
      return res.status(502).json({ error: 'Erreur temporaire PurStream' });
    }

    if (!streamData) return res.status(502).json({ error: 'Réponse invalide de PurStream' });

    const sources = streamData.sources || [];
    if (sources.length === 0) {
      await saveToCache(PURSTREAM_CACHE_DIR, notFoundKey, NOT_FOUND_MARKER);
      return res.status(404).json({ error: 'Aucun stream disponible pour ce film' });
    }

    const result = {
      purstream_id: mapping.purstream_id,
      sources: sources.map(s => ({ url: wrapSourceUrl(s.stream_url, isVip), name: s.source_name, format: s.format }))
    };
    res.json(result);
  } catch (error) {
    console.error('[PURSTREAM] Erreur stream film:', error.message);
    res.status(502).json({ error: 'Erreur lors de la récupération du stream' });
  }
});

// ---------------------------------------------------------------------------
// GET /api/purstream/tv/:tmdbId/stream?season=X&episode=Y
// ---------------------------------------------------------------------------
router.get('/tv/:tmdbId/stream', async (req, res) => {
  try {
    const { tmdbId } = req.params;
    const { season, episode } = req.query;

    if (!tmdbId || isNaN(tmdbId)) return res.status(400).json({ error: 'TMDB ID invalide' });
    if (!season || isNaN(season)) return res.status(400).json({ error: 'Le paramètre season est requis' });
    if (!episode || isNaN(episode)) return res.status(400).json({ error: 'Le paramètre episode est requis' });

    const accessKey = req.headers['x-access-key'] || null;
    const vipStatus = verifyAccessKey ? await verifyAccessKey(accessKey) : { vip: false };
    const isVip = vipStatus.vip;

    // Vérifier uniquement le marqueur not_found (pas les stream URLs — elles expirent)
    const notFoundKey = generateCacheKey(`purstream_nf_tv_${tmdbId}`);
    const nf = await getFromCacheNoExpiration(PURSTREAM_CACHE_DIR, notFoundKey);
    if (nf?.__not_found) {
      const stale = await shouldUpdateCache(PURSTREAM_CACHE_DIR, notFoundKey);
      if (!stale) return res.status(404).json({ error: 'Série non trouvée sur PurStream' });
    }

    const mapping = await resolvePurstreamId(tmdbId, 'tv');
    if (mapping === false) {
      await saveToCache(PURSTREAM_CACHE_DIR, notFoundKey, NOT_FOUND_MARKER);
      return res.status(404).json({ error: 'Série non trouvée sur PurStream' });
    }
    if (!mapping) {
      // Échec transitoire (TMDB/PurStream temporairement indisponible) — on ne
      // pollue pas le cache "non trouvé" avec un faux négatif, on réessaiera.
      return res.status(502).json({ error: 'Erreur temporaire lors de la résolution PurStream' });
    }

    const streamData = await fetchStream(mapping.purstream_id, `/stream/${mapping.purstream_id}/episode?season=${Number(season)}&episode=${Number(episode)}`);

    if (streamData?.__error) {
      if (streamData.status === 404) {
        await saveToCache(PURSTREAM_CACHE_DIR, notFoundKey, NOT_FOUND_MARKER);
        return res.status(404).json({ error: 'Épisode non trouvé sur PurStream' });
      }
      return res.status(502).json({ error: 'Erreur temporaire PurStream' });
    }

    if (!streamData) return res.status(502).json({ error: 'Réponse invalide de PurStream' });

    const sources = streamData.sources || [];
    if (sources.length === 0) {
      return res.status(404).json({ error: 'Aucun stream disponible pour cet épisode' });
    }

    const result = {
      purstream_id: mapping.purstream_id,
      season: streamData.season || Number(season),
      episode: streamData.episode || Number(episode),
      sources: sources.map(s => ({ url: wrapSourceUrl(s.stream_url, isVip), name: s.source_name, format: s.format }))
    };
    res.json(result);
  } catch (error) {
    console.error('[PURSTREAM] Erreur stream série:', error.message);
    res.status(502).json({ error: 'Erreur lors de la récupération du stream' });
  }
});

// ---------------------------------------------------------------------------
// Background updates — ne jamais écraser un cache valide par un échec
// ---------------------------------------------------------------------------
async function backgroundUpdateStreamMovie(tmdbId, cacheKey) {
  const existing = await getFromCacheNoExpiration(PURSTREAM_CACHE_DIR, cacheKey);
  const hasValidCache = existing && !existing.__not_found && existing.sources?.length > 0;

  try {
    const mapping = await resolvePurstreamId(tmdbId, 'movie');
    if (!mapping) return;

    const streamData = await fetchStream(mapping.purstream_id, `/stream/${mapping.purstream_id}`);

    if (!streamData || streamData.__error) return;

    const sources = streamData.sources || [];
    if (sources.length === 0 && hasValidCache) return;

    if (sources.length === 0) {
      await saveToCache(PURSTREAM_CACHE_DIR, cacheKey, NOT_FOUND_MARKER);
      return;
    }

    const result = {
      purstream_id: mapping.purstream_id,
      sources: sources.map(s => ({ url: s.stream_url, name: s.source_name, format: s.format }))
    };
    await saveToCache(PURSTREAM_CACHE_DIR, cacheKey, result);
  } catch (err) {
    // Silent fail — cache existant reste intact
  }
}

async function backgroundUpdateStreamTv(tmdbId, season, episode, cacheKey) {
  const existing = await getFromCacheNoExpiration(PURSTREAM_CACHE_DIR, cacheKey);
  const hasValidCache = existing && !existing.__not_found && existing.sources?.length > 0;

  try {
    const mapping = await resolvePurstreamId(tmdbId, 'tv');
    if (!mapping) return;

    const streamData = await fetchStream(mapping.purstream_id, `/stream/${mapping.purstream_id}/episode?season=${Number(season)}&episode=${Number(episode)}`);

    if (!streamData || streamData.__error) return;

    const sources = streamData.sources || [];
    if (sources.length === 0 && hasValidCache) return;

    if (sources.length === 0) {
      await saveToCache(PURSTREAM_CACHE_DIR, cacheKey, NOT_FOUND_MARKER);
      return;
    }

    const result = {
      purstream_id: mapping.purstream_id,
      season: streamData.season || Number(season),
      episode: streamData.episode || Number(episode),
      sources: sources.map(s => ({ url: s.stream_url, name: s.source_name, format: s.format }))
    };
    await saveToCache(PURSTREAM_CACHE_DIR, cacheKey, result);
  } catch (err) {
    // Silent fail — cache existant reste intact
  }
}

module.exports = router;
module.exports.configure = configure;
module.exports.getCurrentSession = () => currentSession;
module.exports.getCurrentBearerToken = () => currentBearerToken;
