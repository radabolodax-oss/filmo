import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });

console.log('\n═══ TV après clic ═══');
await page.goto('http://localhost:3000/tv/76669', { waitUntil: 'domcontentloaded', timeout: 20000 });
await page.waitForTimeout(5000);

const startBtn = await page.getByRole('button', { name: /Commencer/i }).first();
await startBtn.click();
await page.waitForTimeout(3000);

await page.evaluate(() => {
  const el = Array.from(document.querySelectorAll('span')).find(s => s.textContent && s.textContent.trim() === 'Lecteurs');
  if (el) el.scrollIntoView({ block: 'center' });
});
await page.waitForTimeout(1000);
await page.screenshot({ path: './test_tv_lecteurs_scroll.png' });

// VidSrc dans le DOM ?
const vidsrcInDom = await page.evaluate(() => document.body.innerHTML.includes('VidSrc'));
console.log('VidSrc dans innerHTML:', vidsrcInDom);

// Section VOSTFR content
const vostfrHtml = await page.evaluate(() => {
  const paras = Array.from(document.querySelectorAll('p'));
  const vostfr = paras.find(function(p) { return p.textContent && p.textContent.includes('VOSTFR'); });
  if (!vostfr) return 'VOSTFR section not found';
  return vostfr.parentElement ? vostfr.parentElement.innerHTML.slice(0, 1500) : 'no parent';
});
console.log('Section VOSTFR:\n', vostfrHtml);

// Panel lecteurs outer HTML
const lecteursPanelHtml = await page.evaluate(() => {
  const spans = Array.from(document.querySelectorAll('span'));
  const lecteurs = spans.find(function(s) { return s.textContent && s.textContent.trim() === 'Lecteurs'; });
  if (!lecteurs) return 'Lecteurs span not found';
  var el = lecteurs;
  for (var i = 0; i < 5 && el.parentElement; i++) el = el.parentElement;
  return el.outerHTML ? el.outerHTML.slice(0, 3000) : 'no html';
});
console.log('\nPanel Lecteurs HTML (3000 chars):\n', lecteursPanelHtml);

// Film
console.log('\n═══ FILM après chargement ═══');
await page.goto('http://localhost:3000/movie/76600', { waitUntil: 'domcontentloaded', timeout: 20000 });
await page.waitForTimeout(6000);

const filmVidsrc = await page.evaluate(() => document.body.innerHTML.includes('VidSrc'));
console.log('VidSrc dans innerHTML film:', filmVidsrc);

const filmVostfrHtml = await page.evaluate(() => {
  const paras = Array.from(document.querySelectorAll('p'));
  const vostfr = paras.find(function(p) { return p.textContent && p.textContent.includes('VOSTFR'); });
  if (!vostfr) return 'VOSTFR not found';
  return vostfr.parentElement ? vostfr.parentElement.innerHTML.slice(0, 2000) : 'no parent';
});
console.log('Film VOSTFR section:\n', filmVostfrHtml);

await browser.close();
