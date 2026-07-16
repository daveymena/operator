import puppeteer from 'puppeteer';

const browser = await puppeteer.connect({ browserURL: 'http://127.0.0.1:9222' });
const page = await browser.newPage();
page.setViewport({ width: 1400, height: 900 });

// Go to Business Facebook where the SDK is loaded
await page.goto('https://business.facebook.com/latest/home?business_id=4482432028697067', { waitUntil: 'networkidle0', timeout: 30000 });
await new Promise(r => setTimeout(r, 5000));

const result = await page.evaluate(async () => {
  const data = {};

  // Look for token in various places
  try {
    // Check DTSG (security token) and other CSRF tokens
    const dtsgInput = document.querySelector('input[name="fb_dtsg"]');
    if (dtsgInput) data.fb_dtsg = dtsgInput.value.substring(0, 30);
  } catch(e) {}

  // Try to use the FB SDK if loaded
  try {
    if (typeof FB !== 'undefined') {
      data.fb_exists = true;
    }
  } catch(e) {}

  // Look for any stored access tokens in session or local storage
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      const val = localStorage.getItem(key);
      if (val && val.includes('EAAB')) {
        const m = val.match(/EAAB[a-zA-Z0-9_-]+ZDZD/);
        if (m) data.token_from_storage = m[0].substring(0, 40);
        break;
      }
    }
  } catch(e) {}

  // Try to find token in page state (React/Redux state)
  try {
    const root = document.getElementById('root') || document.getElementById('facebook');
    if (root) {
      const attrs = root.attributes;
      for (const attr of attrs) {
        if (attr.value && attr.value.includes('EAAB')) {
          const m = attr.value.match(/EAAB[a-zA-Z0-9_-]+ZDZD/);
          if (m) data.token_from_attr = m[0].substring(0, 40);
          break;
        }
      }
    }
  } catch(e) {}

  return data;
});

console.log(JSON.stringify(result, null, 2));

// Also get cookies relevant for API
const cookies = await page.cookies('https://graph.facebook.com');
console.log('Graph.facebook.com cookies: ' + cookies.map(c => c.name).join(', '));

const allCookies = await page.cookies();
const relevant = ['c_user', 'xs', 'fr', 'access_token', 'user_token'];
const found = allCookies.filter(c => relevant.some(r => c.name.includes(r)));
found.forEach(c => console.log('Cookie ' + c.name + ' = ' + c.value.substring(0, 40)));

await browser.disconnect();
