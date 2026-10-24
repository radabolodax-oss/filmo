const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
  const page = await browser.newPage();

  const slowReqs = [];
  const pending = new Map();

  page.on('request', req => { pending.set(req.url(), Date.now()); });
  page.on('response', async resp => {
    const url = resp.url();
    const start = pending.get(url);
    if (start) {
      const dur = Date.now() - start;
      const size = parseInt(resp.headers()['content-length'] || '0');
      if (dur > 200 || size > 100000) {
        slowReqs.push({ dur, size, status: resp.status(), url: url.replace('http://localhost:3000','[fe]').replace('http://localhost:25565','[api]').substring(0,120) });
      }
      pending.delete(url);
    }
  });

  const t0 = Date.now();
  try { await page.goto('http://localhost:3000', { waitUntil: 'networkidle', timeout: 35000 }); }
  catch(e) {}
  console.log('Total: ' + (Date.now()-t0) + 'ms');
  console.log('\n=== Slow/heavy resources (>200ms or >100KB) ===');
  slowReqs.sort((a,b) => b.dur - a.dur).slice(0,20).forEach(r =>
    console.log(r.dur + 'ms  ' + Math.round(r.size/1024) + 'KB  ' + r.url)
  );

  await browser.close();
})().catch(e => console.error(e.message));
