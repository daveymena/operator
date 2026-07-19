import puppeteer from 'puppeteer';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { setTimeout as wait } from 'timers/promises';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const APP_ID = '4238613976451604';
const BM_ID = '4482432028697067';
const SYSTEM_USER_ID = '61591903358831';
const PAGE_ID = '1278583508663384';
const AD_ACCOUNT = '1545022093928422';
const TOKEN_FILE = path.join(__dirname, 'facebook-automation', 'tokens', 'fb_tokens_output.json');

function saveToken(token) {
  const r = { accessToken: token, pageId: PAGE_ID, adAccountId: AD_ACCOUNT, bmId: BM_ID, systemUserId: SYSTEM_USER_ID };
  fs.writeFileSync(TOKEN_FILE, JSON.stringify(r, null, 2));
  console.log(`✅ Token guardado (${token.length} chars)`);
  return token;
}

async function testToken(token) {
  const e = s => encodeURIComponent(s);
  const tests = [
    ['Ad', `https://graph.facebook.com/v21.0/act_${AD_ACCOUNT}?fields=name&access_token=${e(token)}`],
    ['Page', `https://graph.facebook.com/v21.0/${PAGE_ID}?fields=name&access_token=${e(token)}`],
  ];
  for (const [label, url] of tests) {
    const r = await fetch(url).then(r => r.json()).catch(() => ({}));
    if (r.name) { console.log(`  ✅ ${label}: ${r.name}`); return true; }
    console.log(`  ❌ ${label}: ${r.error?.message || '?'}`);
  }
  return false;
}

async function clickExact(page, text) {
  return page.evaluate((t) => {
    const all = Array.from(document.querySelectorAll('*'));
    for (const el of all) {
      if (el.offsetParent && (el.textContent || '').trim() === t) {
        el.click(); return true;
      }
    }
    return false;
  }, text);
}

async function main() {
  console.log('🔌 Conectando...');
  const browser = await puppeteer.connect({ browserURL: 'http://localhost:9222', defaultViewport: null });
  const page = (await browser.pages())[0];

  // Navegar a System Users
  await page.goto(`https://business.facebook.com/latest/settings/system_users?business_id=${BM_ID}`, { waitUntil: 'networkidle2', timeout: 30000 }).catch(() => {});
  await wait(5000);
  await page.evaluate(() => {
    const els = Array.from(document.querySelectorAll('a,span,div,li'));
    for (const e of els) { if (e.offsetParent && (e.textContent||'').trim().toLowerCase() === 'usuarios del sistema') { e.click(); return; } }
  });
  await wait(8000);

  // ===== ASIGNAR ACTIVOS =====
  console.log('\n📍 Asignar activos...');
  
  // Cerrar cualquier diálogo previo
  await clickExact(page, 'Cerrar');
  await wait(1000);
  
  // Click "Asignar activos"
  await page.evaluate(() => {
    const all = Array.from(document.querySelectorAll('*'));
    const btns = all.filter(e => e.offsetParent && e.textContent.trim() === 'Asignar activos' && !e.getAttribute('role'));
    btns.forEach(b => b.click());
  });
  await wait(5000);

  // Seleccionar "Aplicaciones" como tipo de activo
  console.log('  Seleccionando pestaña "Aplicaciones"...');
  await clickExact(page, 'Aplicaciones');
  await wait(3000);

  // Buscar la aplicación ventas-pro
  const searchInputs = await page.$$('input[type="text"]');
  if (searchInputs.length > 0) {
    await searchInputs[0].click();
    await searchInputs[0].type('ventas-pro', { delay: 30 });
    await wait(3000);
    console.log('  Buscado: ventas-pro');
  }

  // Click en el resultado de búsqueda
  const appSelected = await page.evaluate(() => {
    const all = Array.from(document.querySelectorAll('*'));
    const el = all.find(e => e.offsetParent && (e.textContent || '').trim() === 'ventas-pro' && !e.querySelector('*'));
    if (el) { el.click(); return true; }
    // Try with text containing ventas-pro
    const el2 = all.find(e => e.offsetParent && e.textContent.trim().includes('ventas-pro'));
    if (el2) { el2.click(); return true; }
    // Try clicking any result that appeared
    const checkboxes = Array.from(document.querySelectorAll('[role="dialog"] input[type="checkbox"], [role="dialog"] [role="checkbox"]'));
    for (const cb of checkboxes) {
      if (cb.offsetParent) { cb.click(); return true; }
    }
    return false;
  });
  console.log(`  App seleccionada: ${appSelected}`);
  await wait(2000);

  // Asignar la página también
  await clickExact(page, 'Páginas de Facebook');
  await wait(2000);
  
  await page.evaluate(() => {
    const all = Array.from(document.querySelectorAll('*'));
    const el = all.find(e => e.offsetParent && (e.textContent || '').trim() === 'VentasPro - Cursos Digitales');
    if (el) el.click();
  });
  await wait(2000);

  // Click "Asignar activos" para confirmar
  console.log('  Confirmando asignación...');
  await page.evaluate(() => {
    const all = Array.from(document.querySelectorAll('*'));
    // Click the button that says "Asignar activos" inside the dialog
    const dialog = document.querySelector('[role="dialog"]');
    if (dialog) {
      const all2 = Array.from(dialog.querySelectorAll('*'));
      const confirmBtn = all2.find(e => e.offsetParent && e.textContent.trim() === 'Asignar activos');
      if (confirmBtn) confirmBtn.click();
    }
  });
  await wait(5000);

  // ===== GENERAR TOKEN =====
  console.log('\n🔑 Generar token...');
  
  await clickExact(page, 'Cerrar');
  await wait(1000);

  await page.evaluate(() => {
    const all = Array.from(document.querySelectorAll('*'));
    const btn = all.find(e => e.offsetParent && e.textContent.trim() === 'Generar identificador' && e.childElementCount === 0);
    if (btn) btn.click();
  });
  await wait(5000);

  // Ver diálogo
  const dialogText = await page.evaluate(() => {
    const d = document.querySelector('[role="dialog"]');
    return d ? (d.textContent || '').trim().substring(0, 500) : 'no dialog';
  });
  console.log('  Dialog:', dialogText);

  // Intentar seleccionar app en el picker
  await page.evaluate(() => {
    const dialog = document.querySelector('[role="dialog"]');
    if (!dialog) return;
    const all = Array.from(dialog.querySelectorAll('*'));
    const picker = all.find(e => e.offsetParent && (e.textContent || '').includes('Ninguna aplicación'));
    if (picker) picker.click();
  });
  await wait(3000);

  // Buscar ventas-pro en el page despues del click
  const appInPicker = await page.evaluate(() => {
    const all = Array.from(document.querySelectorAll('*'));
    for (const el of all) {
      if (el.offsetParent && (el.textContent || '').trim() === 'ventas-pro') {
        el.click();
        return 'clicked exact';
      }
    }
    for (const el of all) {
      if (el.offsetParent && (el.textContent || '').trim().includes('ventas-pro')) {
        el.click();
        return 'clicked partial';
      }
    }
    return 'not found';
  });
  console.log('  App pick result:', appInPicker);
  await wait(3000);

  // Click Siguiente
  await clickExact(page, 'Siguiente');
  await wait(3000);

  // Click Listo
  await clickExact(page, 'Listo');
  await wait(5000);

  // Extraer token
  const token = await page.evaluate(() => {
    const d = document.querySelector('[role="dialog"]');
    if (d) {
      const inputs = Array.from(d.querySelectorAll('input'));
      for (const inp of inputs) if (inp.value && inp.value.length > 170) return inp.value;
      const m = d.textContent.match(/\b(EA[A-Z][A-Za-z0-9_-]{170,300})\b/);
      if (m) return m[1];
    }
    const m2 = document.body.innerText.match(/\b(EA[A-Z][A-Za-z0-9_-]{170,300})\b/);
    return m2 ? m2[1] : null;
  });

  if (token) {
    console.log(`\n✅ Token: ${token.substring(0, 20)}...`);
    saveToken(token);
    await testToken(token);
  } else {
    console.log('❌ No se generó el token');
    await page.screenshot({ path: path.join(__dirname, 'debug_final_state.png') });
    
    // Mostrar el estado del diálogo
    const finalDialog = await page.evaluate(() => {
      const d = document.querySelector('[role="dialog"]');
      return d ? d.textContent.trim().substring(0, 500) : 'No dialog';
    });
    console.log('Estado final:', finalDialog);
  }

  browser.disconnect();
  console.log('\n🔵 Chrome queda abierto. Revisa la pantalla.');
}

main().catch(e => { console.error('Fatal:', e.message); process.exit(1); });
