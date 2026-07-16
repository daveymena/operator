import puppeteer from 'puppeteer';

const browser = await puppeteer.connect({ browserURL: 'http://127.0.0.1:9222' });
const pages = await browser.pages();

const page = pages.find(p => p.url().includes('ads/library'));
if (!page) { console.log('No ads library page found'); await browser.disconnect(); process.exit(1); }
await page.bringToFront();

// Scroll to load more content
await page.evaluate(() => window.scrollTo(0, 300));
await new Promise(r => setTimeout(r, 2000));

const fullText = await page.evaluate(() => {
  const body = document.body.cloneNode(true);
  body.querySelectorAll('script, style, svg, noscript').forEach(el => el.remove());
  return body.innerText;
});

const lines = fullText.split('\n').filter(l => l.trim().length > 0);
console.log('Total lines:', lines.length);

let adCount = 0;
for (let i = 0; i < lines.length; i++) {
  const line = lines[i].trim();
  if (line === 'Publicidad') {
    adCount++;
    const start = Math.max(0, i - 2);
    const end = Math.min(lines.length, i + 30);
    console.log('\n=== AD ' + adCount + ' (line ' + i + ') ===');
    for (let j = start; j < end; j++) {
      const prefix = j < i ? '  ' : (j === i ? '> ' : '  ');
      console.log(prefix + lines[j].substring(0, 200));
    }
    if (adCount >= 8) break; // Get top 8 ads
  }
}

console.log('\n=== Total ads found: ' + adCount + ' ===');
await browser.disconnect();
