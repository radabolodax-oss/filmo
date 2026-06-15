const { chromium } = require('./node_modules/playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  // Navigate to home page
  await page.goto('http://localhost:3000', { waitUntil: 'networkidle', timeout: 20000 });
  console.log('Home loaded:', page.url());

  // Find a movie link
  const movieLinks = await page.evaluate(() => {
    return Array.from(document.querySelectorAll('a[href*="/movie/"]')).slice(0, 5).map(l => l.href);
  });
  console.log('Movie links:', movieLinks);

  if (!movieLinks.length) {
    console.log('No movie links found on home page, trying /movies');
    await page.goto('http://localhost:3000/movies', { waitUntil: 'networkidle', timeout: 15000 });
    const links2 = await page.evaluate(() => {
      return Array.from(document.querySelectorAll('a[href*="/movie/"]')).slice(0, 5).map(l => l.href);
    });
    console.log('Movie links on /movies:', links2);
    movieLinks.push(...links2);
  }

  if (!movieLinks.length) {
    console.log('Still no movie links, aborting');
    await browser.close();
    return;
  }

  // Go to the first movie page
  const movieUrl = movieLinks[0];
  console.log('\nNavigating to movie:', movieUrl);
  await page.goto(movieUrl, { waitUntil: 'networkidle', timeout: 20000 });
  await page.waitForTimeout(3000);

  // Check for video element
  const videoInfo = await page.evaluate(() => {
    const video = document.querySelector('video');
    const iframe = document.querySelector('iframe');
    return {
      hasVideo: !!video,
      videoSrc: video ? video.src : null,
      videoError: video ? video.error : null,
      hasIframe: !!iframe,
      iframeSrc: iframe ? iframe.src : null,
    };
  });
  console.log('Player info:', JSON.stringify(videoInfo, null, 2));

  // Take screenshot
  await page.screenshot({ path: 'test_movie_result.png', fullPage: false });
  console.log('Screenshot saved: test_movie_result.png');

  await browser.close();
})().catch(e => console.error('FATAL ERROR:', e.message));
