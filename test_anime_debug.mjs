import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });

console.log('\n═══ ANIME (46260 Naruto) ═══');
await page.goto('http://localhost:3000/tv/46260', { waitUntil: 'domcontentloaded', timeout: 20000 });
await page.waitForTimeout(4000);

const btns0 = await page.$$eval('button', btns => btns.map(b => b.textContent?.trim()).filter(Boolean));
console.log('Tous les boutons initiaux:', btns0);

// Click on index 0 — "Commencer l'épisode 1 de Saison 1"
const allBtnEls = await page.$$('button');
if (allBtnEls[0]) {
  console.log('Clic sur le 1er bouton...');
  await allBtnEls[0].click();
  await page.waitForTimeout(3000);
}

const btns1 = await page.$$eval('button', btns => btns.map(b => b.textContent?.trim()).filter(Boolean));
console.log('Boutons après clic:', btns1.slice(0, 30));

const hasLecteurs = await page.evaluate(() =>
  !!Array.from(document.querySelectorAll('span')).find(s => s.textContent?.trim() === 'Lecteurs')
);
console.log('Lecteurs visible:', hasLecteurs);

const hasVidsrc = await page.evaluate(() => document.body.innerHTML.includes('VidSrc'));
console.log('VidSrc dans DOM:', hasVidsrc);

// screenshot fullpage
await page.screenshot({ path: './test_anime_debug.png', fullPage: true });
console.log('Screenshot: test_anime_debug.png');

await browser.close();
