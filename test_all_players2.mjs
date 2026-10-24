import { chromium } from './node_modules/playwright/index.mjs';

const URL = 'http://localhost:3000/tv/dNVc3MBeTbh5zPosp6OphaEx6seSUzLTtr';
const TMPDIR = 'C:/Users/PC/AppData/Local/Temp/players/';

const PLAYERS = [
  'Wavewatch', 'Webflix', 'Nakios', 'Purstream', 'AniCloud', 'Anime-Sama',
  'FRAnime', 'Frembed', 'Peachify', 'VidSrc', 'VidSrc.su', 'VidSrc.io',
  'VidSrc.wtf 1', 'VidSrc.wtf 3', 'VidSrc.wtf 5', 'VidLink', 'Videasy',
  '2Embed', 'AutoEmbed', 'MultiEmbed', 'VidSrc.nl'
];

// Create temp dir
import { mkdirSync } from 'fs';
try { mkdirSync(TMPDIR, { recursive: true }); } catch {}

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
  viewport: { width: 1280, height: 900 },
  ignoreHTTPSErrors: true,
});
const page = await context.newPage();

await page.goto(URL, { waitUntil: 'networkidle', timeout: 30000 });
await page.waitForTimeout(3000);

const results = {};

const scrollToDropdown = async () => {
  await page.evaluate(() => {
    const el = document.querySelector('.source-dropdown');
    if (el) el.scrollIntoView({ behavior: 'instant', block: 'center' });
  });
  await page.waitForTimeout(400);
};

const openDropdown = async () => {
  await scrollToDropdown();
  // Close any open dropdown first
  await page.keyboard.press('Escape');
  await page.waitForTimeout(200);
  
  const dropBtn = await page.$('.source-dropdown > button');
  if (!dropBtn) return false;
  await dropBtn.click();
  await page.waitForTimeout(400);
  return true;
};

for (const playerName of PLAYERS) {
  console.log(`\nTesting: ${playerName}`);
  
  try {
    // Open dropdown
    const opened = await openDropdown();
    if (!opened) {
      results[playerName] = { status: 'ERROR', reason: 'Cannot find source-dropdown button' };
      console.log('  -> Cannot find dropdown button');
      continue;
    }
    
    // Find the player in dropdown list
    const dropdownItems = await page.$$('.source-dropdown ~ div button, .absolute button');
    let found = false;
    for (const btn of dropdownItems) {
      const text = (await btn.textContent())?.trim();
      if (text === playerName || text?.includes(playerName)) {
        await btn.click();
        found = true;
        break;
      }
    }
    
    if (!found) {
      // Try using page.locator
      const loc = page.locator('button').filter({ hasText: new RegExp(`^${playerName.replace('.', '\.').replace('(', '\(').replace(')', '\)')}$`) });
      const count = await loc.count();
      if (count > 0) {
        await loc.first().click();
        found = true;
      }
    }
    
    if (!found) {
      results[playerName] = { status: 'NOT_FOUND', reason: 'Option not visible in dropdown' };
      await page.keyboard.press('Escape');
      console.log('  -> Not found in dropdown');
      continue;
    }
    
    // Wait for content to load
    await page.waitForTimeout(5000);
    
    // Scroll to see the player
    await page.evaluate(() => {
      const iframe = document.querySelector('iframe');
      const video = document.querySelector('video');
      const el = iframe || video;
      if (el) el.scrollIntoView({ behavior: 'instant', block: 'center' });
    });
    await page.waitForTimeout(500);
    
    // Check what's rendered
    const iframes = await page.$$('iframe');
    let iframeSrc = null;
    for (const f of iframes) {
      const src = await f.getAttribute('src');
      if (src && src.length > 0 && !src.includes('localhost') && !src.includes('about:blank')) {
        iframeSrc = src;
        break;
      }
    }
    
    // Check for error messages in the player region
    const errorTexts = await page.evaluate(() => {
      const keywords = ['indisponible', 'non trouvé', 'non disponible', 'erreur', 'impossible', 'introuvable', 'error', 'unavailable'];
      const all = [];
      document.querySelectorAll('p, span, div').forEach(el => {
        if (el.childElementCount > 2) return;
        const t = el.textContent?.trim() || '';
        if (t.length > 5 && t.length < 300 && keywords.some(k => t.toLowerCase().includes(k))) {
          all.push(t);
        }
      });
      return [...new Set(all)].slice(0, 3);
    });
    
    const hasVideo = await page.$('video') !== null;
    
    // Take screenshot
    const safeName = playerName.replace(/[^a-zA-Z0-9]/g, '_');
    await page.screenshot({ 
      path: `${TMPDIR}player_${safeName}.png`,
      fullPage: false
    });
    
    let status, reason;
    if (errorTexts.length > 0) {
      status = 'ERROR';
      reason = errorTexts[0];
    } else if (hasVideo) {
      status = 'OK_VIDEO';
      reason = 'Video element found';
    } else if (iframeSrc) {
      status = 'OK_IFRAME';
      reason = iframeSrc.substring(0, 120);
    } else {
      // Check if it's loading
      const hasLoading = await page.evaluate(() => {
        const texts = ['chargement', 'loading', 'recherche'];
        let found = false;
        document.querySelectorAll('*').forEach(el => {
          if (el.childElementCount === 0) {
            const t = el.textContent?.trim().toLowerCase() || '';
            if (texts.some(k => t.includes(k))) found = true;
          }
        });
        return found;
      });
      status = hasLoading ? 'LOADING' : 'EMPTY';
      reason = hasLoading ? 'Loading state visible' : 'No content, no error detected';
    }
    
    results[playerName] = { status, reason };
    console.log(`  -> ${status}: ${reason.substring(0, 100)}`);
    
  } catch (e) {
    results[playerName] = { status: 'EXCEPTION', reason: e.message };
    console.log(`  -> EXCEPTION: ${e.message.substring(0, 100)}`);
  }
}

console.log('\n\n===== RÉSULTATS COMPLETS =====');
const ok = [], errors = [], unknown = [];
for (const [name, r] of Object.entries(results)) {
  if (r.status === 'OK_IFRAME' || r.status === 'OK_VIDEO') ok.push(name);
  else if (r.status === 'ERROR' || r.status === 'LOADING' || r.status === 'EMPTY' || r.status === 'NOT_FOUND') errors.push(`${name} (${r.status}: ${r.reason?.substring(0, 80)})`);
  else unknown.push(`${name}: ${r.status}`);
  console.log(`${name}: [${r.status}] ${r.reason?.substring(0, 100) || ''}`);
}

console.log('\n✅ FONCTIONNENT:', ok.join(', '));
console.log('\n❌ NE FONCTIONNENT PAS:');
errors.forEach(e => console.log(' -', e));
if (unknown.length) console.log('\n? INCONNUS:', unknown.join(', '));

await browser.close();
