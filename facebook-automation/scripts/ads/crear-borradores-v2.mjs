import puppeteer from 'puppeteer';
import fs from 'fs';
import path from 'path';

const SS = 'C:\\Users\\ADMIN\\Music\\ss_ads';
const ADS_DIR = 'C:\\Users\\ADMIN\\Music\\proyecto-unificado\\facebook-automation\\assets\\images';
const PRODUCTS_FILE = 'C:\\Users\\ADMIN\\Music\\proyecto-unificado\\facebook-automation\\tokens\\megapack-82-productos.json';
const DRAFTS_FILE = 'C:\\Users\\ADMIN\\Music\\proyecto-unificado\\facebook-automation\\tokens\\ad-drafts.json';

fs.mkdirSync(SS, { recursive: true });

let step = 0;
async function shot(page, name) {
  step++;
  const p = `${SS}\\${String(step).padStart(2, '0')}_${name}.png`;
  await page.screenshot({ path: p, fullPage: false });
  console.log(`  📸 ${p}`);
}

async function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

async function clickByText(page, text, tag = 'button, [role="button"], a, div, span') {
  const els = await page.$$(tag);
  for (const el of els) {
    try {
      const t = await el.evaluate(e => (e.textContent || '').trim());
      if (t === text || t.startsWith(text) || t.includes(text)) {
        const box = await el.boundingBox();
        if (box) {
          await el.click();
          return true;
        }
      }
    } catch (e) {}
  }
  return false;
}

async function typeIntoField(page, label, value) {
  // Buscar input cerca de un label/texto
  const els = await page.$$('input, textarea, [contenteditable="true"]');
  for (const el of els) {
    try {
      const placeholder = await el.evaluate(e => e.placeholder || '');
      const ariaLabel = await el.evaluate(e => e.getAttribute('aria-label') || '');
      const nearby = placeholder + ' ' + ariaLabel;
      if (nearby.toLowerCase().includes(label.toLowerCase())) {
        await el.click();
        await el.evaluate(e => e.value = '');
        await el.type(value, { delay: 15 });
        return true;
      }
    } catch (e) {}
  }
  return false;
}

function getCategoryConfig() {
  const products = JSON.parse(fs.readFileSync(PRODUCTS_FILE, 'utf8'));
  const drafts = JSON.parse(fs.readFileSync(DRAFTS_FILE, 'utf8'));
  
  const categoryMap = {};
  products.forEach(p => {
    const name = p.name.toLowerCase();
    let cat = 'General';
    if (name.includes('diseño') || name.includes('diseno') || name.includes('infograf') || name.includes('photoshop') || name.includes('ilustra')) cat = 'Diseno';
    else if (name.includes('office') || name.includes('excel') || name.includes('instalador')) cat = 'Oficina';
    else if (name.includes('ingl') || name.includes('idioma')) cat = 'Idiomas';
    else if (name.includes('hack') || name.includes('seguridad')) cat = 'Hacking';
    else if (name.includes('marketing') || name.includes('seo') || name.includes('marca') || name.includes('logo')) cat = 'Marketing';
    else if (name.includes('arquitect') || name.includes('revit') || name.includes('ingenier') || name.includes('expediente') || name.includes('metrado') || name.includes('plano') || name.includes('carpinter')) cat = 'Ingenieria';
    else if (name.includes('programacion') || name.includes('programaci') || name.includes('desarrollo web') || name.includes('wordpress') || name.includes('ecommerc') || name.includes('aplicacion') || name.includes('interfaces')) cat = 'Programacion';
    else if (name.includes('piano')) cat = 'Piano';
    else if (name.includes('gastronom') || name.includes('cocina')) cat = 'Gastronomia';
    else if (name.includes('fotograf') || name.includes('video') || name.includes('filmora') || name.includes('premiere')) cat = 'Fotografia';
    else if (name.includes('musica') || name.includes('musical') || name.includes('guitarra') || name.includes('dj') || name.includes('audio')) cat = 'Musica';
    else if (name.includes('fitness') || name.includes('pilates') || name.includes('fuerza')) cat = 'Fitness';
    else if (name.includes('contabilidad') || name.includes('terapia') || name.includes('psicolo') || name.includes('autismo') || name.includes('contab')) cat = 'Profesional';
    else if (name.includes('kid') || name.includes('infantil') || name.includes('comic') || name.includes('condorito')) cat = 'Infantil';
    else if (name.includes('mega') || name.includes('completo') || name.includes('bundle') || name.includes('pack')) cat = 'Bundle';
    else cat = 'General';
    
    if (!categoryMap[cat]) categoryMap[cat] = [];
    categoryMap[cat].push(p);
  });
  
  return { categoryMap, products, drafts };
}

function getAdCopy(category, product, drafts) {
  const draft = drafts.find(d => d.productId === product.id);
  if (draft) return draft;
  
  return {
    productId: product.id,
    productName: product.name,
    price: `$${product.price.toLocaleString()} COP`,
    deliveryLink: product.deliveryLink || '',
    adCopy: `${product.name} - Solo $${product.price.toLocaleString()} COP\n\n${product.description}\n\n✅ Acceso Inmediato vía Google Drive`,
    headline: product.name,
    description: `Desde $${product.price.toLocaleString()} COP - Envio Inmediato`,
  };
}

function getBestImage(category) {
  const catLower = category.toLowerCase();
  const imageDir = ADS_DIR;
  
  const imagePriority = [
    `${catLower}-ad.png`,
    `${catLower}-final.png`,
    `${catLower}-product.png`,
    `${catLower}.jpg`,
    `${catLower}.png`,
  ];
  
  for (const img of imagePriority) {
    const p = path.join(imageDir, img);
    if (fs.existsSync(p)) return p;
  }
  
  // Buscar cualquier imagen que contenga la categoria
  const files = fs.readdirSync(imageDir).filter(f => 
    f.toLowerCase().includes(catLower) && 
    (f.endsWith('.jpg') || f.endsWith('.png') || f.endsWith('.jpeg'))
  );
  if (files.length > 0) return path.join(imageDir, files[0]);
  
  return null;
}

async function main() {
  console.log('🚀 CREANDO BORRADORES EN ADS MANAGER v2\n');
  
  const { categoryMap, drafts } = getCategoryConfig();
  const categories = Object.keys(categoryMap);
  console.log(`📦 ${categories.length} categorias para crear:`);
  categories.forEach((c, i) => {
    const products = categoryMap[c];
    const images = products.map(p => getBestImage(c.replace(/[A-Z]/g, '-$&').toLowerCase().replace(/^-/, '') || c.toLowerCase()));
    const hasImage = images.some(i => i);
    console.log(`  ${i+1}. ${c} (${products.length} productos) ${hasImage ? '🖼️' : '❌'}`);
  });
  
  // Conectar a Chrome
  console.log('\n[1] Conectando a Chrome...');
  const browser = await puppeteer.connect({ browserURL: 'http://127.0.0.1:9222', defaultViewport: null });
  
  // Usar pagina existente o crear nueva
  let page = (await browser.pages()).find(p => p.url().includes('adsmanager') || p.url().includes('facebook'));
  if (!page) {
    page = await browser.newPage();
  }
  
  // Navegar al Ads Manager
  console.log('[2] Navegando a Ads Manager...');
  await page.goto('https://adsmanager.facebook.com/adsmanager/manage/campaigns?act=1545022093928422&business_id=4482432028697067', {
    waitUntil: 'networkidle2',
    timeout: 30000
  }).catch(() => {});
  await sleep(5000);
  await shot(page, '00_adsmanager');
  
  // Click "Crear"
  console.log('\n[3] Click en "Crear"...');
  const clicked = await clickByText(page, 'Crear');
  console.log(`  Click: ${clicked}`);
  await sleep(4000);
  await shot(page, '01_click_crear');
  
  // Analizar el dialogo/modal que aparece
  const dialogInfo = await page.evaluate(() => {
    // Buscar el dialogo
    const dialogs = document.querySelectorAll('[role="dialog"], [role="menu"], [aria-modal="true"], .x1n2onr6, [data-pagelet]');
    const info = [];
    dialogs.forEach(d => {
      info.push({
        role: d.getAttribute('role') || '',
        class: (d.className || '').substring(0, 80),
        text: (d.textContent || '').substring(0, 200)
      });
    });
    
    // Buscar elementos clickables en el dialogo
    const clickables = [];
    document.querySelectorAll('[role="menuitem"], [role="option"], [role="radio"], [role="checkbox"], a[role="button"]').forEach(el => {
      clickables.push({
        text: (el.textContent || '').trim().substring(0, 50),
        role: el.getAttribute('role') || ''
      });
    });
    
    return { dialogs, clickables, bodyText: document.body.innerText.substring(0, 800) };
  });
  
  console.log(`\n  Dialogos encontrados: ${dialogInfo.dialogs.length}`);
  dialogInfo.dialogs.forEach(d => console.log(`    role="${d.role}" text="${d.text.substring(0, 80)}"`));
  console.log(`\n  Elementos clickables:`);
  dialogInfo.clickables.forEach(c => console.log(`    "${c.text}"`));
  console.log(`\n  Texto pagina:\n${dialogInfo.bodyText.substring(0, 400)}`);
  
  // Preguntar que tipo de creacion debemos seleccionar
  // La UI de ads manager tiene multiple opciones: "Campaña", "Anuncio", "Test A/B", etc.
  // O puede que muestre un wizard de creacion
  
  console.log('\n[4] Analizando wizard de creacion...');
  // Buscar si hay un panel de creacion con campos
  const formFields = await page.evaluate(() => {
    const inputs = [];
    document.querySelectorAll('input, textarea, select, [contenteditable="true"]').forEach(el => {
      const rect = el.getBoundingClientRect();
      if (rect.width > 50 && rect.height > 20) { // inputs visibles
        inputs.push({
          placeholder: el.placeholder || '',
          'aria-label': el.getAttribute('aria-label') || '',
          name: el.getAttribute('name') || '',
          type: el.type || el.getAttribute('role') || el.tagName,
          value: (el.value || '').substring(0, 50),
          visible: rect.top > 0 && rect.left > 0
        });
      }
    });
    return inputs;
  });
  
  console.log(`  Campos visibles: ${formFields.length}`);
  formFields.slice(0, 20).forEach(f => {
    if (f.visible) console.log(`    "${f.placeholder || f['aria-label'] || f.name}" (${f.type}) = "${f.value}"`);
  });
  
  await shot(page, '02_dialogo_crear');
  
  // Dependiendo de lo que veamos, tomamos accion
  // Si hay opciones de tipo (Campaña, Anuncio), seleccionamos "Anuncio" o "Campaña"
  const hasOption = dialogInfo.clickables.some(c => 
    c.text.toLowerCase().includes('campa') || c.text.toLowerCase().includes('anuncio')
  );
  
  if (hasOption) {
    console.log('\n[5] Seleccionando tipo de creacion...');
    // Intentar seleccionar "Campaña" primero
    const optClicked = await clickByText(page, 'Anuncio') || await clickByText(page, 'Campaña') || await clickByText(page, 'Campaign');
    console.log(`  Seleccion: ${optClicked}`);
    await sleep(3000);
    await shot(page, '03_objetivo_seleccionado');
  }
  
  // Si despues del click vemos un wizard, exploramos mas
  const wizardFields = await page.evaluate(() => {
    const inputs = [];
    document.querySelectorAll('input, textarea, [contenteditable="true"]').forEach(el => {
      const rect = el.getBoundingClientRect();
      if (rect.width > 50 && rect.height > 20) {
        inputs.push({
          placeholder: el.placeholder || '',
          label: el.getAttribute('aria-label') || '',
          type: el.type || el.tagName
        });
      }
    });
    // Buscar botones de continuar/siguiente
    const buttons = [];
    document.querySelectorAll('button, [role="button"], div[role="button"]').forEach(el => {
      const text = (el.textContent || '').trim();
      if (text && text.length < 30) buttons.push(text);
    });
    return { inputs: inputs.slice(0, 15), buttons: buttons.slice(0, 20) };
  });
  
  console.log(`\n  Campos del wizard:`);
  wizardFields.inputs.slice(0, 10).forEach(f => console.log(`    "${f.placeholder || f.label}" (${f.type})`));
  console.log(`\n  Botones wizard:`);
  wizardFields.buttons.forEach(b => console.log(`    "${b}"`));
  
  await shot(page, '04_wizard');
  
  console.log('\n✅ Analisis completado. Las capturas estan en: ' + SS);
  console.log('   Revisalas para entender la UI y poder automatizar los pasos siguientes.');
  
  await sleep(2000);
  await browser.disconnect();
}

main().catch(e => console.log('ERROR:', e.message));
