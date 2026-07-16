import puppeteer from 'puppeteer';
import fs from 'fs';

const browser = await puppeteer.connect({ browserURL: 'http://127.0.0.1:9222' });
let page = await browser.newPage();
await page.setViewport({ width: 1920, height: 1080 });

const OUTPUT = 'C:\\Users\\ADMIN\\Music\\proyecto-unificado\\_ad_references';
fs.mkdirSync(OUTPUT, { recursive: true });

// First, check arena.ai image capabilities
console.log('\n=== Verificando Arena.ai ===');
await page.goto('https://arena.ai/', { timeout: 20000, waitUntil: 'domcontentloaded' });
await new Promise(r => setTimeout(r, 3000));

const arenaText = await page.evaluate(() => document.body.innerText.substring(0, 3000));
console.log('Arena.ai content:');
console.log(arenaText.substring(0, 1000));

// Check if there's an image generation option
const arenaInfo = await page.evaluate(() => {
  const links = Array.from(document.querySelectorAll('a, button, [role=button]'));
  const imageRelated = links.filter(el => {
    const t = (el.textContent || '').toLowerCase();
    return t.includes('image') || t.includes('imagen') || t.includes('create') || t.includes('generat') || t.includes('model');
  });
  return imageRelated.map(l => ({ text: (l.textContent || '').trim().substring(0, 40), href: (l.href || '').substring(0, 80) }));
});
console.log('Image/creation links:', JSON.stringify(arenaInfo, null, 2));

// Try to access the Image Arena
await page.goto('https://arena.ai/image', { timeout: 15000, waitUntil: 'domcontentloaded' }).catch(() => {});
await new Promise(r => setTimeout(r, 3000));
const imgArenaText = await page.evaluate(() => document.body.innerText.substring(0, 1000));
console.log('\nImage Arena:', imgArenaText.substring(0, 500));

// Search for models list
await page.goto('https://arena.ai/models', { timeout: 15000, waitUntil: 'domcontentloaded' }).catch(() => {});
await new Promise(r => setTimeout(r, 3000));
const modelsText = await page.evaluate(() => document.body.innerText.substring(0, 2000));
console.log('\nModels:', modelsText.substring(0, 800));

await browser.disconnect();
