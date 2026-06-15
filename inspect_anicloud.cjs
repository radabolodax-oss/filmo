const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.setExtraHTTPHeaders({ 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36' });

  const requests = [];
  page.on('request', req => {
    const url = req.url();
    if (url.includes('vidzy') || url.includes('embed') || url.includes('stream') || url.includes('m3u8') || url.includes('api') || url.includes('.mp4')) {
      requests.push(url.slice(0, 200));
    }
  });

  await page.goto('https://anicloud.top/anime/naruto-shippuden', { waitUntil: 'networkidle', timeout: 25000 });
  await page.waitForTimeout(5000);

  console.log('Network requests:', JSON.stringify(requests.slice(0, 30), null, 2));

  // Get all iframes including those loaded after JS
  const iframes = await page.evaluate(() => {
    return Array.from(document.querySelectorAll('iframe, video, source')).map(el => ({
      tag: el.tagName,
      src: el.src || el.getAttribute('src'),
      data: el.getAttribute('data-src')
    }));
  });
  console.log('Media elements:', JSON.stringify(iframes, null, 2));

  // Check what API calls are made
  const apiData = await page.evaluate(async () => {
    try {
      const r = await fetch('/api/episodes?anime=naruto-shippuden&ep=1');
      return await r.text();
    } catch(e) { return e.message; }
  });
  console.log('API test:', apiData.slice(0, 500));

  const bodyHtml = await page.evaluate(() => document.body.innerHTML.slice(0, 10000));
  require('fs').writeFileSync('C:/Users/PC/Desktop/prowler/MovixOpenSource-main/anicloud_body.html', bodyHtml);
  await page.screenshot({ path: 'C:/Users/PC/Desktop/prowler/MovixOpenSource-main/anicloud_player.png' });
  await browser.close();
  console.log('done');
})().catch(e => console.error(e.message));
