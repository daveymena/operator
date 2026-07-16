import puppeteer from 'puppeteer';

const browser = await puppeteer.connect({ browserURL: 'http://127.0.0.1:9222' });
const page = await browser.newPage();
page.setViewport({ width: 1400, height: 900 });

await page.goto('https://www.facebook.com/ads/manager/accounts/me/', { waitUntil: 'networkidle0', timeout: 30000 });
await new Promise(r => setTimeout(r, 3000));

console.log('Current URL: ' + page.url());

// Try to extract token from scripts
const fbToken = await page.evaluate(() => {
  try {
    const scripts = document.querySelectorAll('script');
    for (const s of scripts) {
      const text = s.textContent || '';
      const idx = text.indexOf('EAAB');
      if (idx >= 0) {
        const match = text.substring(idx).match(/EAAB[a-zA-Z0-9_-]+ZDZD/);
        if (match) return match[0];
      }
    }
  } catch (e) {}
  return null;
});
console.log('Token in script: ' + (fbToken ? fbToken.substring(0, 40) + '...' : 'none'));

// Try to get via cookie-based approach - make a Graph API call through fetch
const testResult = await page.evaluate(async () => {
  try {
    const r = await fetch('https://graph.facebook.com/v22.0/me?fields=id,name&access_token=', { credentials: 'include' });
    return await r.text();
  } catch (e) {
    return 'Error: ' + e.message;
  }
});
console.log('Graph API test (first 200): ' + (testResult || '').substring(0, 200));

await browser.disconnect();
