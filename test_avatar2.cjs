const { chromium } = require('./node_modules/playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  await page.goto('http://localhost:3000', { waitUntil: 'networkidle', timeout: 20000 });

  // Click search icon
  const searchIcon = await page.$('[class*="search"], [aria-label*="earch"]');
  if (searchIcon) {
    await searchIcon.click();
    await page.waitForTimeout(500);
  }

  // Type in search
  const input = await page.$('input');
  if (input) {
    await input.focus();
    await input.type('avatar voie eau');
    await page.waitForTimeout(3000);
    await page.screenshot({ path: 'test_avatar_search.png' });

    // Find avatar link in results
    const avatarLink = await page.evaluate(() => {
      const links = Array.from(document.querySelectorAll('a[href*="/movie/"]'));
      const found = links.find(l => (l.textContent || '').toLowerCase().includes('avatar'));
      if (found) return found.href;
      // Return all links as fallback
      return links.slice(0,3).map(l => ({ href: l.href, text: (l.textContent||'').trim().slice(0,40) }));
    });
    console.log('Avatar search result:', JSON.stringify(avatarLink));

    const url = typeof avatarLink === 'string' ? avatarLink : null;
    if (url) {
      await page.goto(url, { waitUntil: 'networkidle', timeout: 20000 });
      await page.waitForTimeout(5000);

      const info = await page.evaluate(() => {
        const video = document.querySelector('video');
        const h1 = document.querySelector('h1');
        return {
          hasVideo: !!video,
          videoSrc: video ? video.src : null,
          networkState: video ? video.networkState : null,
          readyState: video ? video.readyState : null,
          title: h1 ? h1.textContent.trim().slice(0,80) : document.title.slice(0,80),
        };
      });
      console.log('\nPlayer info:', JSON.stringify(info, null, 2));
      await page.screenshot({ path: 'test_avatar_player.png' });
      console.log('Screenshot: test_avatar_player.png');
    }
  }

  await browser.close();
})().catch(e => console.error('FATAL:', e.message));
