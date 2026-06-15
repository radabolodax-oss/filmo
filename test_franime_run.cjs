const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: false, slowMo: 300, args: ['--disable-cache'] });
  const context = await browser.newContext({ bypassCSP: true });
  const page = await context.newPage();
  await page.setViewportSize({ width: 1536, height: 900 });

  await page.goto('http://localhost:3000/tv/4kckhT3IQtSvrKxOOmaXvOyU6XrnplatLpKg8', { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(2000);

  await page.locator('button', { hasText: "Commencer l'épisode" }).first().click();
  await page.waitForTimeout(2000);
  await page.locator('button', { hasText: 'Frembed' }).first().click();
  await page.waitForTimeout(500);
  await page.locator('button', { hasText: 'FRAnime' }).first().click();
  console.log('FRAnime selected, waiting 14s...');
  await page.waitForTimeout(14000);

  // Dismiss popup
  try {
    for (const frame of page.frames()) {
      try {
        const btn = frame.locator('button', { hasText: 'Fermer' });
        if (await btn.isVisible({ timeout: 1000 })) { await btn.click(); console.log('Popup dismissed'); break; }
      } catch {}
    }
  } catch {}
  await page.waitForTimeout(1500);

  // Scroll player into view
  await page.evaluate(() => {
    const iframe = document.querySelector('iframe[title*="S"]');
    if (iframe && iframe.parentElement) iframe.parentElement.scrollIntoView({ behavior: 'instant', block: 'center' });
  });
  await page.waitForTimeout(800);

  // Log actual iframe element dimensions
  const dims = await page.evaluate(() => {
    const iframe = document.querySelector('iframe[title*="S"]');
    if (!iframe) return null;
    const ir = iframe.getBoundingClientRect();
    const pr = iframe.parentElement.getBoundingClientRect();
    return {
      iframe: { top: ir.top, height: ir.height },
      parent: { top: pr.top, height: pr.height },
      style: iframe.getAttribute('style')
    };
  });
  console.log('Element dims:', JSON.stringify(dims, null, 2));

  const wrapper = await page.evaluate(() => {
    const iframe = document.querySelector('iframe[title*="S"]');
    if (!iframe) return null;
    const r = iframe.parentElement.getBoundingClientRect();
    return { x: r.x, y: r.y, width: r.width, height: r.height };
  });

  if (wrapper) {
    await page.screenshot({
      path: 'test_franime_player.png',
      clip: { x: wrapper.x, y: wrapper.y, width: wrapper.width, height: wrapper.height }
    });
    console.log('Screenshot saved, wrapper height:', wrapper.height);
  }

  await browser.close();
})();
