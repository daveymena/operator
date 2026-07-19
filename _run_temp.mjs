import puppeteer from 'puppeteer';
const browser = await puppeteer.connect({ browserURL: 'http://127.0.0.1:9222', defaultViewport: null });
const pages = await browser.pages();
let page = pages[0] || await browser.newPage();

await page.goto('https://developers.facebook.com/tools/explorer/', { waitUntil: 'networkidle2', timeout: 30000 }).catch(() => {});
await new Promise(r => setTimeout(r, 4000));

console.log('Title:', await page.title());
console.log('URL:', page.url());

const text = await page.evaluate(() => document.body.innerText?.substring(0, 500) || '');
console.log('Text:', text.substring(0, 300));

const loggedIn = !text.includes('Iniciar sesi') && !text.includes('Log In');
console.log('Logged in:', loggedIn ? 'SI' : 'NO');

await page.screenshot({ path: 'C:/Users/ADMIN/Music/ss_ads_full/01_explorer.png' });
console.log('Screenshot OK');

const tokenInfo = await page.evaluate(() => {
  const inputs = document.querySelectorAll('input[type="text"], input:not([type="hidden"])');
  for (const inp of inputs) {
    if (inp.value && inp.value.startsWith('EA')) return { source: 'input', value: inp.value.substring(0, 50) };
  }
  const allText = document.body.innerText || '';
  const m = allText.match(/EAAB[a-zA-Z0-9_-]{80,}/);
  if (m) return { source: 'body', value: m[0].substring(0, 50) };
  return null;
});
console.log('Token found:', JSON.stringify(tokenInfo));

await browser.disconnect();
