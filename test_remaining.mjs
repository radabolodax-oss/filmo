import { chromium } from './node_modules/playwright/index.mjs';
import { mkdirSync } from 'fs';

const URL = 'http://localhost:3000/tv/dNVc3MBeTbh5zPosp6OphaEx6seSUzLTtr';
const TMPDIR = 'C:/Users/PC/AppData/Local/Temp/players/';
try { mkdirSync(TMPDIR, { recursive: true }); } catch {}

// Only test the ones that failed due to navigation crash
const PLAYERS = [
  'Nakios',  // EMPTY - needs re-check
  'VidSrc.su', 'VidSrc.io', 'VidSrc.wtf 1', 'VidSrc.wtf 3', 'VidSrc.wtf 5',
  'VidLink', 'Videasy', '2Embed', 'AutoEmbed', 'MultiEmbed', 'VidSrc.nl'
];

const browser = await chromium.launch({ headless: true });
const results = {};

for (const playerName of PLAYERS) {
  process.stdout.write(`[${playerName}]... `);
  
  // Fresh page for each player that might navigate
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, ignoreHTTPSErrors: true });
  const page = await context.newPage();
  
  // Track navigation away from app
  let navigatedAway = false;
  page.on('framenavigated', frame => {
    if (frame === page.mainFrame() && !frame.url().includes('localhost:3000')) {
      navigatedAway = true;
    }
  });
  
  try {
    await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForSelector('.source-dropdown', { timeout: 15000 });
    await page.waitForTimeout(2000);
    
    // Click toggle
    const opened = await page.evaluate(() => {
      const el = document.querySelector('.source-dropdown > button');
      if (!el) return false;
      el.click();
      return true;
    });
    if (!opened) { results[playerName] = { status: 'ERROR', reason: 'no toggle' }; console.log('no toggle'); await context.close(); continue; }
    
    await page.waitForTimeout(400);
    
    // Click option
    const clicked = await page.evaluate((name) => {
      for (const btn of document.querySelectorAll('button')) {
        if (btn.textContent?.trim() === name) { btn.click(); return true; }
      }
      return false;
    }, playerName);
    
    if (!clicked) { results[playerName] = { status: 'NOT_FOUND', reason: 'not in list' }; console.log('not found'); await context.close(); continue; }
    
    // Wait but catch navigation
    try {
      await page.waitForTimeout(6000);
    } catch(e) {}
    
    if (navigatedAway) {
      const currentUrl = page.url();
      results[playerName] = { status: 'NAVIGATED', reason: `Page navigated to ${currentUrl.substring(0, 80)}` };
      console.log(`NAVIGATED to: ${currentUrl.substring(0, 80)}`);
      await context.close();
      continue;
    }
    
    const state = await page.evaluate(() => {
      let iframeSrc = null;
      for (const f of document.querySelectorAll('iframe')) {
        const src = f.getAttribute('src');
        if (src && !src.includes('localhost') && src !== 'about:blank') { iframeSrc = src; break; }
      }
      const kw = ['indisponible', 'non trouvé', 'non disponible', 'erreur', 'impossible', 'introuvable', 'unavailable', 'not found', 'échec'];
      const seen = new Set();
      document.querySelectorAll('p, span, div, h3').forEach(el => {
        if (el.childElementCount > 1) return;
        const t = (el.textContent || '').trim();
        if (t.length > 4 && t.length < 200 && kw.some(k => t.toLowerCase().includes(k))) seen.add(t);
      });
      const hasVideo = !!document.querySelector('video');
      return { iframeSrc, errors: [...seen].slice(0, 3), hasVideo };
    }).catch(() => null);
    
    if (!state) { results[playerName] = { status: 'CRASH', reason: 'evaluate failed' }; console.log('crash'); await context.close(); continue; }
    
    const safeName = playerName.replace(/[^a-zA-Z0-9]/g, '_');
    await page.screenshot({ path: `${TMPDIR}${safeName}.png` });
    
    let status, reason;
    if (state.errors.length > 0) { status = 'ERROR'; reason = state.errors[0]; }
    else if (state.hasVideo) { status = 'OK'; reason = 'video element'; }
    else if (state.iframeSrc) { status = 'OK'; reason = state.iframeSrc.substring(0, 120); }
    else { status = 'EMPTY'; reason = 'no content detected'; }
    
    results[playerName] = { status, reason };
    console.log(`${status}: ${reason?.substring(0, 90)}`);
    
  } catch(e) {
    results[playerName] = { status: 'CRASH', reason: e.message.substring(0, 80) };
    console.log(`CRASH: ${e.message.substring(0, 80)}`);
  }
  
  await context.close();
}

// Print results
console.log('\n\n===== RÉSULTATS RESTANTS =====');
const ok = [], fail = [];
for (const [name, r] of Object.entries(results)) {
  if (r.status === 'OK') ok.push(name);
  else fail.push([name, r]);
  console.log(`${name}: [${r.status}] ${r.reason?.substring(0, 100) ?? ''}`);
}
console.log('\n✅ OK:', ok.join(', ') || 'aucun');
console.log('❌ FAIL:', fail.map(([n,r]) => `${n}(${r.status})`).join(', '));

await browser.close();
