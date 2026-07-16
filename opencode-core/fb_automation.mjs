import puppeteer from '../Hello-World/web-operator/node_modules/puppeteer/index.js';
import fs from 'fs';
import path from 'path';

const OUT = 'C:\\Users\\ADMIN\\AppData\\Local\\Temp\\fb_audit';
fs.mkdirSync(OUT, { recursive: true });

function log(m) { console.log(`[FB] ${m}`); }

async function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

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
    log(`  - "${title}" (${url.substring(0, 100)})`);
  }

  // Buscar pestaña de Facebook Ads Manager
  let fbPage = pages.find(p => p.url().includes('facebook.com') || p.url().includes('business.facebook.com'));
  
  if (!fbPage) {
    log('No se encontró Facebook Ads Manager. Abriendo...');
    fbPage = await browser.newPage();
    await fbPage.goto('https://business.facebook.com/adsmanager', { waitUntil: 'networkidle0', timeout: 30000 });
  } else {
    log('Facebook Ads Manager encontrado. Enfocando...');
    await fbPage.bringToFront();
    await sleep(2000);
  }

  // Screenshot 1: Vista general
  await fbPage.screenshot({ path: path.join(OUT, '01_vista_general.png'), fullPage: false });
  log('Screenshot 1 guardado: vista general');

  // Obtener info de la página
  const pageContent = await fbPage.evaluate(() => {
    const text = document.body.innerText || '';
    return text.substring(0, 5000);
  });
  log(`Contenido visible:\n${pageContent.substring(0, 1000)}`);

  // Intentar navegar a la sección de anuncios/campañas
  const currentUrl = fbPage.url();
  log(`URL actual: ${currentUrl}`);

  // Tomar screenshot 2
  await sleep(1000);
  await fbPage.screenshot({ path: path.join(OUT, '02_ads_manager.png'), fullPage: false });
  log('Screenshot 2 guardado');

  // Intentar hacer clic en "Campañas" o "Ads Manager"
  try {
    const campaignLink = await fbPage.$('a[href*="campaigns"], a[href*="admanager"]');
    if (campaignLink) {
      await campaignLink.click();
      await sleep(3000);
      await fbPage.screenshot({ path: path.join(OUT, '03_campanias.png'), fullPage: false });
      log('Screenshot 3: campañas');
    }
  } catch (e) {
    log(`Error navegando: ${e.message}`);
  }

  // Obtener HTML para análisis
  const html = await fbPage.content();
  fs.writeFileSync(path.join(OUT, 'page.html'), html);

  log('=== AUDITORÍA COMPLETA ===');
  log(`Screenshots guardados en: ${OUT}`);

  await browser.disconnect();
}

main().catch(e => {
  console.error(`ERROR: ${e.message}`);
  process.exit(1);
});
