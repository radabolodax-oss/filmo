import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });

// ─── FILM : Avatar 2 (76600) ─────────────────────────────────────────────────
console.log('\n═══ FILM (76600) ═══');
await page.goto('http://localhost:3000/movie/76600', { waitUntil: 'domcontentloaded', timeout: 20000 });
await page.waitForTimeout(6000);

// Scroll jusqu'au panel Lecteurs
await page.evaluate(() => {
  const el = Array.from(document.querySelectorAll('span')).find(s => s.textContent?.includes('Lecteurs'));
  el?.scrollIntoView();
});
await page.waitForTimeout(1000);
await page.screenshot({ path: './test_film_lecteurs.png' });

// Tous les boutons dans le panel
const allBtns = await page.$$eval('button', btns => btns.map(b => b.textContent?.trim()).filter(Boolean));
console.log('Boutons page entière:', allBtns);

// HTML du panel lecteurs complet
const lecteursPanelHtml = await page.evaluate(() => {
  const spans = Array.from(document.querySelectorAll('span'));
  const lecteurs = spans.find(s => s.textContent?.trim() === 'Lecteurs');
  return lecteurs?.closest('div[class]')?.outerHTML?.slice(0, 2000) || 'not found';
});
console.log('HTML panel Lecteurs (2000 chars):\n', lecteursPanelHtml);

// ─── SÉRIE : The Rookie - cherche le bouton Commencer et clique ───────────────
console.log('\n═══ SÉRIE (76669 The Rookie) ═══');
await page.goto('http://localhost:3000/tv/76669', { waitUntil: 'domcontentloaded', timeout: 20000 });
await page.waitForTimeout(5000);

const tvTitle = await page.$eval('h1, h2', el => el.textContent).catch(() => 'no title');
console.log('Titre page:', tvTitle);

// Clique sur "Commencer l'épisode"
const startBtn = await page.getByRole('button', { name: /Commencer|épisode|Episode|Lancer/i }).first();
if (await startBtn.isVisible().catch(() => false)) {
  console.log('Bouton Commencer trouvé, clic...');
  await startBtn.click();
  await page.waitForTimeout(3000);
} else {
  console.log('Bouton Commencer non trouvé');
}

const tvAllBtns = await page.$$eval('button', btns => btns.map(b => b.textContent?.trim()).filter(Boolean));
console.log('Boutons après clic:', tvAllBtns);

const tvHasLecteurs = await page.evaluate(() => {
  return !!Array.from(document.querySelectorAll('span')).find(s => s.textContent?.trim() === 'Lecteurs');
});
console.log('Lecteurs visible après clic:', tvHasLecteurs);

await page.screenshot({ path: './test_tv_after_click.png', fullPage: true });

// ─── ANIME ────────────────────────────────────────────────────────────────────
console.log('\n═══ ANIME (46260 Naruto) ═══');
await page.goto('http://localhost:3000/tv/46260', { waitUntil: 'domcontentloaded', timeout: 20000 });
await page.waitForTimeout(5000);

const animeTitle = await page.$eval('h1, h2', el => el.textContent).catch(() => 'no title');
console.log('Titre page:', animeTitle);

const animeStartBtn = await page.getByRole('button', { name: /Commencer|épisode|Episode|Lancer/i }).first();
if (await animeStartBtn.isVisible().catch(() => false)) {
  console.log('Bouton Commencer trouvé, clic...');
  await animeStartBtn.click();
  await page.waitForTimeout(3000);
}

const animeAllBtns = await page.$$eval('button', btns => btns.map(b => b.textContent?.trim()).filter(Boolean));
console.log('Boutons après clic:', animeAllBtns);

const animeHasLecteurs = await page.evaluate(() => {
  return !!Array.from(document.querySelectorAll('span')).find(s => s.textContent?.trim() === 'Lecteurs');
});
console.log('Lecteurs visible après clic:', animeHasLecteurs);

await page.screenshot({ path: './test_anime_after_click.png', fullPage: true });

await browser.close();
console.log('\nScreenshots: test_film_lecteurs.png / test_tv_after_click.png / test_anime_after_click.png');
