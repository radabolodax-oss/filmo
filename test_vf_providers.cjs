const https = require('https');
const http = require('http');

const TMDB_ID = '76600'; // Avatar 2

const providers = [
  // VF actuels
  { name: 'Frembed',          url: `https://frembed.click/embed/movie/${TMDB_ID}` },
  { name: 'Frembed API',      url: `https://frembed.click/api/public/v1/movies/${TMDB_ID}` },
  // Candidats VF trouvés dans le dossier téléchargé
  { name: 'Peachify VF',      url: `https://peachify.top/embed/movie/${TMDB_ID}?sub=French&accent=dc2626` },
  { name: 'Vidsrc.su',        url: `https://vidsrc.su/embed/movie/${TMDB_ID}` },
  { name: 'Vidsrc.wtf/1',     url: `https://vidsrc.wtf/api/1/movie/?id=${TMDB_ID}` },
  { name: 'Vidsrc.wtf/3',     url: `https://vidsrc.wtf/api/3/movie/?id=${TMDB_ID}` },
  { name: 'Vidsrc.wtf/5',     url: `https://vidsrc.wtf/api/5/movie/?id=${TMDB_ID}` },
  // Autres candidats VF connus
  { name: 'Autoembed',        url: `https://autoembed.co/movie/tmdb/${TMDB_ID}` },
  { name: 'Multiembed',       url: `https://multiembed.mov/?video_id=${TMDB_ID}&tmdb=1` },
  { name: 'Moviesapi',        url: `https://moviesapi.club/movie/${TMDB_ID}` },
  { name: 'Filmix (embed)',   url: `https://filmix.ac/` },
  { name: 'Embedder',        url: `https://www.embedder.net/e/?tmdb=${TMDB_ID}` },
  { name: '111movies',        url: `https://111movies.com/movie/${TMDB_ID}` },
  { name: 'Smashystream',     url: `https://embed.smashystream.com/playere.php?tmdb=${TMDB_ID}` },
  { name: 'Nontonfilm',       url: `https://www.NontonFilm.net/embed/movie?id=${TMDB_ID}` },
];

function checkUrl(name, url) {
  return new Promise((resolve) => {
    const mod = url.startsWith('https') ? https : http;
    const req = mod.request(url, { method: 'GET', timeout: 7000, headers: { 'User-Agent': 'Mozilla/5.0' } }, (res) => {
      resolve({ name, status: res.statusCode, ok: res.statusCode < 400 });
      res.resume();
    });
    req.on('timeout', () => { req.destroy(); resolve({ name, status: 'TIMEOUT', ok: false }); });
    req.on('error', (e) => { resolve({ name, status: e.code || 'ERROR', ok: false }); });
    req.end();
  });
}

(async () => {
  const results = await Promise.all(providers.map(p => checkUrl(p.name, p.url)));
  console.log('\n=== RÉSULTATS VF ===');
  results.forEach(r => {
    const icon = r.ok ? '✅' : '❌';
    console.log(`${icon} ${r.name.padEnd(22)} → ${r.status}`);
  });
})();
