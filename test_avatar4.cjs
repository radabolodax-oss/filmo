const { chromium } = require('./node_modules/playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  // Direct URL found from search
  const avatarUrl = 'http://localhost:3000/movie/4aQ8JEc1Qi8ny54rtzK8Kb1Qy64iKTWQOGex0';
  console.log('Navigating to Avatar:', avatarUrl);

  await page.goto(avatarUrl, { waitUntil: 'networkidle', timeout: 20000 });
  await page.waitForTimeout(5000);

  const info = await page.evaluate(() => {
    const video = document.querySelector('video');
    const iframe = document.querySelector('iframe');
    const h1 = document.querySelector('h1');
    // networkState: 0=EMPTY, 1=IDLE, 2=LOADING, 3=NO_SOURCE
    // readyState: 0=HAVE_NOTHING, 1=HAVE_METADATA, 2=HAVE_CURRENT_DATA, 3=HAVE_FUTURE_DATA, 4=HAVE_ENOUGH_DATA
    return {
      hasVideo: !!video,
      videoSrc: video ? video.src : null,
      networkState: video ? video.networkState : null,
      readyState: video ? video.readyState : null,
      hasIframe: !!iframe,
      iframeSrc: iframe ? iframe.src : null,
      title: h1 ? h1.textContent.trim().slice(0, 80) : document.title,
    };
  });

  console.log('Player info:', JSON.stringify(info, null, 2));
  await page.screenshot({ path: 'test_avatar_player.png' });
  console.log('Screenshot saved: test_avatar_player.png');

  await browser.close();
})().catch(e => console.error('FATAL:', e.message));
