const https = require('https');

const TMDB_ID = '76600';

const providers = [
  { name: 'Autoembed',       url: `https://autoembed.co/movie/tmdb/${TMDB_ID}` },
  { name: 'Multiembed',      url: `https://multiembed.mov/?video_id=${TMDB_ID}&tmdb=1` },
  { name: 'Purestream',      url: `https://api.purstream.cc/api/v1` },
  { name: 'Nakios (API)',    url: `https://api.nakios.com/` },
  { name: 'Peachify',        url: `https://peachify.top/embed/movie/${TMDB_ID}?sub=French` },
  { name: 'Vidsrc.to',       url: `https://vidsrc.to/embed/movie/${TMDB_ID}` },
  { name: 'Vidsrc.su',       url: `https://vidsrc.su/embed/movie/${TMDB_ID}` },
  { name: 'Vidsrc.wtf',      url: `https://vidsrc.wtf/api/1/movie/?id=${TMDB_ID}` },
  // Candidats VF supplémentaires
  { name: 'Smashystream',    url: `https://embed.smashystream.com/playere.php?tmdb=${TMDB_ID}` },
  { name: 'Embedder',        url: `https://www.embedder.net/e/?tmdb=${TMDB_ID}` },
  { name: '111movies',       url: `https://111movies.com/movie/${TMDB_ID}` },
  { name: 'Movembed',        url: `https://movembed.cc/movie/${TMDB_ID}` },
  { name: 'Databasegdrive',  url: `https://databasegdriveplayer.xyz/player.php?tmdb=${TMDB_ID}` },
  { name: 'Filmxy',          url: `https://www.filmxy.vip/watch/?tmdb=${TMDB_ID}` },
];

function checkHeaders(name, url) {
  return new Promise((resolve) => {
    const req = https.request(url, { method: 'GET', timeout: 7000, headers: { 'User-Agent': 'Mozilla/5.0' } }, (res) => {
      const xfo = res.headers['x-frame-options'] || '';
      const csp = res.headers['content-security-policy'] || '';
      const hasFrameBlock = xfo.toLowerCase().includes('deny') || xfo.toLowerCase().includes('sameorigin');
      const hasCspBlock = csp.toLowerCase().includes('frame-ancestors') && !csp.includes('*');
      const blocked = hasFrameBlock || hasCspBlock;
      resolve({
        name,
        status: res.statusCode,
        ok: res.statusCode < 400,
        blocked,
        xfo: xfo || '-',
        csp: csp ? csp.substring(0, 80) : '-',
      });
      res.resume();
    });
    req.on('timeout', () => { req.destroy(); resolve({ name, status: 'TIMEOUT', ok: false, blocked: null }); });
    req.on('error', (e) => { resolve({ name, status: e.code || 'ERROR', ok: false, blocked: null }); });
    req.end();
  });
}

(async () => {
  const results = await Promise.all(providers.map(p => checkHeaders(p.name, p.url)));
  console.log('\n=== SANDBOX / IFRAME CHECK ===');
  console.log('✅ = OK  ❌ = mort  🚫 = X-Frame-Options bloqué\n');
  results.forEach(r => {
    if (!r.ok) {
      console.log(`❌ ${r.name.padEnd(20)} → ${r.status}`);
    } else if (r.blocked) {
      console.log(`🚫 ${r.name.padEnd(20)} → ${r.status} | XFO: ${r.xfo}`);
    } else {
      console.log(`✅ ${r.name.padEnd(20)} → ${r.status} | XFO: ${r.xfo}`);
    }
  });
})();
