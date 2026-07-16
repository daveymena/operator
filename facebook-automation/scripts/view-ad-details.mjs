import puppeteer from 'puppeteer';

const browser = await puppeteer.connect({ browserURL: 'http://127.0.0.1:9222' });
const pages = await browser.pages();

let page = pages.find(p => p.url().includes('ads/library'));
if (!page) { page = await browser.newPage(); }
await page.setViewport({ width: 1920, height: 1080 });
await page.bringToFront();

// Search for IA courses
const q = 'curso inteligencia artificial Colombia';
await page.goto(
  'https://www.facebook.com/ads/library/?active_status=all&ad_type=all&country=CO&q=' +
  encodeURIComponent(q) +
  '&sort_data[direction]=desc&sort_data[mode]=relevancy_monthly_grouped',
  { timeout: 30000, waitUntil: 'domcontentloaded' }
);
await new Promise(r => setTimeout(r, 5000));
await page.evaluate(() => window.scrollBy(0, 300));
await new Promise(r => setTimeout(r, 2000));

// Get ALL visible ad cards text
const adsText = await page.evaluate(() => {
  const divs = document.querySelectorAll('div');
  const ads = [];
  const seen = new Set();
  for (const div of divs) {
    if (div.offsetParent === null) continue;
    const text = (div.textContent || '').trim();
    if (text.includes('Publicidad') && text.length > 100 && text.length < 2000) {
      const key = text.substring(0, 60);
      if (!seen.has(key)) {
        seen.add(key);
        ads.push(text);
      }
    }
  }
  return ads.slice(0, 10);
});

console.log('Ads found (first 10):');
adsText.forEach((ad, i) => {
  console.log('\n=== AD ' + (i+1) + ' ===');
  console.log(ad.substring(0, 800));
});

await page.screenshot({ path: 'C:\\Users\\ADMIN\\Music\\proyecto-unificado\\_ad_references\\ia_detail.png' });
await browser.disconnect();
