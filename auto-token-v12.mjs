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
  console.log(`  ❌ ${ad.error?.message || ad.name || '?'}`);
  const pg = await fetch(`https://graph.facebook.com/v21.0/${PAGE_ID}?fields=name&access_token=${e(token)}`).then(r=>r.json());
  if (pg.name) { console.log(`  ✅ Page: ${pg.name}`); return true; }
  console.log(`  ❌ ${pg.error?.message || '?'}`);
  return false;
}

async function main() {
  console.log('🔌 Conectando a Chrome...');
  const browser = await puppeteer.connect({ browserURL: 'http://localhost:9222', defaultViewport: null });
  const pages = await browser.pages();
  const page = pages[0];

  // Navegar
  await page.goto(`https://business.facebook.com/latest/settings/system_users?business_id=${BM_ID}`, { waitUntil: 'networkidle2', timeout: 30000 }).catch(() => {});
  await wait(4000);
  await page.evaluate(() => {
    const els = Array.from(document.querySelectorAll('a,span,div,li'));
    for (const e of els) { if (e.offsetParent && (e.textContent||'').trim().toLowerCase() === 'usuarios del sistema') { e.click(); return; } }
  });
  await wait(6000);

  // Abrir diálogo
  console.log('\n🔑 Abriendo diálogo...');
  await page.evaluate(() => {
    const all = Array.from(document.querySelectorAll('*'));
    const btn = all.find(e => e.offsetParent && e.textContent.trim() === 'Generar identificador' && e.childElementCount === 0);
    if (btn) btn.click();
  });
  await wait(5000);

  // PASO 1: Click "Seleccionar aplicación" para abrir el dropdown
  console.log('\n📍 Abriendo selector de aplicación...');
  await page.evaluate(() => {
    const dialog = document.querySelector('[role="dialog"]');
    if (!dialog) return;
    const all = Array.from(dialog.querySelectorAll('*'));
    const btn = all.find(e => e.offsetParent && e.textContent.trim() === 'Seleccionar aplicación' && !e.querySelector('*'));
    if (btn) btn.click();
  });
  await wait(3000);

  // Ver qué apareció
  const popupInfo = await page.evaluate(() => {
    const results = [];
    // Find popover/selectors that appeared
    const selectors = Array.from(document.querySelectorAll('[role="listbox"], [role="menu"], [role="combobox"], [class*="popover"], [class*="dropdown"], [class*="menu"]'));
    selectors.forEach(s => {
      const items = Array.from(s.querySelectorAll('[role="option"], [role="menuitem"], li, a'));
      results.push({
        role: s.getAttribute('role'),
        class: s.className.substring(0, 80),
        items: items.filter(i => i.offsetParent).map(i => ({ text: (i.textContent || '').trim().substring(0, 80), tag: i.tagName }))
      });
    });
    return results;
  }).catch(() => []);
  console.log('  Popups:', JSON.stringify(popupInfo, null, 2).substring(0, 2000));

  // También buscar apps en el diálogo que podrían ser seleccionables
  const dialogApps = await page.evaluate(() => {
    const dialog = document.querySelector('[role="dialog"]');
    if (!dialog) return [];
    const all = Array.from(dialog.querySelectorAll('*'));
    const apps = all.filter(e => e.offsetParent && e.textContent.trim().length > 0 && e.textContent.trim().length < 60 && !e.closest('[role="dialog"] [role="dialog"]'));
    const seen = new Set();
    return apps.map(e => e.textContent.trim()).filter(t => !seen.has(t) && seen.add(t));
  }).catch(() => []);
  console.log('  Dialog texts:', dialogApps);

  // Try clicking the combo area that shows "Ninguna aplicación seleccionada"
  await page.evaluate(() => {
    const dialog = document.querySelector('[role="dialog"]');
    if (!dialog) return;
    const all = Array.from(dialog.querySelectorAll('*'));
    const area = all.find(e => e.offsetParent && (e.textContent || '').trim().includes('Ninguna aplicación'));
    if (area) area.click();
  });
  await wait(3000);

  const popupInfo2 = await page.evaluate(() => {
    const results = [];
    const selectors = Array.from(document.querySelectorAll('[role="listbox"], [role="menu"], [role="combobox"]'));
    selectors.forEach(s => {
      const items = Array.from(s.querySelectorAll('[role="option"], [role="menuitem"], li, a'));
      results.push({
        role: s.getAttribute('role'),
        items: items.filter(i => i.offsetParent).map(i => ({ text: (i.textContent || '').trim().substring(0, 80) }))
      });
    });
    return results;
  }).catch(() => []);
  console.log('  Popups after 2nd click:', JSON.stringify(popupInfo2, null, 2).substring(0, 2000));

  b.disconnect();
}

main().catch(e => { console.error('Fatal:', e.message); process.exit(1); });
