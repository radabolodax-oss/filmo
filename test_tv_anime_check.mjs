import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });

const EMBED_SOURCES = ['VidSrc', 'VidSrc.su', 'Peachify', '2Embed', 'AutoEmbed', 'VidLink', 'MultiEmbed', 'VidSrc.nl', 'Videasy', 'Webflix'];

// ─── SÉRIE ────────────────────────────────────────────────────────────────────
console.log('\n═══ SÉRIE (76669 The Rookie) ═══');
await page.goto('http://localhost:3000/tv/76669', { waitUntil: 'domcontentloaded', timeout: 20000 });
await page.waitForTimeout(4000);

// Try clicking first episode button
const allBtns = await page.$$eval('button', btns => btns.map(b => b.textContent?.trim()).filter(Boolean));
console.log('All buttons on load:', allBtns.slice(0, 20));

// Find and click episode 1 button or any play button
const playBtnIndex = allBtns.findIndex(b => b && (b.includes('E01') || b.includes('Commencer') || b.includes('Lancer') || b.match(/E0[0-9]/)));
if (playBtnIndex !== -1) {
  const btns = await page.$$('button');
  if (btns[playBtnIndex]) {
    await btns[playBtnIndex].click();
    await page.waitForTimeout(2000);
  }
}

const tvBtnsAfter = await page.$$eval('button', btns => btns.map(b => b.textContent?.trim()).filter(Boolean));
const tvEmbed = EMBED_SOURCES.filter(s => tvBtnsAfter.includes(s));
console.log('Boutons embed trouvés (TV):', tvEmbed);
console.log('Manquants TV:', EMBED_SOURCES.filter(s => !tvBtnsAfter.includes(s)));

// Test VidSrc click
if (tvEmbed.includes('VidSrc')) {
  const vidsrcBtns = await page.$$('button');
  const vidsrcBtn = await page.$$eval('button', btns => {
    const b = btns.find(b => b.textContent?.trim() === 'VidSrc');
    return b ? btns.indexOf(b) : -1;
  });
  if (vidsrcBtn !== -1) {
    await (await page.$$('button'))[vidsrcBtn].click();
    await page.waitForTimeout(1500);
    const src = await page.$eval('iframe', el => el.src).catch(() => 'no iframe');
    console.log('TV VidSrc iframe src:', src);
  }
}

await page.screenshot({ path: './test_tv_final.png', fullPage: false });

// ─── ANIME ────────────────────────────────────────────────────────────────────
console.log('\n═══ ANIME (46260 Naruto) ═══');
await page.goto('http://localhost:3000/tv/46260', { waitUntil: 'domcontentloaded', timeout: 20000 });
await page.waitForTimeout(4000);

const animeBtnsAll = await page.$$eval('button', btns => btns.map(b => b.textContent?.trim()).filter(Boolean));
console.log('All buttons on load:', animeBtnsAll.slice(0, 20));

const playBtnIndexAnime = animeBtnsAll.findIndex(b => b && (b.includes('E01') || b.match(/E0[0-9]/)));
if (playBtnIndexAnime !== -1) {
  const btns = await page.$$('button');
  if (btns[playBtnIndexAnime]) {
    await btns[playBtnIndexAnime].click();
    await page.waitForTimeout(2000);
  }
}

const animeBtnsAfter = await page.$$eval('button', btns => btns.map(b => b.textContent?.trim()).filter(Boolean));
const animeEmbed = EMBED_SOURCES.filter(s => animeBtnsAfter.includes(s));
console.log('Boutons embed trouvés (anime):', animeEmbed);
console.log('Manquants anime:', EMBED_SOURCES.filter(s => !animeBtnsAfter.includes(s)));

await page.screenshot({ path: './test_anime_final.png', fullPage: false });

await browser.close();
console.log('\nDone. Screenshots: test_tv_final.png / test_anime_final.png');
