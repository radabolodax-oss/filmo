const https = require('https');

// Teste les formats d'URL TV pour 111movies et smashystream
const urls = [
  { name: '111movies movie', url: 'https://111movies.com/movie/76600' },
  { name: '111movies tv',    url: 'https://111movies.com/tv/1396' },
  { name: '111movies tv s1', url: 'https://111movies.com/tv/1396/1/1' },
  { name: 'Smashystream movie', url: 'https://embed.smashystream.com/playere.php?tmdb=76600' },
  { name: 'Smashystream tv',    url: 'https://embed.smashystream.com/playere.php?tmdb=1396&season=1&episode=1' },
];

function check(name, url) {
  return new Promise((resolve) => {
    const req = https.request(url, { method: 'GET', timeout: 7000, headers: { 'User-Agent': 'Mozilla/5.0' } }, (res) => {
      const xfo = res.headers['x-frame-options'] || '-';
      resolve({ name, status: res.statusCode, ok: res.statusCode < 400, xfo });
      res.resume();
    });
    req.on('timeout', () => { req.destroy(); resolve({ name, status: 'TIMEOUT', ok: false }); });
    req.on('error', e => resolve({ name, status: e.code, ok: false }));
    req.end();
  });
}

(async () => {
  const results = await Promise.all(urls.map(u => check(u.name, u.url)));
  results.forEach(r => console.log(`${r.ok ? '✅' : '❌'} ${r.name.padEnd(25)} → ${r.status} | XFO: ${r.xfo}`));
})();
