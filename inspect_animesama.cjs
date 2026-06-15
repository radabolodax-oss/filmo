const { chromium } = require('playwright');
const https = require('https');

function get(url) {
  return new Promise((res, rej) => {
    https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' } }, r => {
      let d = '';
      r.on('data', c => d += c);
      r.on('end', () => { try { res(JSON.parse(d)); } catch(e) { res(d.slice(0, 3000)); } });
    }).on('error', e => res('ERROR: ' + e.message));
  });
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.setExtraHTTPHeaders({ 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36' });

  const requests = [];
  page.on('request', req => {
    const url = req.url();
    if (!url.includes('google') && !url.includes('font') && !url.includes('analytics')) {
      requests.push({ url: url.slice(0, 200), method: req.method() });
    }
  });

  await page.goto('https://anime-sama.to/', { waitUntil: 'networkidle', timeout: 25000 });
  await page.waitForTimeout(3000);
  await page.screenshot({ path: 'C:/Users/PC/Desktop/prowler/MovixOpenSource-main/animesama_home.png' });

  const pageText = await page.evaluate(() => document.body.innerText.slice(0, 1000));
  console.log('Page text:', pageText);

  const links = await page.evaluate(() =>
    Array.from(document.querySelectorAll('a')).map(a => ({ href: a.href, text: a.textContent.trim().slice(0, 40) }))
      .filter(l => l.href.includes('anime-sama') && l.href.length > 30).slice(0, 15)
  );
  console.log('Links:', JSON.stringify(links, null, 2));

  // Try to navigate to an anime
  if (links.length > 0) {
    const animeLink = links.find(l => l.href.includes('/catalogue/')) || links[0];
    if (animeLink) {
      await page.goto(animeLink.href, { waitUntil: 'networkidle', timeout: 20000 });
      await page.waitForTimeout(3000);
      await page.screenshot({ path: 'C:/Users/PC/Desktop/prowler/MovixOpenSource-main/animesama_anime.png' });
      const animeText = await page.evaluate(() => document.body.innerText.slice(0, 2000));
      console.log('Anime page text:', animeText);
    }
  }

  console.log('\nRequests:', JSON.stringify(requests.slice(0, 30), null, 2));

  // Try API endpoints
  const apis = [
    'https://anime-sama.to/api/search?q=naruto',
    'https://anime-sama.to/api/anime?slug=naruto-shippuden',
    'https://anime-sama.to/catalogue/naruto-shippuden/saison1/vf/',
  ];
  for (const url of apis) {
    const r = await get(url);
    console.log(`\nAPI ${url}:`, typeof r === 'string' ? r.slice(0, 500) : JSON.stringify(r).slice(0, 500));
  }

  await browser.close();
})().catch(e => { console.error(e.message); process.exit(1); });
