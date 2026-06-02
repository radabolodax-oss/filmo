/**
 * Proxy routes — contournement des restrictions iframe et ajout des cookies session.
 * Mounted at /proxy
 */

const express = require('express');
const axios = require('axios');
const router = express.Router();

const { getCurrentSession } = require('./purstream');

const PURSTREAM_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36';

// Headers upstream bloquant le chargement en iframe — écrasés par les nôtres
const STRIP_HEADERS = new Set([
  'x-frame-options',
  'content-security-policy',
  'content-security-policy-report-only',
  'x-content-type-options',
  'access-control-allow-origin',
  'access-control-allow-credentials',
]);

// Preflight CORS
router.options('/purstream', (_req, res) => {
  res.setHeader('Access-Control-Allow-Origin', 'http://localhost:3000');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.sendStatus(204);
});

/**
 * GET /proxy/purstream?id={base64}
 *
 * Proxifie https://purstream.ac/watch/{id} côté serveur avec le cookie de session.
 * Injecte <base href="https://purstream.ac/"> pour résoudre les URL relatives.
 * Pose les bons headers pour autoriser le chargement en iframe depuis localhost:3000.
 */
router.get('/purstream', async (req, res) => {
  const { id } = req.query;
  if (!id) return res.status(400).send('Paramètre id manquant');

  try {
    const upstream = await axios.get(`https://purstream.ac/watch/${encodeURIComponent(id)}`, {
      timeout: 15000,
      responseType: 'text',
      maxRedirects: 5,
      headers: {
        'Cookie': `purstream_session=${getCurrentSession()}`,
        'User-Agent': PURSTREAM_UA,
        'Referer': 'https://purstream.ac/',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'fr-FR,fr;q=0.9,en;q=0.8',
      },
    });

    // Copier les headers upstream sauf ceux qu'on écrase
    Object.entries(upstream.headers).forEach(([key, value]) => {
      if (!STRIP_HEADERS.has(key.toLowerCase())) {
        try { res.setHeader(key, value); } catch (_) {}
      }
    });

    // Injecter <base> pour corriger les URL relatives dans la page proxifiée
    let html = upstream.data;
    if (html.includes('<head>')) {
      html = html.replace('<head>', '<head><base href="https://purstream.ac/">');
    } else if (html.includes('<head ')) {
      html = html.replace(/<head([^>]*)>/, '<head$1><base href="https://purstream.ac/">');
    }

    // Headers posés EN DERNIER pour écraser ceux de purstream.ac
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('X-Frame-Options', 'ALLOWALL');
    res.setHeader('Content-Security-Policy', "frame-ancestors 'self' http://localhost:3000 http://localhost:25565;");
    res.setHeader('Access-Control-Allow-Origin', 'http://localhost:3000');
    res.setHeader('Access-Control-Allow-Credentials', 'true');

    res.send(html);
  } catch (err) {
    const status = err.response?.status || 502;
    console.error(`[PROXY/PURSTREAM] Erreur ${status}: ${err.message}`);
    res.status(status).send(`Erreur proxy Purstream: ${err.message}`);
  }
});

module.exports = router;
