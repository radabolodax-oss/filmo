/**
 * Frembed routes — retourne directement l'URL embed sans appel API upstream.
 * Mount point: app.use('/api/frembed', router)
 *
 *   GET /api/frembed/movie/:tmdbId            → { embedUrl }
 *   GET /api/frembed/tv/:tmdbId?sa=1&epi=1    → { embedUrl }
 */

const express = require('express');
const router = express.Router();

const FREMBED_EMBED_BASE = process.env.FREMBED_EMBED_BASE || 'https://frembed.click/embed';

// GET /api/frembed/movie/:tmdbId
router.get('/movie/:tmdbId', (req, res) => {
  const { tmdbId } = req.params;
  res.json({ embedUrl: `${FREMBED_EMBED_BASE}/movie/${tmdbId}` });
});

// GET /api/frembed/tv/:tmdbId?sa=1&epi=1
router.get('/tv/:tmdbId', (req, res) => {
  const { tmdbId } = req.params;
  const { sa, epi } = req.query;
  let url = `${FREMBED_EMBED_BASE}/serie/${tmdbId}`;
  if (sa && epi) url += `?sa=${sa}&epi=${epi}`;
  res.json({ embedUrl: url });
});

module.exports = router;
