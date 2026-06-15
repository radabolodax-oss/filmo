import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
const page = await browser.newPage();
page.on('console', m => console.log('[page]', m.type(), m.text()));

await page.goto('http://localhost:3000/movie/76600', { waitUntil: 'domcontentloaded', timeout: 20000 });
await page.waitForTimeout(5000);

const title = await page.title();
const url = page.url();
const bodyText = await page.$eval('body', el => el.innerText.slice(0, 800));

console.log('URL:', url);
console.log('Title:', title);
console.log('Body text (first 800 chars):\n', bodyText);

await page.screenshot({ path: './test_page_state.png', fullPage: true });
await browser.close();
console.log('Screenshot saved: test_page_state.png');
