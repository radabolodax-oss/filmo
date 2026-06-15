const { chromium } = require('playwright');
const https = require('https');

function get(url) {
  return new Promise((res) => {
    const req = https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' } }, r => {
      let d = '';
      r.on('data', c => d += c);
      r.on('end', () => { try { res(JSON.parse(d)); } catch(e) { res(d.slice(0, 3000)); } });
    });
    req.on('error', e => res('ERROR: ' + e.message));
    req.setTimeout(8000, () => { req.destroy(); res('TIMEOUT'); });
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
    if (!url.includes('google') && !url.includes('font') && !url.includes('analytics') && !url.includes('cloudflare') && !url.includes('turnstile')) {
      requests.push({ url: url.slice(0, 200), method: req.method() });
    }
  });

  // domcontentloaded instead of networkidle — much faster
  try {
    await page.goto('https://franime.fr/', { waitUntil: 'domcontentloaded', timeout: 15000 });
    await page.waitForTimeout(3000);
    await page.screenshot({ path: 'C:/Users/PC/Desktop/prowler/MovixOpenSource-main/franime_home.png' });
    const pageText = await page.evaluate(() => document.body.innerText.slice(0, 1500));
    console.log('Home text:', pageText);

    const links = await page.evaluate(() =>
      Array.from(document.querySelectorAll('a')).map(a => ({ href: a.href, text: a.textContent.trim().slice(0, 40) }))
        .filter(l => l.href.includes('franime.fr') && l.href.length > 25 && !l.href.endsWith('/')).slice(0, 20)
    );
    console.log('Links:', JSON.stringify(links, null, 2));

    // Navigate to first anime
    const animeLink = links.find(l => l.href.match(/\/anime\//i)) || links[0];
    if (animeLink) {
      console.log('\nNavigating to:', animeLink.href);
      await page.goto(animeLink.href, { waitUntil: 'domcontentloaded', timeout: 15000 });
      await page.waitForTimeout(3000);
      await page.screenshot({ path: 'C:/Users/PC/Desktop/prowler/MovixOpenSource-main/franime_anime.png' });
      console.log('Anime page text:', await page.evaluate(() => document.body.innerText.slice(0, 2000)));

      // Episode links
      const epLinks = await page.evaluate(() =>
        Array.from(document.querySelectorAll('a')).map(a => ({ href: a.href, text: a.textContent.trim().slice(0, 30) }))
          .filter(l => l.href.includes('franime.fr') && l.href.length > 25).slice(0, 10)
      );
      console.log('Episode links:', JSON.stringify(epLinks, null, 2));

      // Check for episode page
      const epLink = epLinks.find(l => l.href.match(/ep|episode|saison/i)) || epLinks[0];
      if (epLink && epLink.href !== animeLink.href) {
        console.log('\nNavigating to episode:', epLink.href);
        await page.goto(epLink.href, { waitUntil: 'domcontentloaded', timeout: 15000 });
        await page.waitForTimeout(4000);
        await page.screenshot({ path: 'C:/Users/PC/Desktop/prowler/MovixOpenSource-main/franime_episode.png' });
        console.log('Episode page text:', await page.evaluate(() => document.body.innerText.slice(0, 1500)));

        const iframes = await page.evaluate(() =>
          Array.from(document.querySelectorAll('iframe, video, source')).map(el => ({
            tag: el.tagName, src: el.src || el.getAttribute('src')
          }))
        );
        console.log('Iframes/videos:', JSON.stringify(iframes));
      }
    }
  } catch(e) {
    console.log('Browser error:', e.message);
  }

  console.log('\nAll requests:', JSON.stringify(requests.slice(0, 40), null, 2));

  // Try API endpoints
  const apis = [
    'https://franime.fr/api/animes',
    'https://franime.fr/api/anime',
    'https://franime.fr/api/search?q=naruto',
    'https://franime.fr/api/episodes',
    'https://api.franime.fr/anime',
    'https://api.franime.fr/animes',
  ];
  console.log('\n=== API TESTS ===');
  for (const url of apis) {
    const r = await get(url);
    const preview = typeof r === 'string' ? r.slice(0, 300) : JSON.stringify(r).slice(0, 300);
    console.log(`${url.split('franime.fr')[1]} -> ${preview}`);
  }

  await browser.close();
})().catch(e => console.error('Fatal:', e.message));
