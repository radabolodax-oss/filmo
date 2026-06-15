const { chromium } = require('./node_modules/playwright');
const https = require('https');

function httpsGet(url) {
  return new Promise((resolve, reject) => {
    https.get(url, res => {
      let data = '';
      res.on('data', d => data += d);
      res.on('end', () => resolve(JSON.parse(data)));
    }).on('error', reject);
  });
}

(async () => {
  // Step 1: Find Avatar 2 on TMDB
  const TMDB_KEY = '21bd7c2bfbde3a1cd4f82dfbe7781f76';
  const searchResult = await httpsGet(`https://api.themoviedb.org/3/search/movie?query=Avatar+The+Way+of+Water&language=fr-FR&api_key=${TMDB_KEY}`);

  const avatar = searchResult.results && searchResult.results.find(m =>
    m.title.toLowerCase().includes('avatar') && m.release_date && m.release_date.startsWith('2022')
  );

  if (!avatar) {
    console.log('Avatar not found on TMDB. Results:', searchResult.results.slice(0,3).map(m => m.title));
    return;
  }

  console.log('Found:', avatar.title, '| TMDB ID:', avatar.id, '| Original title:', avatar.original_title);

  // Step 2: Encode the TMDB ID using the site's encoder
  // We need to navigate to the site and use its encoder
  // The site uses getTmdbEncodedId from idEncoder.ts
  // Let's find the encoded URL by looking at links on a search page

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  // Navigate to the site and search
  await page.goto('http://localhost:3000', { waitUntil: 'networkidle', timeout: 20000 });

  // Use the site's search by navigating to a search URL pattern
  await page.goto(`http://localhost:3000/search?q=Avatar+voie+eau`, { waitUntil: 'networkidle', timeout: 15000 });
  await page.waitForTimeout(2000);

  let avatarLink = await page.evaluate((tmdbId) => {
    // Look for any link, then check what's on page
    const allLinks = Array.from(document.querySelectorAll('a[href*="/movie/"]'));
    return allLinks.slice(0, 10).map(l => ({ href: l.href, text: (l.textContent || '').trim().slice(0, 60) }));
  }, avatar.id);

  console.log('\nSearch page links:', JSON.stringify(avatarLink, null, 2));

  // Try home search
  await page.goto('http://localhost:3000', { waitUntil: 'networkidle', timeout: 20000 });

  // Click the search button/icon
  await page.waitForTimeout(1000);

  // Try keyboard shortcut or search navigation
  await page.keyboard.press('Control+k');
  await page.waitForTimeout(500);

  const input = await page.$('input[type="search"], input[placeholder*="echerch"], input[placeholder*="earch"], input[placeholder*="ilm"]');
  if (!input) {
    // Try clicking any search-related element
    const searchTrigger = await page.$('[data-testid*="search"], button[aria-label*="earch"], a[href*="search"]');
    if (searchTrigger) {
      await searchTrigger.click();
      await page.waitForTimeout(500);
    }
  }

  const input2 = await page.$('input');
  if (input2) {
    await input2.focus();
    await page.keyboard.type('Avatar');
    await page.waitForTimeout(3000);

    await page.screenshot({ path: 'test_avatar_search2.png' });

    const links = await page.evaluate(() => {
      return Array.from(document.querySelectorAll('a[href*="/movie/"]')).slice(0, 10).map(l => ({
        href: l.href,
        text: (l.textContent || '').trim().slice(0, 60),
        img: (l.querySelector('img') || {}).alt || ''
      }));
    });
    console.log('\nSearch results with "Avatar":', JSON.stringify(links, null, 2));

    // Find the avatar link
    const found = links.find(l =>
      l.text.toLowerCase().includes('avatar') || l.img.toLowerCase().includes('avatar')
    );

    if (found) {
      const targetUrl = found.href.includes('autoplay') ? found.href : found.href + '?autoplay=true';
      console.log('\nNavigating to:', targetUrl);
      await page.goto(targetUrl, { waitUntil: 'networkidle', timeout: 20000 });
      await page.waitForTimeout(5000);

      const info = await page.evaluate(() => {
        const video = document.querySelector('video');
        const h1 = document.querySelector('h1');
        return {
          hasVideo: !!video,
          videoSrc: video ? video.src : null,
          networkState: video ? video.networkState : null,
          readyState: video ? video.readyState : null,
          title: h1 ? h1.textContent.trim().slice(0, 80) : document.title,
        };
      });
      console.log('\nPlayer info:', JSON.stringify(info, null, 2));
      await page.screenshot({ path: 'test_avatar_player.png' });
      console.log('Screenshot: test_avatar_player.png');
    } else {
      console.log('Avatar not found in search results');
    }
  }

  await browser.close();
})().catch(e => console.error('FATAL:', e.message));
