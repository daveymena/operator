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
}

async function dialogClick(page, text) {
  return page.evaluate((t) => {
    const dialog = document.querySelector('[role="dialog"]');
    if (!dialog) return false;
    const all = Array.from(dialog.querySelectorAll('*'));
    const el = all.find(e => e.offsetParent && (e.textContent || '').trim() === t);
    if (el) { el.click(); return true; }
    return false;
  }, text);
}

async function main() {
  console.log('🔌 Conectando...');
  const browser = await puppeteer.connect({ browserURL: 'http://localhost:9222', defaultViewport: null });
  const page = (await browser.pages())[0];

  // Intercept API
  let apiToken = null;
  page.on('response', async (response) => {
    if (apiToken) return;
    try {
      const url = response.url();
      if (!url.includes('graph.facebook.com') && !url.includes('facebook.com/api')) return;
      const ct = response.headers()['content-type'] || '';
      if (!ct.includes('json')) return;
      const json = await response.json().catch(() => null);
      if (!json) return;
      if (json.access_token && json.access_token.length > 170) {
        apiToken = json.access_token;
        console.log(`\n  🎯 API Token! ${apiToken.substring(0, 20)}...`);
      }
    } catch {}
  });

  // Navegar
  await page.goto(`https://business.facebook.com/latest/settings/system_users?business_id=${BM_ID}`, { waitUntil: 'networkidle2', timeout: 30000 }).catch(() => {});
  await wait(5000);
  await page.evaluate(() => {
    const els = Array.from(document.querySelectorAll('a,span,div,li'));
    for (const e of els) { if (e.offsetParent && (e.textContent||'').trim().toLowerCase() === 'usuarios del sistema') { e.click(); return; } }
  });
  await wait(8000);

  // PASO 1: Click "Generar identificador"
  console.log('\n📍 PASO 1: Abrir Generar identificador...');
  await page.evaluate(() => {
    const all = Array.from(document.querySelectorAll('*'));
    const btn = all.find(e => e.offsetParent && e.textContent.trim() === 'Generar identificador' && e.childElementCount === 0);
    if (btn) btn.click();
  });
  await wait(5000);

  // Select app from combo
  console.log('📍 Seleccionar app...');
  await page.evaluate(() => {
    const dialog = document.querySelector('[role="dialog"]');
    if (!dialog) return;
    const all = Array.from(dialog.querySelectorAll('*'));
    const combo = all.find(e => e.offsetParent && e.getAttribute('role') === 'combobox');
    if (combo) combo.click();
    else {
      const picker = all.find(e => e.offsetParent && (e.textContent || '').includes('Ninguna aplicación'));
      if (picker) picker.click();
    }
  });
  await wait(2000);
  await page.keyboard.type('ventas-pro', { delay: 10 });
  await wait(3000);
  await page.keyboard.press('Enter');
  await wait(2000);
  await page.evaluate(() => {
    const all = Array.from(document.querySelectorAll('*'));
    const el = all.find(e => e.offsetParent && (e.textContent || '').trim() === 'ventas-pro');
    if (el) el.click();
  });
  await wait(3000);

  // PASO 2: Establecer caducidad - click "Never" option or "Siguiente"
  console.log('📍 PASO 2: Caducidad...');
  console.log('  Buscando opciones de caducidad...');
  const expiryOptions = await page.evaluate(() => {
    const dialog = document.querySelector('[role="dialog"]');
    if (!dialog) return [];
    const all = Array.from(dialog.querySelectorAll('*'));
    const texts = all.filter(e => e.offsetParent).map(e => (e.textContent || '').trim());
    return [...new Set(texts)].filter(t => t.length > 0 && t.length < 50).slice(10, 30);
  });
  console.log('  Dialog texts:', expiryOptions);

  // Try clicking "Never" or "No expiry" or similar
  for (const opt of ['Never', 'Nunca', 'No expire', 'Sin caducidad', 'Permanent', 'Permanente']) {
    const cl = await dialogClick(page, opt);
    if (cl) { console.log(`  Clicked: ${opt}`); break; }
  }
  
  // Find radio buttons or selectors
  const radios = await page.evaluate(() => {
    const dialog = document.querySelector('[role="dialog"]');
    if (!dialog) return [];
    return Array.from(dialog.querySelectorAll('[role="radio"], input[type="radio"]'))
      .filter(e => e.offsetParent)
      .map(e => ({ label: (e.parentElement?.textContent || '').trim().substring(0, 40), checked: e.checked || e.getAttribute('aria-checked') === 'true' }));
  });
  if (radios.length) {
    console.log('  Radios:', radios);
    // Click the first unchecked radio
    for (const r of radios) {
      if (r.label.toLowerCase().includes('never') || r.label.toLowerCase().includes('nunca') || r.label.toLowerCase().includes('no')) {
        await page.evaluate((label) => {
          const dialog = document.querySelector('[role="dialog"]');
          if (!dialog) return;
          const all = Array.from(dialog.querySelectorAll('*'));
          const el = all.find(e => e.offsetParent && (e.textContent || '').trim().toLowerCase().includes(label.toLowerCase()));
          if (el) el.click();
        }, r.label);
        await wait(1000);
        console.log(`  Clicked radio: ${r.label}`);
        break;
      }
    }
  }

  // Click Siguiente
  await dialogClick(page, 'Siguiente');
  console.log('  Click Siguiente');
  await wait(3000);

  // PASO 3: Asignar permisos / Listo
  console.log('📍 PASO 3: Permisos / Listo...');
  const stateP3 = await page.evaluate(() => {
    const d = document.querySelector('[role="dialog"]');
    if (!d) return 'no dialog';
    const buttons = [...new Set(Array.from(d.querySelectorAll('*'))
      .filter(e => e.offsetParent && e.textContent.trim().length < 40 && e.textContent.trim().length > 0)
      .map(e => e.textContent.trim()))];
    return { text: d.textContent.trim().substring(0, 500), buttons };
  });
  console.log('  P3:', JSON.stringify(stateP3, null, 2));

  // Try "Listo" first, then "Generar identificador"
  if (typeof stateP3 === 'object') {
    if (stateP3.buttons?.includes('Listo')) {
      await dialogClick(page, 'Listo');
      console.log('  Click Listo');
      await wait(5000);
    } else if (stateP3.buttons?.includes('Generar identificador')) {
      await dialogClick(page, 'Generar identificador');
      console.log('  Click Generar');
      await wait(5000);
    }
  }

  // Buscar token
  if (apiToken) {
    saveToken(apiToken);
    console.log('\n📊 Probando...');
    const e = s => encodeURIComponent(s);
    const ad = await fetch(`https://graph.facebook.com/v21.0/act_${AD_ACCOUNT}?fields=name&access_token=${e(apiToken)}`).then(r => r.json());
    console.log(`  Ad: ${ad.name || ad.error?.message || '?'}`);
    browser.disconnect();
    return;
  }

  const domToken = await page.evaluate(() => {
    const d = document.querySelector('[role="dialog"]');
    if (d) {
      const inputs = Array.from(d.querySelectorAll('input'));
      for (const inp of inputs) if (inp.value && inp.value.length > 170) return inp.value;
    }
    const m = document.body.innerText.match(/\b(EA[A-Z][A-Za-z0-9_-]{170,300})\b/);
    return m ? m[1] : null;
  });

  if (domToken) {
    saveToken(domToken);
    console.log('\n📊 Probando...');
    const e = s => encodeURIComponent(s);
    const ad = await fetch(`https://graph.facebook.com/v21.0/act_${AD_ACCOUNT}?fields=name&access_token=${e(domToken)}`).then(r => r.json());
    console.log(`  Ad: ${ad.name || ad.error?.message || '?'}`);
  } else {
    console.log('❌ No token. Diálogo final:');
    console.log(stateP3?.text?.substring(0, 500));
    await page.screenshot({ path: path.join(__dirname, 'debug_v20.png') });
  }

  browser.disconnect();
}

main().catch(e => { console.error('Fatal:', e.message); process.exit(1); });
