const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage();
  await page.setViewportSize({ width: 1400, height: 900 });
  await page.goto('http://localhost:3000/movie/76600');
  await page.waitForTimeout(5000);

  // Click play button to show inline player
  try {
    await page.click('button:has-text("Regarder")');
    await page.waitForTimeout(500);
  } catch(e) {}
  try {
    await page.click('.cursor-pointer >> nth=0');
    await page.waitForTimeout(500);
  } catch(e) {}

  // Scroll to player section
  await page.evaluate(() => {
    const el = document.getElementById('video-player-section');
    if (el) el.scrollIntoView({ behavior: 'instant', block: 'start' });
  });
  await page.waitForTimeout(2000);

  await page.screenshot({ path: 'screenshot_sources_final.png' });
  console.log('done');
  await browser.close();
})();
