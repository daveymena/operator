import puppeteer from 'puppeteer';

const browser = await puppeteer.connect({ browserURL: 'http://127.0.0.1:9222' });
const pages = await browser.pages();

const page = pages.find(p => p.url().includes('ads/library'));
if (!page) { console.log('No ads library page'); await browser.disconnect(); process.exit(1); }
await page.bringToFront();

// Scroll down several times to load more ads
for (let i = 0; i < 8; i++) {
  await page.evaluate(() => window.scrollBy(0, 600));
  await new Promise(r => setTimeout(r, 2000));
}
console.log('Scrolled to load more ads');

// Now extract ad text
const ads = await page.evaluate(() => {
  const divs = document.querySelectorAll('div');
  const seen = new Set();
  const results = [];
  
  for (const div of divs) {
    if (div.offsetParent === null) continue;
    const text = (div.textContent || '').trim();
    
    // Only grab ad cards: contain 'Publicidad' and 'WhatsApp' or 'WHATSAPP'
    if (text.includes('Publicidad') && text.length > 100 && text.length < 1500) {
      const key = text.substring(0, 100);
      if (!seen.has(key)) {
        seen.add(key);
        results.push(text);
      }
    }
  }
  return results;
});

console.log('Unique ads found:', ads.length);
ads.forEach((ad, i) => {
  console.log('\n=== AD ' + (i+1) + ' ===');
  console.log(ad.substring(0, 600));
});

// Take screenshot of current view
await page.screenshot({ path: 'C:\\Users\\ADMIN\\Music\\proyecto-unificado\\_ads_library_scrolled.png' });
await browser.disconnect();
