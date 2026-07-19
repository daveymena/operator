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

async function testToken(token) {
  const e = t => encodeURIComponent(t);
  const permissions = ['ads_management', 'business_management', 'pages_read_engagement', 'pages_manage_metadata', 'pages_messaging'];
  
  // Ad Account
  const ad = await fetch(`https://graph.facebook.com/v21.0/act_${AD_ACCOUNT}?fields=name,account_status&access_token=${e(token)}`).then(r=>r.json());
  if (ad.name) { console.log(`  ✅ Ad Account: ${ad.name} (status: ${ad.account_status})`); }
  else { console.log(`  ❌ Ad: ${ad.error?.message || '?'}`); }

  // Permissions (System User /me may not work)
  const perms = await fetch(`https://graph.facebook.com/v21.0/me/permissions?access_token=${e(token)}`).then(r=>r.json()).catch(()=>({}));
  if (perms.data) {
    const granted = perms.data.filter(p => p.status === 'granted').map(p => p.permission);
    const missing = permissions.filter(p => !granted.includes(p));
    console.log(`  📋 Permisos: ${granted.length}. Faltan: ${missing.length ? missing.join(', ') : 'NINGUNO ✅'}`);
  }

  // Create test campaign
  const body = new URLSearchParams({
    name: '🧪 Test Auto',
    objective: 'OUTCOME_SALES',
    status: 'PAUSED',
    special_ad_categories: '[]',
    daily_budget: 10000,
    access_token: token
  });
  const camp = await fetch(`https://graph.facebook.com/v21.0/act_${AD_ACCOUNT}/campaigns`, { method: 'POST', body }).then(r=>r.json());
  if (camp.id) {
    console.log(`  ✅ Campaña creada: ${camp.id}`);
    // Delete test campaign
    await fetch(`https://graph.facebook.com/v21.0/${camp.id}?access_token=${e(token)}`, { method: 'DELETE' });
    return true;
  }
  console.log(`  ❌ Campaña: ${camp.error?.message || '?'}`);
  return false;
}

async function main() {
  console.log('🔌 Conectando a Chrome...');
  const browser = await puppeteer.connect({ browserURL: 'http://localhost:9222', defaultViewport: null });
  const pages = await browser.pages();
  const page = pages[0];

  // Navegar a System Users
  await page.goto(`https://business.facebook.com/latest/settings/system_users?business_id=${BM_ID}`, { waitUntil: 'networkidle2', timeout: 30000 }).catch(() => {});
  await wait(4000);
  await page.evaluate(() => {
    const els = Array.from(document.querySelectorAll('a,span,div,li'));
    for (const e of els) { if (e.offsetParent && (e.textContent||'').trim().toLowerCase() === 'usuarios del sistema') { e.click(); return; } }
  });
  await wait(6000);

  // Abrir Generar identificador
  await page.evaluate(() => {
    const all = Array.from(document.querySelectorAll('*'));
    const btn = all.find(e => e.offsetParent && e.textContent.trim() === 'Generar identificador' && e.childElementCount === 0);
    if (btn) btn.click();
  });
  await wait(5000);

  // PASO 1: Click "Seleccionar aplicación" para abrir el app picker
  console.log('\n📍 PASO 1: Click en "Seleccionar aplicación"...');
  await page.evaluate(() => {
    const dialog = document.querySelector('[role="dialog"]');
    if (!dialog) return;
    const all = Array.from(dialog.querySelectorAll('*'));
    const el = all.find(e => e.offsetParent && e.textContent.trim() === 'Seleccionar aplicación');
    if (el) { el.click(); console.log('Clicked:', el.textContent.trim()); }
  });
  await wait(3000);

  // Después del click en "Seleccionar aplicación", debería aparecer un dropdown de apps
  // Buscar el popup/listbox
  const appList = await page.evaluate(() => {
    const results = [];
    const all = Array.from(document.querySelectorAll('*'));
    // Find all elements that look like an app picker
    for (const el of all) {
      if (!el.offsetParent) continue;
      const t = (el.textContent || '').trim();
      // Look for text that contains the app name or ID
      if (t.includes('ventas-pro') || t.includes('4238613976451604') || t === 'ventas-pro') {
        results.push({ tag: el.tagName, text: t.substring(0, 100), role: el.getAttribute('role') });
      }
    }
    return results;
  });
  console.log('  App picks:', appList.map(a => a.text).join(' | '));
  
  // Try clicking on "ventas-pro" in the dropdown
  if (appList.length > 0) {
    await page.evaluate(() => {
      const all = Array.from(document.querySelectorAll('*'));
      const el = all.find(e => e.offsetParent && (e.textContent || '').trim() === 'ventas-pro' && e.childElementCount === 0);
      if (el) { el.click(); return true; }
      const el2 = all.find(e => e.offsetParent && (e.textContent || '').trim() === 'ventas-pro');
      if (el2) { el2.click(); return true; }
      return false;
    });
    await wait(2000);
    console.log('  App selected');
  } else {
    // Maybe need to click a different way - look at the input/combobox
    console.log('  No app found, trying combobox click...');
    // The combo box might need a click on the area showing "Ninguna aplicación seleccionada"
    await page.evaluate(() => {
      const dialog = document.querySelector('[role="dialog"]');
      if (!dialog) return;
      const all = Array.from(dialog.querySelectorAll('*'));
      const el = all.find(e => e.offsetParent && (e.textContent || '').includes('Ninguna aplicación'));
      if (el) el.click();
    });
    await wait(3000);
    
    // After clicking the "Ninguna aplicación" area, a list should pop up
    // Let's screenshot to see
    await page.screenshot({ path: 'C:\\Users\\ADMIN\\Music\\proyecto-unificado\\debug_dropdown.png' });
    console.log('  Screenshot: debug_dropdown.png');
    
    // Search for options in the document that appeared
    const options = await page.evaluate(() => {
      const results = [];
      const all = Array.from(document.querySelectorAll('*'));
      // Elements that appeared after our click might have different visibility
      // Look for elements with text that looks like an app
      for (const el of all) {
        const t = (el.textContent || '').trim();
        if (el.offsetParent && t.length > 0 && t.length < 100 && !t.includes('\n')) {
          const role = el.getAttribute('role');
          if (role === 'option' || role === 'menuitem' || role === 'listbox') {
            results.push({ tag: el.tagName, text: t.substring(0, 60), role });
          }
        }
      }
      // Also look inside the dialog for any new elements
      const dialog = document.querySelector('[role="dialog"]');
      if (dialog) {
        const dialogItems = Array.from(dialog.querySelectorAll('[role="option"], [role="menuitem"]'));
        dialogItems.forEach(el => results.push({ tag: el.tagName, text: (el.textContent || '').trim().substring(0, 60), role: el.getAttribute('role') }));
      }
      return results;
    });
    if (options.length) {
      console.log('  Options:', options.map(o => o.text).slice(0, 10));
      for (const opt of options) {
        if (opt.text.includes('ventas') || opt.text.includes('pro')) {
          await page.evaluate((text) => {
            const all = Array.from(document.querySelectorAll('*'));
            const el = all.find(e => e.offsetParent && (e.textContent || '').trim() === text);
            if (el) el.click();
          }, opt.text);
          await wait(2000);
          console.log('  Clicked option:', opt.text);
          break;
        }
      }
    }
  }

  // Después de seleccionar app, buscar "Siguiente" y click
  console.log('\n📍 PASO 2: Click "Siguiente"...');
  await page.evaluate(() => {
    const dialog = document.querySelector('[role="dialog"]');
    if (!dialog) return;
    const all = Array.from(dialog.querySelectorAll('*'));
    const el = all.find(e => e.offsetParent && (e.textContent || '').trim() === 'Siguiente');
    if (el) el.click();
  });
  await wait(4000);

  // El siguiente paso debería ser "Asignar permisos"
  const afterText = await page.evaluate(() => {
    const dialog = document.querySelector('[role="dialog"]');
    return dialog ? (dialog.textContent || '').trim() : null;
  }).catch(() => null);
  console.log('  Dialog:', afterText?.substring(0, 300));

  // Try clicking "Asignar permisos" step
  await page.evaluate(() => {
    const dialog = document.querySelector('[role="dialog"]');
    if (!dialog) return;
    const all = Array.from(dialog.querySelectorAll('*'));
    const el = all.find(e => e.offsetParent && e.textContent.trim() === 'Asignar permisos');
    if (el) el.click();
  });
  await wait(4000);

  // Now look for permission checkboxes
  const perms = await page.evaluate(() => {
    const dialog = document.querySelector('[role="dialog"]');
    if (!dialog) return [];
    const checks = Array.from(dialog.querySelectorAll('[role="checkbox"], input[type="checkbox"]'));
    return checks.filter(c => c.offsetParent).map(c => ({
      checked: c.checked || c.getAttribute('aria-checked') === 'true',
      label: (c.parentElement?.textContent || c.nextElementSibling?.textContent || '').trim().substring(0, 80),
      id: c.id
    }));
  });
  if (perms.length) {
    console.log('  Permisos disponibles:', perms.map(p => (p.checked ? '✅' : '⬜') + ' ' + p.label));
    
    // Find and check needed permissions
    const needed = ['ads_management', 'business_management', 'pages_read_engagement', 'pages_manage_metadata', 'pages_messaging'];
    for (const np of needed) {
      const found = perms.find(p => p.label.toLowerCase().replace(/\s/g, '_').includes(np));
      if (found && !found.checked) {
        console.log(`  Marcando: ${np}`);
        await page.evaluate((id) => {
          const checkbox = document.getElementById(id) || document.querySelector(`[role="checkbox"]#${id}`);
          if (checkbox) checkbox.click();
        }, found.id);
        await wait(500);
      }
    }
  }

  // Final: click "Listo"
  console.log('\n📍 PASO 3: Click "Listo"...');
  await page.evaluate(() => {
    const dialog = document.querySelector('[role="dialog"]');
    if (!dialog) return;
    const all = Array.from(dialog.querySelectorAll('*'));
    const el = all.find(e => e.offsetParent && (e.textContent || '').trim() === 'Listo');
    if (el) el.click();
  });
  await wait(5000);

  // Extraer token
  const token = await page.evaluate(() => {
    const dialog = document.querySelector('[role="dialog"]');
    if (dialog) {
      const inputs = Array.from(dialog.querySelectorAll('input'));
      for (const inp of inputs) {
        if (inp.value && inp.value.length > 170 && (inp.value.startsWith('EAA') || inp.value.startsWith('EAAG'))) return inp.value;
      }
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
    console.log(`\n✅ Token: ${token.substring(0, 30)}...${token.slice(-10)}`);
    saveToken(token);
    console.log('\n📊 Probando...');
    await testToken(token);
  } else {
    console.log('\n⚠️ No se generó token.');
  }

  console.log('\n🔵 Chrome queda abierto.');
  browser.disconnect();
}

main().catch(e => { console.error('Fatal:', e.message); process.exit(1); });
