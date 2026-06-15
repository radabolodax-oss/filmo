const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage();
  await page.setViewportSize({ width: 1400, height: 900 });
  await page.goto('http://localhost:3000/movie/76600');
  await page.waitForTimeout(6000);

  // Click the big play button to show inline player
  try {
    const playCircle = await page.$('.cursor-pointer.w-24, .rounded-full.cursor-pointer');
    if (playCircle) { await playCircle.click(); await page.waitForTimeout(1000); }
  } catch(e) {}

  // Scroll to sources buttons
  await page.evaluate(() => {
    const el = document.getElementById('video-player-section');
    if (el) el.scrollIntoView({ behavior: 'instant', block: 'center' });
  });
  await page.waitForTimeout(2000);

  // Find the sources section and clip it
  const sourcesBox = await page.evaluate(() => {
    // Find button with text "VidSrc" or "Videasy"
    const buttons = Array.from(document.querySelectorAll('button'));
    const vidsrc = buttons.find(b => b.textContent?.includes('VidSrc'));
    const frembed = buttons.find(b => b.textContent?.includes('Frembed'));
    if (!vidsrc && !frembed) return null;
    const ref = frembed || vidsrc;
    const parent = ref?.closest('div[class*="p-4"]') || ref?.closest('div[class*="space-y"]');
    if (!parent) return null;
    const rect = parent.getBoundingClientRect();
    return { x: rect.left - 20, y: rect.top - 10, width: rect.width + 40, height: rect.height + 20 };
  });

  console.log('Sources box:', sourcesBox);

  if (sourcesBox) {
    await page.screenshot({ path: 'screenshot_sources_zoom.png', clip: sourcesBox });
  } else {
    await page.screenshot({ path: 'screenshot_sources_zoom.png' });
  }
  console.log('done');
  await browser.close();
})();
