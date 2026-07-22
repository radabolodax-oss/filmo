/**
 * Proxy routes — contournement des restrictions iframe et ajout des cookies session.
 * Mounted at /proxy
 */

const express = require('express');
const axios = require('axios');
const router = express.Router();

// Headers upstream bloquant le chargement en iframe — écrasés par les nôtres
const STRIP_HEADERS = new Set([
  'x-frame-options',
  'content-security-policy',
  'content-security-policy-report-only',
  'x-content-type-options',
  'access-control-allow-origin',
  'access-control-allow-credentials',
]);

/**
 * GET /proxy/fexini?slug={slug}[&season={n}&episode={n}]
 *
 * Proxifie https://fexini.net/watch/{slug}[/saison-{n}/episode-{n}] côté serveur.
 * Injecte <base href="https://fexini.net/"> et écrase X-Frame-Options pour l'iframe.
 */
router.get('/fexini', async (req, res) => {
  const { slug, season, episode } = req.query;
  if (!slug) return res.status(400).send('Paramètre slug manquant');

  let fexiniPath = `/watch/${slug}`;
  if (season && episode) {
    fexiniPath += `/saison-${season}/episode-${episode}`;
  }

  const fexiniUrl = `https://fexini.net${fexiniPath}`;
  const reqHeaders = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'Accept-Language': 'fr-FR,fr;q=0.9',
    'Referer': 'https://fexini.net/',
  };
  if (process.env.FEXINI_COOKIE) reqHeaders['Cookie'] = `fx_pres=${process.env.FEXINI_COOKIE}`;

  try {
    const upstream = await axios.get(fexiniUrl, {
      timeout: 15000,
      responseType: 'text',
      maxRedirects: 5,
      headers: reqHeaders,
    });

    Object.entries(upstream.headers).forEach(([key, value]) => {
      if (!STRIP_HEADERS.has(key.toLowerCase())) {
        try { res.setHeader(key, value); } catch (_) {}
      }
    });

    // Patch window.location avant tout JS Next.js : le router lit pathname/hostname
    // pour matcher ses routes. Sans ça, pathname = '/proxy/fexini' ne matche rien
    // et Next.js lève "Application error: a client-side exception".
    const locationPatch = `<script>(function(){var p=${JSON.stringify(fexiniPath)};try{Object.defineProperty(window,'location',{configurable:true,get:function(){var r=document.location;return{pathname:p,hostname:'fexini.net',host:'fexini.net',origin:'https://fexini.net',href:'https://fexini.net'+p,protocol:'https:',port:'',search:'',hash:'',replace:r.replace.bind(r),assign:r.assign.bind(r),reload:r.reload.bind(r),toString:function(){return'https://fexini.net'+p;}};}})}catch(e){}})();</script>`;

    let html = upstream.data;
    if (html.includes('<head>')) {
      html = html.replace('<head>', `<head><base href="https://fexini.net/">${locationPatch}`);
    } else if (html.includes('<head ')) {
      html = html.replace(/<head([^>]*)>/, `<head$1><base href="https://fexini.net/">${locationPatch}`);
    }

    // Les url() dans les <style> inline résolvent par rapport à l'URL du document (pas base href).
    // Réécrire /_next/ → https://fexini.net/_next/ pour que fonts/assets chargent depuis fexini.
    html = html.replace(/(<style[^>]*>)([\s\S]*?)(<\/style>)/gi, (_, open, content, close) =>
      open + content.replace(/url\((['"]?)\/_next\//g, (_, q) => `url(${q}https://fexini.net/_next/`) + close
    );

    const origin = req.headers.origin || '*';
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('X-Frame-Options', 'ALLOWALL');
    res.removeHeader('Content-Security-Policy');
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Credentials', 'true');

    res.send(html);
  } catch (err) {
    const status = err.response?.status || 502;
    console.error(`[PROXY/FEXINI] Erreur ${status}: ${err.message}`);
    res.status(status).send(`Erreur proxy Fexini: ${err.message}`);
  }
});

module.exports = router;
