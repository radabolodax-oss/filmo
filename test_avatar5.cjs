const { chromium } = require('./node_modules/playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  await page.goto('http://localhost:3000/movie/4aQ8JEc1Qi8ny54rtzK8Kb1Qy64iKTWQOGex0', { waitUntil: 'networkidle', timeout: 20000 });
  await page.waitForTimeout(3000);

  // Scroll to the video element
  await page.evaluate(() => {
    const video = document.querySelector('video');
    if (video) video.scrollIntoView({ behavior: 'instant', block: 'center' });
  });
  await page.waitForTimeout(2000);

  await page.screenshot({ path: 'test_avatar_player2.png' });

  // Also check if fastflux URL responds
  const fetchResult = await page.evaluate(async () => {
    try {
      const url = 'https://fastflux.xyz/api/video_proxy.php?file=/series/VF/Avatar-The-Way-Of-Water/S01/avatar-the-way-of-water-S01-E01.mp4';
      const r = await fetch(url, { method: 'HEAD', signal: AbortSignal.timeout(5000) });
      return { status: r.status, ok: r.ok, contentType: r.headers.get('content-type') };
    } catch(e) {
      return { error: e.message };
    }
  });
  console.log('Fastflux URL test:', JSON.stringify(fetchResult));
  console.log('Screenshot: test_avatar_player2.png');

  await browser.close();
})().catch(e => console.error('FATAL:', e.message));
