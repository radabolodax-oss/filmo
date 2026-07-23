import { chromium } from './node_modules/playwright/index.mjs';

const URL = 'http://localhost:3000/tv/dNVc3MBeTbh5zPosp6OphaEx6seSUzLTtr';
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, ignoreHTTPSErrors: true });
const page = await context.newPage();

// Monitor network requests for Nakios API
const nakiosRequests = [];
page.on('request', req => {
  if (req.url().includes('nakios') || req.url().includes('purstream') || req.url().includes('nakio')) {
    nakiosRequests.push({ url: req.url(), method: req.method() });
  }
});
page.on('response', res => {
  if (res.url().includes('nakios') || res.url().includes('purstream') || res.url().includes('nakio')) {
    console.log(`Response: ${res.status()} ${res.url().substring(0, 100)}`);
  }
});

await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 30000 });
await page.waitForSelector('.source-dropdown', { timeout: 15000 });
await page.waitForTimeout(2000);

// Select Nakios
await page.evaluate(() => {
  const el = document.querySelector('.source-dropdown > button');
  if (el) el.click();
});
await page.waitForTimeout(400);
await page.evaluate(() => {
  for (const btn of document.querySelectorAll('button')) {
    if (btn.textContent?.trim() === 'Nakios') { btn.click(); return; }
  }
});

console.log('Nakios selected, waiting up to 20 seconds...');

for (let i = 1; i <= 4; i++) {
  await page.waitForTimeout(5000);
  const state = await page.evaluate(() => {
    const iframes = [...document.querySelectorAll('iframe')].map(f => f.getAttribute('src')).filter(Boolean);
    const hasVideo = !!document.querySelector('video');
    const hasSpin = !!document.querySelector('.animate-spin');
    const texts = [];
    document.querySelectorAll('p, span').forEach(el => {
      if (el.childElementCount === 0) {
        const t = el.textContent?.trim();
        if (t && t.length > 5 && t.length < 200) texts.push(t);
      }
    });
    const errorTexts = texts.filter(t => t.toLowerCase().includes('indisponible') || t.toLowerCase().includes('erreur') || t.toLowerCase().includes('unavailable'));
    return { iframes, hasVideo, hasSpin, errorTexts: errorTexts.slice(0, 3) };
  });
  console.log(`After ${i*5}s: video=${state.hasVideo}, spinner=${state.hasSpin}, iframes=${state.iframes.length}, errors=${JSON.stringify(state.errorTexts)}`);
  if (state.hasVideo || state.iframes.length > 0 || state.errorTexts.length > 0) break;
}

await page.screenshot({ path: 'C:/Users/PC/AppData/Local/Temp/nakios_final.png' });
console.log('\nNakios API requests:', nakiosRequests);

await browser.close();
