const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
  const page = await browser.newPage();
  
  const logs = [];
  const networkReqs = [];
  
  page.on('console', msg => logs.push(`[${msg.type()}] ${msg.text()}`));
  page.on('request', req => {
    if (req.url().includes('purstream')) networkReqs.push(`REQ: ${req.method()} ${req.url()}`);
  });
  page.on('response', async resp => {
    if (resp.url().includes('purstream')) networkReqs.push(`RESP: ${resp.status()} ${resp.url()}`);
  });
  
  // Navigate to a movie page (Fight Club TMDB ID 550)
  console.log('Navigating to movie page...');
  await page.goto('http://localhost:3000/movie/550', { waitUntil: 'networkidle', timeout: 20000 });
  
  const title = await page.title();
  console.log('Page title:', title);
  
  // Take screenshot before clicking purstream
  await page.screenshot({ path: 'C:/Users/PC/AppData/Local/Temp/before_purstream.png' });
  
  // Look for purstream button
  const purstreamBtn = await page.$('[data-source="purstream"], button:has-text("Purstream"), button:has-text("purstream"), button:has-text("PurStream")');
  if (purstreamBtn) {
    console.log('Found purstream button, clicking...');
    await purstreamBtn.click();
    await page.waitForTimeout(5000);
    await page.screenshot({ path: 'C:/Users/PC/AppData/Local/Temp/after_purstream.png' });
  } else {
    console.log('Purstream button NOT found - searching all buttons...');
    const buttons = await page.$$eval('button', btns => btns.map(b => b.textContent?.trim()).filter(t => t).slice(0, 30));
    console.log('Available buttons:', JSON.stringify(buttons));
    await page.screenshot({ path: 'C:/Users/PC/AppData/Local/Temp/movie_page.png' });
  }
  
  console.log('\n=== Network requests to purstream ===');
  networkReqs.forEach(r => console.log(r));
  
  console.log('\n=== Console logs (purstream-related) ===');
  logs.filter(l => l.toLowerCase().includes('purstream')).forEach(l => console.log(l));
  
  await browser.close();
})().catch(e => { console.error('ERROR:', e.message); process.exit(1); });
