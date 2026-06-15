const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ headless: false, slowMo: 300 });
  const page = await browser.newPage();
  await page.setViewportSize({ width: 1400, height: 800 });
  await page.goto('http://localhost:3000/watch/movie/76600');
  await page.waitForTimeout(6000);

  // Dismiss interstitial if present
  try {
    await page.click('button:has-text("Continuer"), button:has-text("Continue"), button:has-text("Fermer"), button:has-text("Close")');
    await page.waitForTimeout(1000);
  } catch(e) {}

  await page.screenshot({ path: 'screenshot_player.png' });
  console.log('Screenshot 1 - player initial');

  // Find sources/settings button in player controls
  const allBtns = await page.$$('button');
  console.log('Total buttons found:', allBtns.length);
  for (const btn of allBtns) {
    const text = await btn.innerText().catch(() => '');
    const cls = await btn.getAttribute('class').catch(() => '');
    if (text || cls) console.log('btn:', JSON.stringify(text.trim().slice(0,40)), '|', (cls||'').slice(0,60));
  }

  await browser.close();
})();
