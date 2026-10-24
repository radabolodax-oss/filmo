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
await page.waitForTimeout(5000);

const results = {};

const selectPlayer = async (playerName) => {
  // Scroll to dropdown and ensure it's visible
  await page.evaluate(() => {
    const el = document.querySelector('.source-dropdown');
    if (el) el.scrollIntoView({ behavior: 'instant', block: 'center' });
  });
  await page.waitForTimeout(300);
  
  // Close any open dropdown
  await page.keyboard.press('Escape');
  await page.waitForTimeout(150);
  
  // Open dropdown
  const dropBtn = await page.$('.source-dropdown > button');
  if (!dropBtn) return { ok: false, reason: 'no dropdown button' };
  
  await dropBtn.click();
  await page.waitForTimeout(400);
  
  // Find the option - look in the dropdown overlay
  const allBtns = await page.$$('button');
  for (const btn of allBtns) {
    const text = (await btn.textContent())?.trim();
    if (text === playerName) {
      await btn.click();
      return { ok: true };
    }
  }
  
  // Close dropdown
  await page.keyboard.press('Escape');
  return { ok: false, reason: `option "${playerName}" not found` };
};

const getPlayerState = async () => {
  // Get iframe src
  let iframeSrc = null;
  const iframes = await page.$$('iframe');
  for (const f of iframes) {
    const src = await f.getAttribute('src');
    if (src && src.length > 0 && !src.includes('localhost')) {
      iframeSrc = src;
      break;
    }
  }
  
  // Check for errors
  const errors = await page.evaluate(() => {
    const kw = ['indisponible', 'non trouvé', 'non disponible', 'erreur', 'impossible', 'introuvable', 'unavailable', 'not found'];
    const seen = new Set();
    document.querySelectorAll('p, span, div').forEach(el => {
      if (el.childElementCount > 1) return;
      const t = (el.textContent || '').trim();
      if (t.length > 4 && t.length < 200 && kw.some(k => t.toLowerCase().includes(k))) seen.add(t);
    });
    return [...seen].slice(0, 3);
  });
  
  const hasVideo = await page.$('video') !== null;
  
  return { iframeSrc, errors, hasVideo };
};

for (const playerName of PLAYERS) {
  process.stdout.write(`Testing ${playerName}... `);
  
  try {
    const sel = await selectPlayer(playerName);
    if (!sel.ok) {
      results[playerName] = { status: 'NOT_FOUND', reason: sel.reason };
      console.log(`NOT_FOUND (${sel.reason})`);
      continue;
    }
    
    await page.waitForTimeout(5000);
    
    const state = await getPlayerState();
    
    const safeName = playerName.replace(/[^a-zA-Z0-9]/g, '_');
    await page.screenshot({ path: `${TMPDIR}${safeName}.png` });
    
    let status, reason;
    if (state.errors.length > 0) {
      status = 'ERROR';
      reason = state.errors[0];
    } else if (state.hasVideo) {
      status = 'OK';
      reason = 'video element present';
    } else if (state.iframeSrc) {
      status = 'OK';
      reason = state.iframeSrc.substring(0, 120);
    } else {
      status = 'EMPTY';
      reason = 'no content detected';
    }
    
    results[playerName] = { status, reason };
    console.log(`${status}: ${reason.substring(0, 100)}`);
    
  } catch(e) {
    results[playerName] = { status: 'CRASH', reason: e.message };
    console.log(`CRASH: ${e.message.substring(0, 80)}`);
  }
}

console.log('\n\n========== BILAN ==========');
const ok = Object.entries(results).filter(([,v]) => v.status === 'OK').map(([k]) => k);
const err = Object.entries(results).filter(([,v]) => v.status !== 'OK');

console.log(`\n✅ FONCTIONNENT (${ok.length}): ${ok.join(', ')}`);
console.log(`\n❌ NE FONCTIONNENT PAS (${err.length}):`);
for (const [name, r] of err) {
  console.log(`  - ${name} [${r.status}]: ${r.reason?.substring(0, 100)}`);
}

await browser.close();
