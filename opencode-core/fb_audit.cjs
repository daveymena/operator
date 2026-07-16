const puppeteer = require('../Hello-World/web-operator/node_modules/puppeteer');
const fs = require('fs');
const path = require('path');

const OUT = 'C:\\Users\\ADMIN\\AppData\\Local\\Temp\\fb_audit';
fs.mkdirSync(OUT, { recursive: true });

function log(m) { console.log(`[FB] ${m}`); }
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function main() {
  log('Conectando a Chrome con debugging en puerto 9222...');
  const browser = await puppeteer.connect({
    browserURL: 'http://127.0.0.1:9222',
    defaultViewport: null
  });

  const pages = await browser.pages();
  log(`Pestañas abiertas: ${pages.length}`);

  for (const p of pages) {
    const title = await p.title();
    const url = p.url();
    log(`  - "${title}"`);
    log(`    ${url.substring(0, 150)}`);
  }

  // Buscar pestaña de Facebook
  let fbPage = pages.find(p => p.url().includes('facebook.com') || p.url().includes('business.facebook.com'));
  
  if (!fbPage) {
    log('NO se encontró Facebook. Abriendo business.facebook.com...');
    fbPage = await browser.newPage();
    await fbPage.goto('https://business.facebook.com/adsmanager', { waitUntil: 'networkidle0', timeout: 30000 }).catch(e => {
      log(`Error al navegar: ${e.message}`);
    });
  } else {
    log('Facebook Ads Manager encontrado!');
    await fbPage.bringToFront();
    await sleep(3000);
  }

  // Screenshot
  const url = fbPage.url();
  const title = await fbPage.title();
  log(`URL actual: ${url}`);
  log(`Título: ${title}`);

  await fbPage.screenshot({ path: path.join(OUT, '01_ads_manager.png'), fullPage: false });
  log('Screenshot guardado en ' + OUT);

  // Extraer texto visible
  try {
    const text = await fbPage.evaluate(() => document.body.innerText || '');
    fs.writeFileSync(path.join(OUT, 'page_text.txt'), text.substring(0, 20000));
    log(`Texto extraído (${text.length} chars):`);
    log(text.substring(0, 3000));
  } catch (e) {
    log(`Error extrayendo texto: ${e.message}`);
  }

  // Extraer HTML para análisis
  try {
    const html = await fbPage.content();
    fs.writeFileSync(path.join(OUT, 'page.html'), html);
  } catch (e) {
    log(`Error extrayendo HTML: ${e.message}`);
  }

  log('=== AUDITORÍA COMPLETA ===');
  await browser.disconnect();
}

main().catch(e => {
  console.error(`ERROR: ${e.message}`);
  process.exit(1);
});
