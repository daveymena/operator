import puppeteer from 'puppeteer';
import fs from 'fs';

const SS = 'C:\\Users\\ADMIN\\Music\\ss_ads';
fs.mkdirSync(SS, { recursive: true });
let step = 0;
async function shot(page, name) { step++; const p=`${SS}\\${step}_${name}.png`; await page.screenshot({path:p}); console.log(`  📸 ${p}`); }
async function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
async function clickText(page, text) {
  const els = await page.$$('button, [role="button"], a, span, div');
  for (const el of els) {
    const t = (await el.evaluate(e => (e.textContent||'').trim())) || '';
    if (t.includes(text)) { await el.click(); return true; }
  }
  return false;
}
async function typeText(page, text) {
  await page.keyboard.type(text, { delay: 30 });
}

async function main() {
  console.log('🧠 CREANDO BORRADORES DIRECTAMENTE EN ADS MANAGER\n');
  
  const browser = await puppeteer.connect({ browserURL: 'http://127.0.0.1:9222', defaultViewport: null });
  let page = (await browser.pages()).find(p => p.url().includes('adsmanager') || p.url().includes('facebook'));
  if (!page) { console.log('No hay pagina abierta'); await browser.disconnect(); return; }
  
  // Ir al Ads Manager
  console.log('[1] Ads Manager...');
  await page.goto('https://adsmanager.facebook.com/adsmanager/manage/campaigns?act=1545022093928422&business_id=4482432028697067', { timeout: 20000 }).catch(() => {});
  await sleep(4000);
  await shot(page, 'adsmanager');
  
  // Ver que hay en la pagina
  const info = await page.evaluate(() => ({
    url: window.location.href,
    title: document.title,
    text: document.body.innerText.substring(0, 600)
  }));
  console.log(`  ${info.title}`);
  
  // Click "Crear campania" o "Create"
  console.log('\n[2] Buscando boton Crear...');
  const clicked = await clickText(page, 'Crear') || await clickText(page, 'Create');
  console.log(`  Click Crear: ${clicked}`);
  await sleep(3000);
  await shot(page, 'crear_campania');
  
  const after = await page.evaluate(() => document.body.innerText.substring(0, 400));
  console.log(`  ${after.substring(0, 200)}`);
  
  console.log('\n[3] Revisando opciones...');
  // Tomamos screenshot para que el usuario vea donde estamos
  console.log(`  Capturas en: ${SS}`);
  
  console.log('\n=== ESTRATEGIAS LISTAS PARA APLICAR ===');
  console.log('1. MacBooks: "El poder de Apple 🍎" - $10,000/día');
  console.log('2. Monitores: "Trabaja y juega con calidad 🖥️" - $6,000/día');
  console.log('3. Periféricos: "Escribe con estilo ✨" - $5,000/día');
  console.log('4. Audífonos: "Sumérgete en tu mundo 🎵" - $6,000/día');
  console.log('5. Laptops: "¿Tu PC ya no da más? ⚡" - $8,000/día');
  console.log('6. Cursos: "Aprende desde casa 🚀" - $5,000/día');
  
  console.log('\n⚠️ En la pantalla de Chrome aparecio el formulario.');
  console.log('Alli puedes crear las campanias manualmente con las estrategias de arriba');
  console.log('O dime si quieres que automatice los clics para llenar el formulario');
  
  await browser.disconnect();
}

main().catch(e => console.log('ERROR:', e.message));
