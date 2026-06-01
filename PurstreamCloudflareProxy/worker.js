/**
 * Purstream Cloudflare Worker — Reverse proxy avec réécriture HTML
 *
 * Méthode identique à MonFlix :
 * - Toutes les requêtes /* sont proxifiées vers purstream.ac
 * - Le HTML est réécrit : "https://purstream.ac" → URL du Worker
 *   => le navigateur charge assets/API via le Worker (CORS ok)
 * - Assets, JS, JSON : streaming direct + CORS headers
 *
 * Secret requis : wrangler secret put PURSTREAM_SESSION
 */

const UPSTREAM = 'https://purstream.ac';
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36';

const STRIP_REQUEST = new Set([
  'host', 'cf-connecting-ip', 'cf-ipcountry', 'cf-ray',
  'cf-visitor', 'x-forwarded-for', 'x-real-ip',
]);

const STRIP_RESPONSE = new Set([
  'x-frame-options',
  'content-security-policy',
  'content-security-policy-report-only',
  'strict-transport-security',
]);

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, HEAD, POST, OPTIONS',
  'Access-Control-Allow-Headers': '*',
  'Access-Control-Expose-Headers': 'Content-Length, Content-Range, Accept-Ranges',
};

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const workerOrigin = url.origin; // ex: https://purstream-proxy.radabolodax.workers.dev

    // Preflight CORS
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: { ...CORS, 'Access-Control-Max-Age': '86400' },
      });
    }

    // Santé
    if (url.pathname === '/health') {
      return new Response(JSON.stringify({ status: 'ok' }), {
        headers: { 'Content-Type': 'application/json', ...CORS },
      });
    }

    const session = env.PURSTREAM_SESSION;
    if (!session) {
      return new Response('PURSTREAM_SESSION secret non configuré', { status: 500, headers: CORS });
    }

    // URL upstream : même chemin + query que la requête reçue
    const targetUrl = `${UPSTREAM}${url.pathname}${url.search}`;

    // Headers upstream
    const upstreamHeaders = new Headers();
    for (const [key, value] of request.headers.entries()) {
      if (!STRIP_REQUEST.has(key.toLowerCase())) upstreamHeaders.set(key, value);
    }
    upstreamHeaders.set('Host', 'purstream.ac');
    upstreamHeaders.set('Cookie', `purstream_session=${session}`);
    upstreamHeaders.set('User-Agent', UA);
    upstreamHeaders.set('Referer', UPSTREAM + '/');
    upstreamHeaders.set('Origin', UPSTREAM);

    let upstream;
    try {
      upstream = await fetch(targetUrl, {
        method: request.method,
        headers: upstreamHeaders,
        body: ['GET', 'HEAD'].includes(request.method) ? undefined : request.body,
        redirect: 'follow',
      });
    } catch (err) {
      return new Response(`Erreur fetch: ${err.message}`, { status: 502, headers: CORS });
    }

    // Headers de réponse : copier upstream en filtrant les headers bloquants
    const responseHeaders = new Headers();
    for (const [key, value] of upstream.headers.entries()) {
      if (!STRIP_RESPONSE.has(key.toLowerCase())) responseHeaders.set(key, value);
    }
    // Poser CORS + iframe en dernier (écrasent ceux d'upstream)
    for (const [k, v] of Object.entries(CORS)) responseHeaders.set(k, v);
    responseHeaders.set('X-Frame-Options', 'ALLOWALL');
    responseHeaders.set('Content-Security-Policy', "frame-ancestors *;");

    const contentType = upstream.headers.get('Content-Type') || '';

    // HTML : réécrire "https://purstream.ac" → URL du Worker
    // => toutes les src/href/fetch() de la page pointeront vers le Worker
    if (contentType.includes('text/html')) {
      let html = await upstream.text();
      html = html.replaceAll(UPSTREAM, workerOrigin);
      responseHeaders.set('Content-Type', 'text/html; charset=utf-8');
      return new Response(html, { status: upstream.status, headers: responseHeaders });
    }

    // Tout le reste (JS, CSS, images, JSON, HLS…) : streaming direct sans modifier le contenu
    return new Response(upstream.body, { status: upstream.status, headers: responseHeaders });
  },
};
