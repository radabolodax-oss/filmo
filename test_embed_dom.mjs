import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });

// ─── FILM ─────────────────────────────────────────────────────────────────────
console.log('\n═══ FILM (76600 Avatar 2) ═══');
await page.goto('http://localhost:3000/movie/76600', { waitUntil: 'domcontentloaded', timeout: 20000 });
await page.waitForTimeout(5000);

// Cherche tous les boutons avec leur texte
const allBtns = await page.$$eval('button', btns => btns.map(b => b.textContent?.trim()).filter(Boolean));
console.log('Tous les boutons:', allBtns.join(' | '));

// Scroll down pour voir si le player est visible
await page.evaluate(() => window.scrollBy(0, 600));
await page.waitForTimeout(1000);
await page.screenshot({ path: './test_movie_scroll.png' });

// Cherche le panel "Lecteurs"
const hasLecteurs = await page.$('text=Lecteurs').catch(() => null);
console.log('Panel Lecteurs trouvé:', !!hasLecteurs);

const hasVidSrc = await page.$('button:text("VidSrc")').catch(() => null);
console.log('Bouton VidSrc trouvé:', !!hasVidSrc);

// Full page screenshot
await page.screenshot({ path: './test_movie_full.png', fullPage: true });

// ─── SÉRIE ────────────────────────────────────────────────────────────────────
console.log('\n═══ SÉRIE (76669 The Rookie) ═══');
await page.goto('http://localhost:3000/tv/76669', { waitUntil: 'domcontentloaded', timeout: 20000 });
await page.waitForTimeout(5000);

const tvAllBtns = await page.$$eval('button', btns => btns.map(b => b.textContent?.trim()).filter(Boolean));
console.log('Tous les boutons:', tvAllBtns.join(' | '));

const tvHasLecteurs = await page.$('text=Lecteurs').catch(() => null);
console.log('Panel Lecteurs trouvé:', !!tvHasLecteurs);

await page.screenshot({ path: './test_tv_full.png', fullPage: true });

// ─── ANIME ────────────────────────────────────────────────────────────────────
console.log('\n═══ ANIME (46260 Naruto) ═══');
await page.goto('http://localhost:3000/tv/46260', { waitUntil: 'domcontentloaded', timeout: 20000 });
await page.waitForTimeout(5000);

const animeAllBtns = await page.$$eval('button', btns => btns.map(b => b.textContent?.trim()).filter(Boolean));
console.log('Tous les boutons:', animeAllBtns.join(' | '));

const animeHasLecteurs = await page.$('text=Lecteurs').catch(() => null);
console.log('Panel Lecteurs trouvé:', !!animeHasLecteurs);

await page.screenshot({ path: './test_anime_full.png', fullPage: true });

await browser.close();
console.log('\nDone.');
