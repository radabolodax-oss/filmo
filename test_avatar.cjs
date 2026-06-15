const { chromium } = require('./node_modules/playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  // Search for Avatar
  console.log('Searching for Avatar...');
  await page.goto('http://localhost:3000', { waitUntil: 'networkidle', timeout: 20000 });

  // Try to find search input
  const searchInput = await page.$('input[type="search"], input[placeholder*="earch"], input[placeholder*="echerch"], input[type="text"]');
  if (searchInput) {
    await searchInput.click();
    await searchInput.type('avatar la voie de l eau');
    await page.waitForTimeout(2000);
    const results = await page.evaluate(() => {
      return Array.from(document.querySelectorAll('a[href*="/movie/"]')).slice(0, 5).map(l => ({ href: l.href, text: l.textContent.trim().slice(0, 60) }));
    });
    console.log('Search results:', JSON.stringify(results, null, 2));
    if (results.length > 0) {
      await page.goto(results[0].href, { waitUntil: 'networkidle', timeout: 20000 });
      await page.waitForTimeout(4000);
    }
  } else {
    // Try direct TMDB search via API to find Avatar 2
    console.log('No search input found, using TMDB API...');
    const tmdbRes = await page.evaluate(async () => {
      const r = await fetch('https://api.themoviedb.org/3/search/movie?query=Avatar+Way+of+Water&language=fr-FR&api_key=' + (window.__VITE_TMDB_API_KEY__ || ''));
      return r.ok ? r.json() : null;
    });
    console.log('TMDB result:', tmdbRes ? JSON.stringify(tmdbRes.results && tmdbRes.results.slice(0,3)) : 'failed');
  }

  // Check current page for video
  const url = page.url();
  console.log('\nCurrent URL:', url);

  const playerInfo = await page.evaluate(() => {
    const video = document.querySelector('video');
    const iframe = document.querySelector('iframe');
    const title = document.querySelector('h1, h2, [class*="title"]');
    return {
      hasVideo: !!video,
      videoSrc: video ? video.src : null,
      hasIframe: !!iframe,
      iframeSrc: iframe ? iframe.src : null,
      pageTitle: title ? title.textContent.trim().slice(0, 80) : null,
    };
  });
  console.log('Player info:', JSON.stringify(playerInfo, null, 2));

  await page.screenshot({ path: 'test_avatar.png', fullPage: false });
  console.log('Screenshot saved.');

  await browser.close();
})().catch(e => console.error('FATAL:', e.message));
