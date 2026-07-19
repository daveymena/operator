import puppeteer from 'puppeteer';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { setTimeout as wait } from 'timers/promises';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const APP_ID = '4238613976451604';
const APP_NAME = 'ventas-pro';
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

  // Abrir diálogo "Generar identificador"
  console.log('\n🔑 Abriendo Generar identificador...');
  await page.evaluate(() => {
    const all = Array.from(document.querySelectorAll('*'));
    // Try multiple approaches to find the button
    const strategies = [
      () => all.find(e => e.offsetParent && e.textContent.trim() === 'Generar identificador' && e.childElementCount === 0),
      () => all.find(e => e.offsetParent && e.textContent.trim() === 'Generar identificador' && e.getAttribute('role') !== 'button'),
      () => all.find(e => e.offsetParent && e.textContent.trim() === 'Generar identificador'),
      () => {
        // By class name pattern
        const els = all.filter(e => e.offsetParent && e.textContent.includes('Generar') && e.textContent.includes('identificador'));
        return els[1] || els[0]; // Skip the first (usually sidebar label)
      }
    ];
    for (const s of strategies) {
      const btn = s();
      if (btn) { btn.click(); return; }
    }
  });
  await wait(5000);

  // Verificar estado del diálogo
  let dialogText = await page.evaluate(() => {
    const d = document.querySelector('[role="dialog"]');
    return d ? (d.textContent || '').trim().substring(0, 400) : 'no dialog';
  });
  console.log('Dialog:', dialogText);

  if (dialogText === 'no dialog') {
    console.log('❌ No hay diálogo. Revisando estado...');
    await page.screenshot({ path: path.join(__dirname, 'debug_no_dialog.png') });
    browser.disconnect();
    return;
  }

  // Analizar la estructura del diálogo para encontrar inputs/combo
  const structure = await page.evaluate(() => {
    const dialog = document.querySelector('[role="dialog"]');
    if (!dialog) return null;
    const res = { combo: [], inputs: [], buttons: [], options: [] };
    
    dialog.querySelectorAll('input').forEach(inp => {
      if (inp.offsetParent) {
        res.inputs.push({ id: inp.id, type: inp.type, placeholder: inp.placeholder, value: inp.value.substring(0, 20) });
      }
    });
    
    dialog.querySelectorAll('[role="combobox"]').forEach(el => {
      res.combo.push({ tag: el.tagName, id: el.id, text: (el.textContent || '').trim().substring(0, 60) });
    });
    
    dialog.querySelectorAll('[role="option"], [role="menuitem"]').forEach(el => {
      if (el.offsetParent) {
        res.options.push({ tag: el.tagName, text: (el.textContent || '').trim().substring(0, 60) });
      }
    });
    
    dialog.querySelectorAll('button, [role="button"], a[role="button"]').forEach(el => {
      if (el.offsetParent) {
        res.buttons.push({ tag: el.tagName, text: (el.textContent || '').trim().substring(0, 40), role: el.getAttribute('role') });
      }
    });
    
    return res;
  });
  console.log('Structure:', JSON.stringify(structure, null, 2).substring(0, 3000));

  // Si no hay combobox explícito, buscar cualquier input de texto en el diálogo
  // y escribir el nombre de la app
  let typed = false;
  if (structure && structure.inputs.length > 0) {
    for (const inpInfo of structure.inputs) {
      const handle = await page.$(`#${inpInfo.id}`);
      if (handle) {
        await handle.click();
        await handle.type(APP_NAME, { delay: 20 });
        typed = true;
        console.log(`Typed "${APP_NAME}" in #${inpInfo.id}`);
        await wait(2000);
        break;
      }
    }
  } else if (structure && structure.combo.length > 0) {
    // Try clicking the combobox
    for (const c of structure.combo) {
      const el = await page.$(`#${c.id}`);
      if (el) {
        await el.click();
        await wait(1000);
        await page.keyboard.type(APP_NAME, { delay: 20 });
        typed = true;
        console.log(`Typed in combobox #${c.id}`);
        await wait(2000);
        break;
      }
    }
  }

  if (!typed) {
    // Try clicking on "Ninguna aplicación seleccionada" and then typing
    await page.evaluate(() => {
      const dialog = document.querySelector('[role="dialog"]');
      if (!dialog) return;
      const all = Array.from(dialog.querySelectorAll('*'));
      const picker = all.find(e => e.offsetParent && (e.textContent || '').includes('Ninguna aplicación'));
      if (picker) picker.click();
    });
    await wait(2000);
    await page.keyboard.type(APP_NAME, { delay: 20 });
    typed = true;
    console.log('Typed after clicking picker');
    await wait(3000);
  }

  // Buscar options que aparecieron
  const options = await page.evaluate(() => {
    const dialog = document.querySelector('[role="dialog"]');
    if (!dialog) return [];
    const res = [];
    dialog.querySelectorAll('[role="option"], [role="menuitem"], [class*="option"]').forEach(el => {
      if (el.offsetParent) res.push((el.textContent || '').trim().substring(0, 60));
    });
    return [...new Set(res)];
  });
  console.log('Options found:', options);

  // Intentar seleccionar la app
  const selected = await page.evaluate((appName) => {
    const all = Array.from(document.querySelectorAll('*'));
    for (const el of all) {
      if (!el.offsetParent) continue;
      const t = (el.textContent || '').trim();
      if (t === appName || t === 'ventas-pro') {
        el.click();
        return 'exact: ' + t;
      }
    }
    for (const el of all) {
      if (!el.offsetParent) continue;
      const t = (el.textContent || '').trim();
      if (t.includes('ventas-pro') || t.includes('VentasPro') || t.includes(APP_ID)) {
        el.click();
        return 'partial: ' + t.substring(0, 40);
      }
    }
    return 'not found';
  }, APP_NAME);
  console.log('Selection:', selected);
  await wait(3000);

  // Click Siguiente
  await page.evaluate(() => {
    const dialog = document.querySelector('[role="dialog"]');
    if (!dialog) return;
    const all = Array.from(dialog.querySelectorAll('*'));
    const next = all.find(e => e.offsetParent && (e.textContent || '').trim() === 'Siguiente');
    if (next) next.click();
  });
  await wait(3000);

  // Click Listo
  await page.evaluate(() => {
    const dialog = document.querySelector('[role="dialog"]');
    if (!dialog) return;
    const all = Array.from(dialog.querySelectorAll('*'));
    const listo = all.find(e => e.offsetParent && (e.textContent || '').trim() === 'Listo');
    if (listo) listo.click();
  });
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
    const m = document.body.innerText.match(/\b(EA[A-Z][A-Za-z0-9_-]{170,300})\b/);
    return m ? m[1] : null;
  });

  if (token) {
    saveToken(token);
    console.log('\n📊 Probando...');
    const e = s => encodeURIComponent(s);
    const ad = await fetch(`https://graph.facebook.com/v21.0/act_${AD_ACCOUNT}?fields=name&access_token=${e(token)}`).then(r => r.json());
    console.log(`  Ad: ${ad.name || ad.error?.message || '?'}`);
    if (ad.name) {
      const perms = await fetch(`https://graph.facebook.com/v21.0/me/permissions?access_token=${e(token)}`).then(r => r.json()).catch(() => ({}));
      if (perms.data) console.log(`  Perms: ${perms.data.filter(p => p.status === 'granted').map(p => p.permission).join(', ')}`);
    }
  } else {
    console.log('❌ No token. Estado:');
    const finalDialog = await page.evaluate(() => {
      const d = document.querySelector('[role="dialog"]');
      return d ? d.textContent.trim().substring(0, 500) : 'No dialog';
    });
    console.log('  Dialog:', finalDialog);
    await page.screenshot({ path: path.join(__dirname, 'debug_token_fail.png') });
  }

  browser.disconnect();
  console.log('\n🔵 Chrome queda abierto.');
}

main().catch(e => { console.error('Fatal:', e.message); process.exit(1); });
