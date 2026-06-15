const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: false, slowMo: 300 });
  const page = await browser.newPage();
  await page.setViewportSize({ width: 1536, height: 900 });

  await page.goto('http://localhost:3000/tv/4kckhT3IQtSvrKxOOmaXvOyU6XrnplatLpKg8', { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(2000);

  await page.locator('button', { hasText: "Commencer l'épisode" }).first().click();
  await page.waitForTimeout(2000);
  await page.locator('button', { hasText: 'Frembed' }).first().click();
  await page.waitForTimeout(500);
  await page.locator('button', { hasText: 'FRAnime' }).first().click();
  await page.waitForTimeout(7000);

  // Dismiss popup inside iframe
  try {
    for (const frame of page.frames()) {
      try {
        const btn = frame.locator('button', { hasText: 'Fermer' });
        if (await btn.isVisible({ timeout: 1500 })) { await btn.click(); break; }
      } catch {}
    }
  } catch {}
  await page.waitForTimeout(1500);

  // Scroll the wrapper into view
  await page.evaluate(() => {
    const iframe = document.querySelector('iframe[title*="S"]');
    if (iframe && iframe.parentElement) iframe.parentElement.scrollIntoView({ behavior: 'instant', block: 'center' });
  });
  await page.waitForTimeout(800);

  // Get wrapper position relative to current viewport
  const wrapper = await page.evaluate(() => {
    const iframe = document.querySelector('iframe[title*="S"]');
    if (!iframe) return null;
    const r = iframe.parentElement.getBoundingClientRect();
    return { x: r.x, y: r.y, width: r.width, height: r.height };
  });
  console.log('Wrapper viewport coords:', wrapper);

  if (wrapper) {
    // Top edge: 30px above wrapper to 90px inside it
    await page.screenshot({ path: 'crop_edge_top.png',
      clip: { x: wrapper.x, y: Math.max(0, wrapper.y - 30), width: wrapper.width, height: 120 } });

    // Bottom edge: 60px before end to 60px after end
    const bottomY = wrapper.y + wrapper.height;
    await page.screenshot({ path: 'crop_edge_bottom.png',
      clip: { x: wrapper.x, y: Math.max(0, bottomY - 60), width: wrapper.width, height: 120 } });

    // Full player
    await page.screenshot({ path: 'crop_full_player.png',
      clip: { x: wrapper.x, y: wrapper.y, width: wrapper.width, height: wrapper.height } });

    console.log('Screenshots captured');
  }

  await browser.close();
})();
