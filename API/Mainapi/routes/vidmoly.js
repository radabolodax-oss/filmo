const express = require('express');
const axios   = require('axios');
const router  = express.Router();

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36';

/**
 * GET /api/vidmoly/watch?url={encodedEmbedUrl}
 *
 * Extrait le file_code depuis l'URL embed Vidmoly, puis appelle directement
 * https://sw.vidmoly.me/v1/watch?file_code={code} pour obtenir le flux .m3u8.
 * Plus rapide et fiable que le scraping HTML.
 */
router.get('/watch', async (req, res) => {
  const { url: rawUrl } = req.query;
  if (!rawUrl) return res.status(400).json({ error: 'Paramètre url requis' });

  const embedUrl = decodeURIComponent(rawUrl);

  // ex: vidmoly.to/embed-3ewug0syatdy.html → 3ewug0syatdy
  const match = embedUrl.match(/embed[-/]([a-zA-Z0-9]+)(?:\.html?)?/i);
  if (!match?.[1]) {
    return res.status(400).json({ error: `file_code introuvable dans l'URL: ${embedUrl}` });
  }
  const fileCode = match[1];

  try {
    const { data } = await axios.get(`https://sw.vidmoly.me/v1/watch?file_code=${fileCode}`, {
      headers: {
        'User-Agent': UA,
        'Referer':    'https://vidmoly.me/',
        'Origin':     'https://vidmoly.me',
        'Accept':     'application/json, */*',
      },
      timeout: 8000,
    });

    const streamUrl =
      data?.data?.file   ||
      data?.file         ||
      data?.url          ||
      data?.stream       ||
      data?.sources?.[0]?.file ||
      data?.sources?.[0]?.url  ||
      data?.result?.file ||
      null;

    if (!streamUrl) {
      return res.status(404).json({ error: 'Flux introuvable dans la réponse API Vidmoly' });
    }

    const type = String(streamUrl).includes('.m3u8') ? 'hls' : 'mp4';
    return res.json({ url: streamUrl, type });
  } catch (err) {
    return res.status(502).json({ error: `Erreur API Vidmoly: ${err.message}` });
  }
});

module.exports = router;
