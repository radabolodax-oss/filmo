import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });

const EMBED_SOURCES = ['VidSrc', 'VidSrc.su', 'Peachify', '2Embed', 'AutoEmbed', 'VidLink', 'MultiEmbed', 'VidSrc.nl', 'Videasy', 'Webflix'];

// ─── FILM ─────────────────────────────────────────────────────────────────────
console.log('\n═══ FILM (76600 Avatar 2) ═══');
await page.goto('http://localhost:3000/movie/76600', { waitUntil: 'domcontentloaded', timeout: 20000 });
await page.waitForTimeout(4000);

const filmBtns = await page.$$eval('button', btns => btns.map(b => b.textContent?.trim()).filter(Boolean));
const filmEmbed = EMBED_SOURCES.filter(s => filmBtns.includes(s));
console.log('Boutons embed trouvés (film):', filmEmbed);
console.log('Manquants:', EMBED_SOURCES.filter(s => !filmBtns.includes(s)));

// Test clic VidSrc → iframe src
const vidsrcBtn = filmBtns.find(b => b === 'VidSrc');
if (vidsrcBtn) {
  const btn = await page.getByRole('button', { name: 'VidSrc', exact: true }).first();
  await btn.click();
  await page.waitForTimeout(1500);
  const iframeSrc = await page.$eval('iframe', el => el.src).catch(() => 'no iframe');
  console.log('VidSrc iframe src:', iframeSrc);
}

await page.screenshot({ path: './test_film_buttons.png', fullPage: false });

// ─── SÉRIE ────────────────────────────────────────────────────────────────────
console.log('\n═══ SÉRIE (76669 The Rookie) ═══');
await page.goto('http://localhost:3000/tv/76669', { waitUntil: 'domcontentloaded', timeout: 20000 });
await page.waitForTimeout(4000);

// Click on first episode
const startBtn = await page.getByRole('button', { name: /Commencer|épisode|Lancer/i }).first().catch(() => null);
if (startBtn && await startBtn.isVisible().catch(() => false)) {
  await startBtn.click();
  await page.waitForTimeout(2000);
}

const tvBtns = await page.$$eval('button', btns => btns.map(b => b.textContent?.trim()).filter(Boolean));
const tvEmbed = EMBED_SOURCES.filter(s => tvBtns.includes(s));
console.log('Boutons embed trouvés (TV):', tvEmbed);
console.log('Manquants:', EMBED_SOURCES.filter(s => !tvBtns.includes(s)));

await page.screenshot({ path: './test_tv_buttons.png', fullPage: false });

// ─── ANIME ────────────────────────────────────────────────────────────────────
console.log('\n═══ ANIME (46260 Naruto) ═══');
await page.goto('http://localhost:3000/tv/46260', { waitUntil: 'domcontentloaded', timeout: 20000 });
await page.waitForTimeout(4000);

const animeStartBtn = await page.getByRole('button', { name: /Commencer|épisode|Lancer/i }).first().catch(() => null);
if (animeStartBtn && await animeStartBtn.isVisible().catch(() => false)) {
  await animeStartBtn.click();
  await page.waitForTimeout(2000);
}

const animeBtns = await page.$$eval('button', btns => btns.map(b => b.textContent?.trim()).filter(Boolean));
const animeEmbed = EMBED_SOURCES.filter(s => animeBtns.includes(s));
console.log('Boutons embed trouvés (anime):', animeEmbed);

await page.screenshot({ path: './test_anime_buttons.png', fullPage: false });

await browser.close();
console.log('\nScreenshots: test_film_buttons.png / test_tv_buttons.png / test_anime_buttons.png');
