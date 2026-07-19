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
  const r = { accessToken: token, pageId: PAGE_ID, pageName: 'VentasPro', adAccountId: AD_ACCOUNT, bmId: BM_ID, systemUserId: SYSTEM_USER_ID };
  fs.writeFileSync(TOKEN_FILE, JSON.stringify(r, null, 2));
  console.log(`✅ Token guardado (${token.length} chars)`);
}

async function testToken(token) {
  const e = t => encodeURIComponent(t);
  const ad = await fetch(`https://graph.facebook.com/v21.0/act_${AD_ACCOUNT}?fields=name&access_token=${e(token)}`).then(r=>r.json());
  if (ad.name) { console.log(`  ✅ Ad Account: ${ad.name}`); return true; }
  console.log(`  ❌ ${ad.error?.message || 'error'}`);
  const pg = await fetch(`https://graph.facebook.com/v21.0/${PAGE_ID}?fields=name&access_token=${e(token)}`).then(r=>r.json());
  if (pg.name) { console.log(`  ✅ Page: ${pg.name}`); return true; }
  console.log(`  ❌ Page: ${pg.error?.message || 'error'}`);
  return false;
}

async function clickText(page, text, opts = {}) {
  const selector = opts.role ? `[role="${opts.role}"]` : '*';
  const result = await page.evaluate(({ text, selector }) => {
    const all = Array.from(document.querySelectorAll(selector));
    for (const el of all) {
      if (el.offsetParent === null) continue;
      const t = (el.textContent || '').trim();
      if (t === text) {
        el.click();
        return 'exact';
      }
    }
    for (const el of all) {
      if (el.offsetParent === null) continue;
      const t = (el.textContent || '').trim();
      if (t.includes(text)) {
        el.click();
        return 'partial';
      }
    }
    return null;
  }, { text, selector });
  if (result) console.log(`  👆 "${text}" (${result})`);
  await wait(opts.wait || 2000);
  return result;
}

async function getDialogContent(page) {
  return await page.evaluate(() => {
    const d = document.querySelector('[role="dialog"]');
    if (!d) return null;
    return {
      text: d.textContent.trim(),
      html: d.innerHTML.substring(0, 2000),
      buttons: Array.from(d.querySelectorAll('button, [role="button"], a')).filter(e => e.offsetParent).map(e => e.textContent.trim()),
      inputs: Array.from(d.querySelectorAll('input')).map(i => ({ id: i.id, type: i.type, value: (i.value || '').substring(0, 50) })),
      labels: Array.from(d.querySelectorAll('label')).map(l => ({ for: l.htmlFor || '', text: (l.textContent || '').trim().substring(0, 60) })),
      checkboxes: Array.from(d.querySelectorAll('input[type="checkbox"], [role="checkbox"]')).map(c => ({
        checked: c.checked || c.getAttribute('aria-checked') === 'true',
        label: ((c.parentElement?.textContent || c.nextElementSibling?.textContent || '') || '').trim().substring(0, 60)
      }))
    };
  }).catch(() => null);
}

async function main() {
  console.log('🔌 Conectando a Chrome...');
  const browser = await puppeteer.connect({ browserURL: 'http://localhost:9222', defaultViewport: null });
  const pages = await browser.pages();
  const page = pages[0];

  // Navegar y hacer click en System Users
  await page.goto(`https://business.facebook.com/latest/settings/system_users?business_id=${BM_ID}`, { waitUntil: 'networkidle2', timeout: 30000 }).catch(() => {});
  await wait(4000);
  await page.evaluate(() => {
    const els = Array.from(document.querySelectorAll('a,span,div,li'));
    for (const e of els) { if (e.offsetParent && (e.textContent||'').trim().toLowerCase() === 'usuarios del sistema') { e.click(); return; } }
  });
  await wait(6000);

  // Abrir diálogo de Generar identificador
  console.log('\n🔑 Abriendo diálogo "Generar identificador"...');
  await page.evaluate(() => {
    const all = Array.from(document.querySelectorAll('*'));
    const btn = all.find(e => e.offsetParent && e.textContent.trim() === 'Generar identificador' && e.childElementCount === 0);
    if (btn) btn.click();
  });
  await wait(5000);

  // PASO 1: Seleccionar aplicación
  console.log('\n📍 PASO 1: Seleccionar aplicación...');
  await clickText(page, 'Seleccionar aplicación');
  
  // En el selector de apps, buscar "ventas-pro" o la app ID
  const dialog1 = await getDialogContent(page);
  if (dialog1) {
    console.log('  Diálogo:', dialog1.text.substring(0, 200));
    if (dialog1.buttons.length) console.log('  Botones:', dialog1.buttons);
    if (dialog1.checkboxes.length) console.log('  Checkboxes:', dialog1.checkboxes.map(c => (c.checked ? '✅' : '⬜') + ' ' + c.label));
  }

  // Buscar la opción de app "ventas-pro" para seleccionar
  await clickText(page, 'ventas-pro');
  await clickText(page, 'VentasPro');
  await clickText(page, APP_ID);

  // Look for list items with the app
  const appsList = await page.evaluate(() => {
    const dialog = document.querySelector('[role="dialog"]');
    if (!dialog) return [];
    const items = Array.from(dialog.querySelectorAll('[role="menuitem"], [role="option"], li, .x1n2onr6'));
    return items.filter(e => e.offsetParent).map(e => ({ text: (e.textContent || '').trim().substring(0, 100), tag: e.tagName }));
  }).catch(() => []);
  console.log('  Apps en lista:', appsList.map(a => a.text));

  // Try clicking any app item
  for (const app of appsList) {
    if (app.text.toLowerCase().includes('ventas') || app.text.toLowerCase().includes('pro') || app.text.includes(APP_ID)) {
      await clickText(page, app.text);
      break;
    }
  }

  await wait(2000);

  // PASO 2: Asignar permisos
  console.log('\n📍 PASO 2: Asignar permisos...');
  
  // Click on "Asignar permisos" (the step, not the assign assets button)
  await page.evaluate(() => {
    const dialog = document.querySelector('[role="dialog"]');
    if (!dialog) return;
    const els = Array.from(dialog.querySelectorAll('*'));
    const btn = els.find(e => e.offsetParent && e.textContent.trim() === 'Asignar permisos');
    if (btn) btn.click();
  });
  await wait(3000);

  const dialog2 = await getDialogContent(page);
  if (dialog2) {
    console.log('  Diálogo permisos:', dialog2.text.substring(0, 300));
    if (dialog2.checkboxes.length) {
      console.log('  Permisos disponibles:');
      dialog2.checkboxes.forEach(c => console.log(`    ${c.checked ? '✅' : '⬜'} ${c.label}`));
      
      // Mark all needed permissions
      const needed = ['ads_management', 'business_management', 'pages_read_engagement', 'pages_manage_metadata', 'pages_messaging'];
      for (const perm of needed) {
        const checkbox = dialog2.checkboxes.find(c => c.label.toLowerCase().includes(perm.replace(/_/g, ' ')) || c.label.toLowerCase().includes(perm));
        if (checkbox && !checkbox.checked) {
          console.log(`  Marcando: ${perm}`);
          await page.evaluate((p) => {
            const dialog = document.querySelector('[role="dialog"]');
            if (!dialog) return;
            const checks = Array.from(dialog.querySelectorAll('input[type="checkbox"], [role="checkbox"]'));
            for (const c of checks) {
              const label = (c.parentElement?.textContent || c.nextElementSibling?.textContent || '').trim().toLowerCase().replace(/\s/g, '_');
              if (label.includes(p) || label.includes(p.replace(/_/g, ' '))) {
                if (!(c.checked || c.getAttribute('aria-checked') === 'true')) c.click();
                return;
              }
            }
          }, perm);
          await wait(500);
        }
      }
    }
  }

  // PASO 3: Listo
  console.log('\n📍 PASO 3: "Listo"...');
  await clickText(page, 'Listo');
  await wait(5000);

  // Extraer token del diálogo
  const dialog3 = await getDialogContent(page);
  if (dialog3) {
    console.log('  Después de Listo:', dialog3.text.substring(0, 500));
    if (dialog3.inputs.length) console.log('  Inputs:', dialog3.inputs);
  }

  // Buscar token en todos lados
  const token = await page.evaluate(() => {
    const dialog = document.querySelector('[role="dialog"]');
    if (dialog) {
      const inputs = Array.from(dialog.querySelectorAll('input'));
      for (const inp of inputs) if (inp.value && inp.value.length > 170 && (inp.value.startsWith('EAA') || inp.value.startsWith('EAAG'))) return inp.value;
      const text = dialog.textContent;
      const m = text.match(/\b(EA[A-Z][A-Za-z0-9_-]{170,300})\b/);
      if (m) return m[1];
    }
    const text = document.body.innerText;
    const m = text.match(/\b(EA[A-Z][A-Za-z0-9_-]{170,300})\b/);
    if (m) return m[1];
    return null;
  }).catch(() => null);

  if (token) {
    console.log(`\n✅ Token extraído: ${token.substring(0, 30)}...${token.slice(-10)}`);
    saveToken(token);
    console.log('\n📊 Probando...');
    await testToken(token);
  } else {
    console.log('\n⚠️ No se encontró token.');
    const finalText = await page.evaluate(() => document.body.innerText).catch(() => '');
    const lines = finalText.split('\n').filter(l => l.trim());
    lines.filter(l => l.includes('EAA') || l.includes('EAAG') || l.includes('token') || l.includes('Token') || l.includes('Listo') || l.includes('pendiente')).slice(0, 10).forEach(l => console.log('  ' + l));
  }

  console.log('\n🔵 Chrome queda abierto.');
  browser.disconnect();
}

main().catch(e => { console.error('Fatal:', e.message); process.exit(1); });
