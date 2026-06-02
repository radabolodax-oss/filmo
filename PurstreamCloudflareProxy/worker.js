/**
 * Purstream Cloudflare Worker — Proxy API de streaming
 *
 * Le Worker résout TMDB ID → Purstream ID → URL de flux (m3u8/mp4)
 * côté serveur avec le cookie de session, et renvoie le JSON au frontend.
 * Le frontend joue le flux dans son propre lecteur HLS (pas d'iframe).
 *
 * Routes :
 *   GET /stream?type=movie&tmdb={id}
 *   GET /stream?type=tv&tmdb={id}&season={s}&episode={e}
 *   GET /health
 *
 * Secrets requis :
 *   wrangler secret put PURSTREAM_SESSION
 *   wrangler secret put TMDB_API_KEY
 */

const PURSTREAM_API = 'https://api.purstream.ac/api/v1';
const TMDB_API     = 'https://api.themoviedb.org/3';
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36';

const CORS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
  'Access-Control-Allow-Headers': '*',
};

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS },
  });
}

/** Récupère le titre depuis TMDB */
async function getTmdbTitle(type, tmdbId, apiKey) {
  const endpoint = type === 'movie' ? `movie/${tmdbId}` : `tv/${tmdbId}`;
  const res = await fetch(`${TMDB_API}/${endpoint}?api_key=${apiKey}&language=fr-FR`);
  if (!res.ok) throw new Error(`TMDB ${res.status}`);
  const d = await res.json();
  return {
    title:         type === 'movie' ? d.title         : d.name,
    originalTitle: type === 'movie' ? d.original_title : d.original_name,
  };
}

/** Cherche le contenu sur Purstream et retourne son ID interne */
async function resolvePurstreamId(type, tmdbId, tmdbApiKey, session) {
  const { title, originalTitle } = await getTmdbTitle(type, tmdbId, tmdbApiKey);
  const queries = [title];
  if (originalTitle && originalTitle !== title) queries.push(originalTitle);

  const headers = {
    'Cookie':     `purstream_session=${session}`,
    'User-Agent': UA,
    'Accept':     'application/json',
    'Referer':    'https://purstream.ac/',
  };

  for (const query of queries) {
    const res = await fetch(
      `${PURSTREAM_API}/search-bar/search/${encodeURIComponent(query)}`,
      { headers }
    );
    if (!res.ok) continue;
    const data = await res.json();
    const items = data.data?.items?.movies?.items || [];
    const match = items.find(item => item.type === type);
    if (match) return match.id;
  }

  throw new Error(`"${title}" introuvable sur Purstream`);
}

/** Récupère les sources de flux depuis l'API Purstream (films uniquement) */
async function fetchPurstreamStream(purstreamId, _type, _season, _episode, session) {
  const path = `/stream/${purstreamId}`;

  const res = await fetch(`${PURSTREAM_API}${path}`, {
    headers: {
      'Cookie':     `purstream_session=${session}`,
      'User-Agent': UA,
      'Accept':     'application/json',
      'Referer':    'https://purstream.ac/',
    },
  });

  if (!res.ok) throw new Error(`Stream API ${res.status}`);
  const data = await res.json();
  if (data.type !== 'success') throw new Error(data.message || 'Purstream API error');

  const sources = data.data?.items?.sources || [];
  if (sources.length === 0) throw new Error('Aucune source disponible');

  return sources.map(s => ({
    url:    s.stream_url,
    name:   s.source_name,
    format: s.format || 'hls',
  }));
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: { ...CORS, 'Access-Control-Max-Age': '86400' } });
    }

    if (url.pathname === '/health') {
      return json({ status: 'ok', worker: 'purstream-proxy' });
    }

    // ── Route principale : /stream ──────────────────────────────────────────
    if (url.pathname === '/stream') {
      const session    = env.PURSTREAM_SESSION;
      const tmdbApiKey = env.TMDB_API_KEY;

      if (!session)    return json({ error: 'PURSTREAM_SESSION secret manquant' }, 500);
      if (!tmdbApiKey) return json({ error: 'TMDB_API_KEY secret manquant' }, 500);

      const type   = url.searchParams.get('type');
      const tmdbId = url.searchParams.get('tmdb');

      if (type !== 'movie') return json({ error: 'Purstream ne supporte que type=movie' }, 400);
      if (!tmdbId)          return json({ error: 'Paramètre tmdb requis' }, 400);

      try {
        const purstreamId = await resolvePurstreamId('movie', tmdbId, tmdbApiKey, session);
        const sources     = await fetchPurstreamStream(purstreamId, 'movie', null, null, session);
        return json({ sources });
      } catch (err) {
        console.error('[PURSTREAM]', err.message);
        return json({ error: err.message }, 502);
      }
    }

    return json({ error: 'Not Found' }, 404);
  },
};
