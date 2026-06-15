const { chromium } = require('playwright');
const fs = require('fs');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
  });
  const page = await ctx.newPage();
  await page.setViewportSize({ width: 1280, height: 900 });

  const errors = [];
  const networkReqs = [];

  page.on('console', msg => {
    if (msg.type() === 'error') errors.push(msg.text());
  });
  page.on('request', req => {
    if (req.url().includes('anicloud')) networkReqs.push({ url: req.url(), method: req.method() });
  });
  page.on('response', res => {
    if (res.url().includes('anicloud')) networkReqs.push({ url: res.url(), status: res.status() });
  });

  // 1. Cherche un anime — on va directement sur Naruto Shippuden (TMDB ID 31910)
  console.log('Step 1: Navigate to Naruto Shippuden TVDetails page');
  await page.goto('http://localhost:3000/tv/31910', { waitUntil: 'networkidle', timeout: 25000 });
  await page.waitForTimeout(2000);
  await page.screenshot({ path: 'C:/Users/PC/Desktop/prowler/MovixOpenSource-main/ac_step1_detail.png' });
  console.log('  => Page title:', await page.title());

  // 2. Clique sur le bouton Regarder / épisode 1
  console.log('Step 2: Click episode 1 to open player');
  const regarderBtn = await page.$('button:has-text("Regarder"), button:has-text("Lire"), button:has-text("Épisode 1"), [data-episode="1"]');
  if (regarderBtn) {
    await regarderBtn.click();
    await page.waitForTimeout(2000);
  } else {
    // Scroll down and look for an episode button
    await page.evaluate(() => window.scrollBy(0, 600));
    await page.waitForTimeout(1000);
    const epBtn = await page.$('button:has-text("1")');
    if (epBtn) await epBtn.click();
    await page.waitForTimeout(2000);
  }
  await page.screenshot({ path: 'C:/Users/PC/Desktop/prowler/MovixOpenSource-main/ac_step2_player.png' });

  // 3. Cherche et clique sur le dropdown Lecteurs
  console.log('Step 3: Open source dropdown');
  await page.evaluate(() => window.scrollBy(0, 500));
  await page.waitForTimeout(500);

  // Cherche le bouton dropdown (contient "Frembed" ou "Lecteurs")
  const dropdownBtn = await page.$('button:has-text("Frembed"), button:has-text("AniCloud")');
  if (dropdownBtn) {
    await dropdownBtn.click();
    await page.waitForTimeout(500);
    await page.screenshot({ path: 'C:/Users/PC/Desktop/prowler/MovixOpenSource-main/ac_step3_dropdown_open.png' });
    console.log('  => Dropdown opened');

    // 4. Clique sur AniCloud
    const anicloudBtn = await page.$('button:has-text("AniCloud")');
    if (anicloudBtn) {
      await anicloudBtn.click();
      console.log('  => AniCloud selected');
    } else {
      console.log('  => AniCloud button NOT FOUND in dropdown');
    }
  } else {
    console.log('  => Dropdown button not found');
    const allBtns = await page.$$eval('button', btns => btns.map(b => b.textContent.trim()).filter(t => t).slice(0, 30));
    console.log('  => Available buttons:', allBtns);
  }

  // 5. Attends le chargement AniCloud
  console.log('Step 4: Wait for AniCloud to load (up to 10s)');
  await page.waitForTimeout(10000);
  await page.screenshot({ path: 'C:/Users/PC/Desktop/prowler/MovixOpenSource-main/ac_step4_loading.png' });

  // Résultat
  const iframe = await page.$('iframe[src*="anicloud"], iframe[src*="vidzy"], iframe[src*="sibnet"], iframe[src*="vidmoly"], iframe[src*="luluvid"]');
  const errorMsg = await page.$('text=Anime non trouvé, text=indisponible, text=Erreur');
  const loadingSpinner = await page.$('.animate-spin');

  console.log('\n=== RESULTS ===');
  console.log('AniCloud iframe found:', !!iframe);
  if (iframe) console.log('  iframe src:', await iframe.getAttribute('src'));
  console.log('Error message shown:', !!errorMsg);
  console.log('Still loading:', !!loadingSpinner);
  console.log('Console errors:', errors.slice(0, 10));
  console.log('Network requests to anicloud:', JSON.stringify(networkReqs, null, 2));

  fs.writeFileSync('C:/Users/PC/Desktop/prowler/MovixOpenSource-main/ac_results.json', JSON.stringify({
    iframeFound: !!iframe,
    iframeSrc: iframe ? await iframe.getAttribute('src') : null,
    errorShown: !!errorMsg,
    stillLoading: !!loadingSpinner,
    consoleErrors: errors,
    networkReqs
  }, null, 2));

  await browser.close();
  console.log('done');
})().catch(e => { console.error(e.message); process.exit(1); });
