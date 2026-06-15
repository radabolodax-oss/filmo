const https = require('https');
const http = require('http');

const TMDB_ID = '76600'; // Avatar 2
const S = 1, E = 1;

const providers = [
  { name: 'Peachify (film)',      url: `https://peachify.top/embed/movie/${TMDB_ID}?sub=French&accent=dc2626` },
  { name: 'Vidsrc.to (film)',     url: `https://vidsrc.to/embed/movie/${TMDB_ID}` },
  { name: 'Vidsrc.io (film)',     url: `https://vidsrc.io/embed/movie?tmdb=${TMDB_ID}` },
  { name: 'Vidsrc.su (film)',     url: `https://vidsrc.su/embed/movie/${TMDB_ID}` },
  { name: 'Vidsrc.wtf/1 (film)', url: `https://vidsrc.wtf/api/1/movie/?id=${TMDB_ID}` },
  { name: 'Vidsrc.wtf/3 (film)', url: `https://vidsrc.wtf/api/3/movie/?id=${TMDB_ID}` },
  { name: 'Vidsrc.wtf/5 (film)', url: `https://vidsrc.wtf/api/5/movie/?id=${TMDB_ID}` },
  { name: 'Vidlink (film)',       url: `https://vidlink.pro/movie/${TMDB_ID}` },
  { name: 'Videasy (film)',       url: `https://player.videasy.net/movie/${TMDB_ID}` },
  { name: 'Embed.su (film)',      url: `https://embed.su/embed/movie/${TMDB_ID}` },
  { name: '2Embed (film)',        url: `https://www.2embed.cc/embed/${TMDB_ID}` },
];

function checkUrl(name, url) {
  return new Promise((resolve) => {
    const mod = url.startsWith('https') ? https : http;
    const req = mod.request(url, { method: 'GET', timeout: 6000, headers: { 'User-Agent': 'Mozilla/5.0' } }, (res) => {
      resolve({ name, url, status: res.statusCode, ok: res.statusCode < 400 });
      res.resume();
    });
    req.on('timeout', () => { req.destroy(); resolve({ name, url, status: 'TIMEOUT', ok: false }); });
    req.on('error', (e) => { resolve({ name, url, status: e.code || 'ERROR', ok: false }); });
    req.end();
  });
}

(async () => {
  const results = await Promise.all(providers.map(p => checkUrl(p.name, p.url)));
  console.log('\n=== RÉSULTATS ===');
  results.forEach(r => {
    const icon = r.ok ? '✅' : '❌';
    console.log(`${icon} ${r.name.padEnd(25)} → ${r.status}`);
  });
})();
