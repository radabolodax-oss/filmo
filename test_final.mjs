import { chromium } from './node_modules/playwright/index.mjs';
import { mkdirSync } from 'fs';

const URL = 'http://localhost:3000/tv/dNVc3MBeTbh5zPosp6OphaEx6seSUzLTtr';
const TMPDIR = 'C:/Users/PC/AppData/Local/Temp/players/';
try { mkdirSync(TMPDIR, { recursive: true }); } catch {}

const PLAYERS = [
  'Wavewatch', 'Webflix', 'Nakios', 'Purstream', 'AniCloud', 'Anime-Sama',
  'FRAnime', 'Frembed', 'Peachify', 'VidSrc', 'VidSrc.su', 'VidSrc.io',
  'VidSrc.wtf 1', 'VidSrc.wtf 3', 'VidSrc.wtf 5', 'VidLink', 'Videasy',
  '2Embed', 'AutoEmbed', 'MultiEmbed', 'VidSrc.nl'
];

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, ignoreHTTPSErrors: true });
const page = await context.newPage();

await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 30000 });

// Wait for source dropdown to be present in DOM
await page.waitForSelector('.source-dropdown', { timeout: 15000 });
await page.waitForTimeout(2000); // Extra time for player init

const results = {};

const selectAndTest = async (playerName) => {
  // Scroll dropdown into view
  await page.evaluate(() => {
    const el = document.querySelector('.source-dropdown');
    if (el) el.scrollIntoView({ behavior: 'instant', block: 'center' });
  });
  await page.waitForTimeout(300);
  
  // Click the toggle button (first direct child button)
  const opened = await page.evaluate(() => {
    const el = document.querySelector('.source-dropdown > button');
    if (!el) return false;
    el.click();
    return true;
  });
  if (!opened) return { status: 'ERROR', reason: 'dropdown toggle not found' };
  
  await page.waitForTimeout(400);
  
  // Click the player option
  const clicked = await page.evaluate((name) => {
    // All buttons currently visible - find in the dropdown overlay
    const allBtns = document.querySelectorAll('button');
    for (const btn of allBtns) {
      if (btn.textContent?.trim() === name) {
        btn.click();
        return { found: true, text: btn.textContent.trim() };
      }
    }
    return { found: false };
  }, playerName);
  
  if (!clicked.found) return { status: 'NOT_FOUND', reason: `"${playerName}" not in button list` };
  
  // Wait for player to load
  await page.waitForTimeout(6000);
  
  // Gather state
  const state = await page.evaluate(() => {
    // Iframe check
    let iframeSrc = null;
    for (const f of document.querySelectorAll('iframe')) {
      const src = f.getAttribute('src');
      if (src && !src.includes('localhost') && src !== 'about:blank') { iframeSrc = src; break; }
    }
    
    // Error messages
    const kw = ['indisponible', 'non trouvé', 'non disponible', 'erreur', 'impossible', 'introuvable', 'unavailable', 'not found', 'échec'];
    const seen = new Set();
    document.querySelectorAll('p, span, div, h3').forEach(el => {
      if (el.childElementCount > 1) return;
      const t = (el.textContent || '').trim();
      if (t.length > 4 && t.length < 200 && kw.some(k => t.toLowerCase().includes(k))) seen.add(t);
    });
    
    const hasVideo = !!document.querySelector('video');
    
    return { iframeSrc, errors: [...seen].slice(0, 3), hasVideo };
  });
  
  const safeName = playerName.replace(/[^a-zA-Z0-9]/g, '_');
  await page.screenshot({ path: `${TMPDIR}${safeName}.png` });
  
  if (state.errors.length > 0) return { status: 'ERROR', reason: state.errors[0] };
  if (state.hasVideo) return { status: 'OK', reason: 'video element' };
  if (state.iframeSrc) return { status: 'OK', reason: state.iframeSrc.substring(0, 120) };
  return { status: 'EMPTY', reason: 'no iframe, no video, no error text' };
};

for (const playerName of PLAYERS) {
  process.stdout.write(`[${PLAYERS.indexOf(playerName)+1}/${PLAYERS.length}] ${playerName}... `);
  try {
    const r = await selectAndTest(playerName);
    results[playerName] = r;
    console.log(`${r.status}: ${r.reason?.substring(0, 100) ?? ''}`);
  } catch(e) {
    results[playerName] = { status: 'CRASH', reason: e.message };
    console.log(`CRASH: ${e.message.substring(0, 80)}`);
  }
}

// Final report
console.log('\n\n==============================');
console.log('       BILAN FINAL');
console.log('==============================\n');
const ok = [], fail = [];
for (const [name, r] of Object.entries(results)) {
  if (r.status === 'OK') ok.push(name);
  else fail.push([name, r]);
}
console.log(`✅ FONCTIONNENT (${ok.length}):\n  ${ok.join('\n  ')}\n`);
console.log(`❌ PROBLÈMES (${fail.length}):`);
for (const [name, r] of fail) {
  console.log(`  ${name} → [${r.status}] ${r.reason?.substring(0,100)}`);
}

await browser.close();
