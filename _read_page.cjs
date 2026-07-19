const puppeteer = require('puppeteer');

(async () => {
  try {
    const b = await puppeteer.connect({ browserURL: 'http://127.0.0.1:9222', defaultViewport: null });
    const pages = await b.pages();
    const page = pages[0] || (await b.newPage());
    await page.goto('https://developers.facebook.com/apps', { waitUntil: 'networkidle2', timeout: 30000 }).catch(() => {});
    await new Promise(r => setTimeout(r, 3000));
    const bodyText = await page.evaluate(() => document.body.innerText).catch(() => 'N/A');
    console.log('=== PAGE TEXT ===');
    console.log(bodyText.substring(0, 3000));
    b.disconnect();
  } catch (e) {
    console.error('Error:', e.message);
  }
})();