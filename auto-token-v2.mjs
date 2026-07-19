import puppeteer from 'puppeteer';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { setTimeout as wait } from 'timers/promises';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TOKEN_FILE = path.join(__dirname, 'facebook-automation', 'tokens', 'fb_tokens_output.json');
const BM_ID = '4482432028697067';
const PAGE_ID = '1278583508663384';
const AD_ACCOUNT = '1545022093928422';
const APP_ID = '4238613976451604';
const SYSTEM_USER_ID = '61591903358831';

function saveToken(token) {
  const result = { accessToken: token, pageId: PAGE_ID, pageName: 'VentasPro', adAccountId: AD_ACCOUNT, bmId: BM_ID, systemUserId: SYSTEM_USER_ID };
  fs.writeFileSync(TOKEN_FILE, JSON.stringify(result, null, 2));
  console.log(`Token guardado (length: ${token.length})`);
  return result;
}

async function main() {
  console.log('🔌 Conectando a Chrome...');
  const browser = await puppeteer.connect({ browserURL: 'http://localhost:9222', defaultViewport: null });
  const pages = await browser.pages();
  let page = pages[0];
  
  // 1. Obtener token de admin desde cookies/localStorage
  console.log('\n📍 Obteniendo token de admin del navegador...');
  const cookies = await browser.cookies();
  const fbCookie = cookies.find(c => c.name.includes('c_user') || c.name === 'c_user');
  if (fbCookie) console.log(`  Sesión FB activa (user: ${fbCookie.value})`);
  
  // Simple token extraction from localStorage
  const adminToken = await page.evaluate(() => {
    try {
      const entries = Object.entries(localStorage).filter(([k,v]) => v.includes('EAA') || v.includes('EAAG'));
      if (entries.length) return entries[0][1];
    } catch {}
    // Try sessionStorage
    try {
      for (let i = 0; i < sessionStorage.length; i++) {
        const k = sessionStorage.key(i);
        const v = sessionStorage.getItem(k);
        if (v && (v.startsWith('EAA') || v.startsWith('EAAG'))) return v;
      }
    } catch {}
    return null;
  }).catch(() => null);
  
  if (adminToken) {
    console.log(`  Admin token encontrado en storage (${adminToken.substring(0,20)}...)`);
    // Test it
    const r = await fetch(`https://graph.facebook.com/v21.0/me?access_token=${adminToken}`).then(r=>r.json());
    console.log(`  Test: ${r.name || r.error?.message || '?'}`);
  } else {
    console.log('  No token en storage');
  }

  // 2. Ir a la página del System User específico para generar su token
  console.log('\n📍 Navegando a página del System User...');
  await page.goto(`https://business.facebook.com/latest/settings/system_users/${SYSTEM_USER_ID}?business_id=${BM_ID}`, {
    waitUntil: 'networkidle2',
    timeout: 30000
  }).catch(() => {});
  await wait(5000);
  console.log(`  URL: ${page.url().substring(0, 120)}`);

  // 3. Buscar "Generate Token" / "Assign Assets" y generar
  console.log('\n⚡ Buscando opciones...');
  const bodyText = await page.evaluate(() => document.body.innerText).catch(() => '');
  console.log(`  Página contiene: ${bodyText.substring(0, 300).replace(/\n/g, ' | ')}`);

  // Tomar screenshot para ver dónde estamos
  await page.screenshot({ path: path.join(__dirname, 'debug-bm-page.png'), fullPage: false });
  console.log('  Screenshot guardado');

  // 4. Probar diferentes botones
  const clicked = await clickButton(page, [
    'Assign Assets', 'Asignar activos', 'Assign',
    'Generate Token', 'Generar token', 'Generate',
    'Edit', 'Editar'
  ]);
  console.log(`  Botón click: ${clicked}`);
  await wait(4000);

  const bodyText2 = await page.evaluate(() => document.body.innerText).catch(() => '');
  console.log(`  Después de click: ${bodyText2.substring(0, 300).replace(/\n/g, ' | ')}`);

  // 5. Si hay dialog, asignar Page + Ad Account
  console.log('\n📍 Asignando activos...');
  
  // Buscar sección de assets
  await clickButton(page, ['Add Assets', 'Añadir activos', 'Add', 'Añadir']);
  await wait(3000);
  
  // Buscar "Page" / "Ad Account" / "Ads"
  const addClicked = await clickButton(page, ['Page', 'Página', 'Ad Account', 'Ad account', 'Cuenta publicitaria']);
  console.log(`  Add asset type: ${addClicked}`);
  await wait(3000);

  // Buscar input para buscar página
  const searchInput = await page.$('input[type="text"], input[placeholder*="Search"], input[placeholder*="Buscar"]');
  if (searchInput) {
    await searchInput.click();
    await searchInput.type('VentasPro', { delay: 30 });
    await wait(2000);
    
    // Click result
    await clickButton(page, ['VentasPro', '1278583508663384']);
    await wait(1000);
    await clickButton(page, ['Save', 'Guardar', 'Añadir', 'Add']);
    await wait(3000);
    console.log('  Page assigned');
  }

  // 6. Generar token
  console.log('\n⚡ Generando token final...');
  await clickButton(page, ['Generate Token', 'Generar token', 'Generate Token']);
  await wait(5000);

  // 7. Extraer token
  const finalToken = await page.evaluate(() => {
    const text = document.body.innerText;
    const m = text.match(/\b(EAA[A-Za-z0-9_-]{150,250})\b/);
    if (m) return m[1];
    const m2 = text.match(/\b(EAAG[A-Za-z0-9_-]{150,250})\b/);
    if (m2) return m2[1];
    const inputs = Array.from(document.querySelectorAll('input[type="text"], input:not([type])'));
    for (const inp of inputs) {
      if (inp.value && (inp.value.startsWith('EAA') || inp.value.startsWith('EAAG')) && inp.value.length > 100) return inp.value;
    }
    return null;
  }).catch(() => null);

  if (finalToken) {
    console.log(`✅ Token extraído: ${finalToken.substring(0,30)}...${finalToken.slice(-10)}`);
    saveToken(finalToken);
    
    const r = await fetch(`https://graph.facebook.com/v21.0/${PAGE_ID}?fields=name&access_token=${finalToken}`).then(r=>r.json());
    console.log(`  Page test: ${r.name ? '✅ '+r.name : '❌ '+(r.error?.message||'?')}`);
    
    const r2 = await fetch(`https://graph.facebook.com/v21.0/act_${AD_ACCOUNT}?fields=name&access_token=${finalToken}`).then(r=>r.json());
    console.log(`  Ad Account test: ${r2.name ? '✅ '+r2.name : '❌ '+(r2.error?.message||'?')}`);
  } else {
    console.log('❌ No se pudo extraer token');
  }

  console.log('\n🔵 Chrome queda ABIERTO');
}

async function clickButton(page, texts, opts = {}) {
  for (const text of texts) {
    try {
      const els = await page.$$('button, [role="button"], a, span[role="link"], div[role="menuitem"], li');
      for (const el of els) {
        const t = (await el.evaluate(e => (e.textContent || '').trim().toLowerCase()).catch(() => ''));
        if (t.includes(text.toLowerCase())) {
          await el.click();
          await wait(opts.wait || 2000);
          return true;
        }
      }
    } catch {}
  }
  return false;
}

main().catch(e => { console.error('Fatal:', e.message); process.exit(1); });
