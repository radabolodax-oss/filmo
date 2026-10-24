import { chromium } from './node_modules/playwright/index.mjs';

const URL = 'http://localhost:3000/tv/dNVc3MBeTbh5zPosp6OphaEx6seSUzLTtr';
const TMPDIR = 'C:/Users/PC/AppData/Local/Temp/';

const PLAYERS = [
  'Wavewatch', 'Webflix', 'Nakios', 'Purstream', 'AniCloud', 'Anime-Sama',
  'FRAnime', 'Frembed', 'Peachify', 'VidSrc', 'VidSrc.su', 'VidSrc.io',
  'VidSrc.wtf 1', 'VidSrc.wtf 3', 'VidSrc.wtf 5', 'VidLink', 'Videasy',
  '2Embed', 'AutoEmbed', 'MultiEmbed', 'VidSrc.nl'
];

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
  viewport: { width: 1280, height: 900 },
  ignoreHTTPSErrors: true,
});
const page = await context.newPage();

// Track network requests and errors
const networkErrors = new Map();
const iframeUrls = new Map();

page.on('requestfailed', req => {
  const url = req.url();
  if (!url.includes('tmdb') && !url.includes('localhost')) {
    const key = `${req.resourceType()}:${url.substring(0, 80)}`;
    networkErrors.set(key, (networkErrors.get(key) || 0) + 1);
  }
});

// Navigate once
await page.goto(URL, { waitUntil: 'networkidle', timeout: 30000 });
await page.waitForTimeout(3000);

// Scroll to player area
await page.evaluate(() => {
  const el = document.querySelector('.source-dropdown');
  if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
});
await page.waitForTimeout(1000);

const results = {};

for (const playerName of PLAYERS) {
  console.log(`\nTesting: ${playerName}`);
  networkErrors.clear();
  
  try {
    // Open dropdown
    const dropBtn = await page.$('.source-dropdown button');
    if (!dropBtn) { results[playerName] = { status: 'ERROR', reason: 'Dropdown button not found' }; continue; }
    await dropBtn.click();
    await page.waitForTimeout(300);
    
    // Find and click the player option
    const optionBtn = await page.getByRole('button', { name: playerName, exact: true }).first();
    const found = await optionBtn.count() > 0;
    if (!found) {
      // Close dropdown
      await page.keyboard.press('Escape');
      results[playerName] = { status: 'NOT_FOUND', reason: 'Option not in dropdown' };
      continue;
    }
    
    await optionBtn.click();
    await page.waitForTimeout(4000);
    
    // Check what's rendered in the player area
    // Look for iframe
    const iframes = await page.$$('iframe');
    let iframeSrc = null;
    for (const f of iframes) {
      const src = await f.getAttribute('src');
      if (src && src.length > 0) {
        iframeSrc = src;
        break;
      }
    }
    
    // Check for error messages
    const errorTexts = await page.$$eval('*', els => {
      const keywords = ['indisponible', 'non trouvé', 'non disponible', 'erreur', 'impossible', 'introuvable', 'error'];
      return els
        .filter(el => el.childElementCount === 0 && el.textContent)
        .map(el => el.textContent.trim())
        .filter(t => t.length > 5 && t.length < 200)
        .filter(t => keywords.some(k => t.toLowerCase().includes(k)));
    });
    
    // Check for video element
    const hasVideo = await page.$('video') !== null;
    const hasHlsPlayer = await page.$('[class*="HLS"], [class*="hls-player"], [class*="hlsPlayer"]') !== null;
    
    // Take screenshot
    const safeName = playerName.replace(/[^a-zA-Z0-9]/g, '_');
    await page.screenshot({ 
      path: `${TMPDIR}player_${safeName}.png`,
      clip: { x: 0, y: 200, width: 1280, height: 600 }
    });
    
    let status = 'UNKNOWN';
    let reason = '';
    
    if (errorTexts.length > 0) {
      status = 'ERROR';
      reason = errorTexts.slice(0, 2).join(' | ');
    } else if (hasVideo || hasHlsPlayer) {
      status = 'OK_VIDEO';
      reason = 'Video element found';
    } else if (iframeSrc) {
      status = 'OK_IFRAME';
      reason = iframeSrc.substring(0, 100);
    } else {
      status = 'EMPTY';
      reason = 'No iframe, no video, no error message detected';
    }
    
    results[playerName] = { status, reason, iframeSrc };
    console.log(`  -> ${status}: ${reason.substring(0, 80)}`);
    
  } catch (e) {
    results[playerName] = { status: 'EXCEPTION', reason: e.message };
    console.log(`  -> EXCEPTION: ${e.message}`);
  }
}

console.log('\n\n===== RESULTS =====');
for (const [name, r] of Object.entries(results)) {
  console.log(`${name}: ${r.status} — ${r.reason?.substring(0, 100) || ''}`);
}

await browser.close();
