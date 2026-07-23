import { chromium } from './node_modules/playwright/index.mjs';

const URL = 'http://localhost:3000/tv/dNVc3MBeTbh5zPosp6OphaEx6seSUzLTtr';
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, ignoreHTTPSErrors: true });
const page = await context.newPage();

await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 30000 });
await page.waitForTimeout(5000);

// Inspect the source-dropdown structure
const info = await page.evaluate(() => {
  const el = document.querySelector('.source-dropdown');
  if (!el) return { found: false };
  
  const directChildren = [...el.children].map(c => ({
    tag: c.tagName,
    class: c.className?.substring(0, 80),
    text: c.textContent?.trim()?.substring(0, 50)
  }));
  
  const allButtons = [...el.querySelectorAll('button')].map(b => ({
    text: b.textContent?.trim()?.substring(0, 50),
    class: b.className?.substring(0, 80),
    isDirectChild: b.parentElement === el
  }));
  
  return {
    found: true,
    parentClass: el.className,
    directChildren,
    allButtons,
    rect: el.getBoundingClientRect()
  };
});

console.log('source-dropdown info:', JSON.stringify(info, null, 2));

// Also check what's currently visible
const visibleSourceDropdowns = await page.evaluate(() => {
  const els = document.querySelectorAll('[class*="source"]');
  return [...els].map(el => ({
    class: el.className?.substring(0, 100),
    visible: el.getBoundingClientRect().width > 0 && el.getBoundingClientRect().height > 0
  }));
});
console.log('\nElements with "source" in class:', JSON.stringify(visibleSourceDropdowns, null, 2));

await page.screenshot({ path: 'C:/Users/PC/AppData/Local/Temp/dom_test.png' });
await browser.close();
