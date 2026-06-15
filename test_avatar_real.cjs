const { chromium } = require('./node_modules/playwright');

(async () => {
  // headless: false to get real browser behavior for video
  const browser = await chromium.launch({ headless: false, args: ['--autoplay-policy=no-user-gesture-required'] });
  const page = await browser.newPage();

  // Capture console errors
  const errors = [];
  page.on('console', msg => { if (msg.type() === 'error') errors.push(msg.text()); });
  page.on('pageerror', e => errors.push('PAGEERROR: ' + e.message));

  // Capture network failures
  const netFails = [];
  page.on('requestfailed', req => {
    if (req.url().includes('fastflux') || req.url().includes('cdn.fastflux')) {
      netFails.push({ url: req.url(), failure: req.failure() && req.failure().errorText });
    }
  });

  await page.goto('http://localhost:3000/movie/4aQ8JEc1Qi8ny54rtzK8Kb1Qy64iKTWQOGex0', { waitUntil: 'networkidle', timeout: 20000 });
  await page.waitForTimeout(3000);

  await page.evaluate(() => {
    const v = document.querySelector('video');
    if (v) v.scrollIntoView({ behavior: 'instant', block: 'center' });
  });

  await page.waitForTimeout(5000);

  const info = await page.evaluate(() => {
    const video = document.querySelector('video');
    return {
      hasVideo: !!video,
      src: video ? video.src : null,
      networkState: video ? video.networkState : null,
      readyState: video ? video.readyState : null,
      error: video && video.error ? { code: video.error.code, message: video.error.message } : null,
    };
  });

  console.log('Video state:', JSON.stringify(info, null, 2));
  console.log('Network failures:', JSON.stringify(netFails, null, 2));
  console.log('Console errors:', errors.slice(0, 5));

  await page.screenshot({ path: 'test_avatar_real.png' });
  console.log('Screenshot saved.');

  await browser.close();
})().catch(e => console.error('FATAL:', e.message));
