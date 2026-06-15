const { chromium } = require('./node_modules/playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  // Direct URL found earlier for Avatar
  await page.goto('http://localhost:3000/movie/4aQ8JEc1Qi8ny54rtzK8Kb1Qy64iKTWQOGex0', { waitUntil: 'networkidle', timeout: 20000 });
  await page.waitForTimeout(4000);

  // Scroll to video
  await page.evaluate(() => {
    const v = document.querySelector('video');
    if (v) v.scrollIntoView({ behavior: 'instant', block: 'center' });
  });
  await page.waitForTimeout(2000);

  const info = await page.evaluate(async () => {
    const video = document.querySelector('video');
    const h1 = document.querySelector('h1');

    // Also test if the URL actually resolves
    let urlTest = null;
    if (video && video.src) {
      try {
        const r = await fetch(video.src, { method: 'HEAD', signal: AbortSignal.timeout(8000) });
        urlTest = { status: r.status, ok: r.ok, type: r.headers.get('content-type') };
      } catch(e) {
        urlTest = { error: e.message };
      }
    }

    return {
      title: h1 ? h1.textContent.trim().slice(0, 80) : document.title,
      hasVideo: !!video,
      videoSrc: video ? video.src : null,
      networkState: video ? video.networkState : null,
      readyState: video ? video.readyState : null,
      urlTest,
    };
  });

  console.log('Result:', JSON.stringify(info, null, 2));
  await page.screenshot({ path: 'test_avatar_final.png' });
  console.log('Screenshot saved.');

  await browser.close();
})().catch(e => console.error('FATAL:', e.message));
