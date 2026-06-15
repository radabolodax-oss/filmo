import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
const page = await browser.newPage();
page.on('console', m => { if (m.type() === 'error') console.log('[console.error]', m.text()); });

const EMBED_NAMES = ['VidSrc', 'VidSrc.su', 'VidSrc.io', 'Peachify', '2Embed', 'AutoEmbed'];

async function getEmbedBtns(page) {
  return page.$$eval('button', (btns, names) =>
    btns.filter(b => names.includes(b.textContent?.trim())).map(b => b.textContent?.trim()),
    EMBED_NAMES
  );
}

async function clickAndGetIframe(page, btnText) {
  const btn = await page.getByRole('button', { name: btnText, exact: true }).first();
  if (!btn) return 'btn not found';
  await btn.click();
  await page.waitForTimeout(1500);
  return page.$eval('iframe#video-player-iframe', el => el.src).catch(() => 'no iframe found');
}

// ─── FILM : Avatar 2 (76600) ─────────────────────────────────────────────────
console.log('\n═══ FILM (76600 Avatar 2) ═══');
await page.goto('http://localhost:3000/movie/76600', { waitUntil: 'domcontentloaded', timeout: 20000 });
await page.waitForTimeout(4000);

const movieBtns = await getEmbedBtns(page);
console.log('Boutons embed présents:', movieBtns);

for (const name of EMBED_NAMES) {
  const src = await clickAndGetIframe(page, name);
  console.log(`  [${name}] iframe src: ${src}`);
}
await page.screenshot({ path: './test_movie_embed.png' });

// ─── SÉRIE : The Rookie (76669) ───────────────────────────────────────────────
console.log('\n═══ SÉRIE (76669 The Rookie) ═══');
await page.goto('http://localhost:3000/tv/76669', { waitUntil: 'domcontentloaded', timeout: 20000 });
await page.waitForTimeout(4000);

const tvBtns = await getEmbedBtns(page);
console.log('Boutons embed présents:', tvBtns);

for (const name of EMBED_NAMES) {
  const src = await clickAndGetIframe(page, name);
  console.log(`  [${name}] iframe src: ${src}`);
}
await page.screenshot({ path: './test_tv_embed.png' });

// ─── ANIME : Naruto (46260) ───────────────────────────────────────────────────
console.log('\n═══ ANIME (46260 Naruto) ═══');
await page.goto('http://localhost:3000/tv/46260', { waitUntil: 'domcontentloaded', timeout: 20000 });
await page.waitForTimeout(4000);

const animeBtns = await getEmbedBtns(page);
console.log('Boutons embed présents:', animeBtns);

for (const name of EMBED_NAMES) {
  const src = await clickAndGetIframe(page, name);
  console.log(`  [${name}] iframe src: ${src}`);
}
await page.screenshot({ path: './test_anime_embed.png' });

await browser.close();
console.log('\nDone. Screenshots: test_movie_embed.png / test_tv_embed.png / test_anime_embed.png');
