import { chromium } from './node_modules/playwright/index.mjs';

const URL = 'http://localhost:3000/tv/dNVc3MBeTbh5zPosp6OphaEx6seSUzLTtr';

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
  viewport: { width: 1280, height: 800 },
  ignoreHTTPSErrors: true,
});
const page = await context.newPage();

console.log('Navigating to page...');
try {
  await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(4000);
  const title = await page.title();
  console.log('Page title:', title);
  await page.screenshot({ path: 'C:/Users/PC/AppData/Local/Temp/page_initial.png', fullPage: false });
  console.log('Screenshot saved');
  
  // Find the player section - look for the source dropdown
  const sourceDropdown = await page.$('.source-dropdown');
  console.log('Source dropdown found:', !!sourceDropdown);
  
  // Try finding any button with player names
  const allButtons = await page.$$('button');
  console.log('Total buttons on page:', allButtons.length);
  
  for (const btn of allButtons) {
    const text = await btn.textContent();
    const trimmed = text?.trim();
    if (trimmed && trimmed.length < 30) {
      console.log('Button:', JSON.stringify(trimmed));
    }
  }
  
} catch (e) {
  console.error('Error:', e.message);
}

await browser.close();
