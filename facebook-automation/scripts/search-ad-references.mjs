import puppeteer from 'puppeteer';
import fs from 'fs';

const browser = await puppeteer.connect({ browserURL: 'http://127.0.0.1:9222' });
const pages = await browser.pages();

// Find or create a page for the Ads Library
let page = pages.find(p => p.url().includes('ads/library'));
if (!page) {
  page = await browser.newPage();
  await page.setViewport({ width: 1920, height: 1080 });
}

const OUTPUT_DIR = 'C:\\Users\\ADMIN\\Music\\proyecto-unificado\\_ad_references';
fs.mkdirSync(OUTPUT_DIR, { recursive: true });

const searches = [
  { q: 'curso inteligencia artificial Colombia', file: 'ia' },
  { q: 'curso programacion online Colombia', file: 'programacion' },
  { q: 'curso diseño grafico online Colombia', file: 'diseno' },
  { q: 'curso ingles online Colombia WhatsApp', file: 'ingles' },
  { q: 'curso piano online Colombia', file: 'piano' },
];

for (const s of searches) {
  const url = 'https://www.facebook.com/ads/library/?active_status=all&ad_type=all&country=CO&q=' + encodeURIComponent(s.q) + '&sort_data[direction]=desc&sort_data[mode]=relevancy_monthly_grouped';
  
  console.log('Buscando:', s.q);
  await page.goto(url, { timeout: 30000, waitUntil: 'domcontentloaded' });
  await new Promise(r => setTimeout(r, 5000));
  
  // Scroll to load ads
  for (let i = 0; i < 4; i++) {
    await page.evaluate(() => window.scrollBy(0, 500));
    await new Promise(r => setTimeout(r, 1500));
  }
  
  // Take full screenshot
  await page.screenshot({ 
    path: OUTPUT_DIR + '\\' + s.file + '_full.png',
    fullPage: true 
  });
  
  // Also take a viewport screenshot showing the first visible ads
  await page.evaluate(() => window.scrollTo(0, 0));
  await new Promise(r => setTimeout(r, 500));
  await page.screenshot({ 
    path: OUTPUT_DIR + '\\' + s.file + '_top.png'
  });
  
  console.log('  Capturas guardadas');
}

await browser.disconnect();
console.log('\nTodas las capturas en: ' + OUTPUT_DIR);
