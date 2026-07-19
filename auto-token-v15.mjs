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
  const e = s => encodeURIComponent(s);
  const tests = [
    ['Page', `https://graph.facebook.com/v21.0/${PAGE_ID}?fields=name&access_token=${e(token)}`],
    ['Ad', `https://graph.facebook.com/v21.0/act_${AD_ACCOUNT}?fields=name&access_token=${e(token)}`],
  ];
  for (const [label, url] of tests) {
    const r = await fetch(url).then(r => r.json()).catch(() => ({}));
    if (r.name) { console.log(`  ✅ ${label}: ${r.name}`); return true; }
  }
  return false;
}

async function clickExactInDialog(page, text) {
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

  // Go to System Users
  await page.goto(`https://business.facebook.com/latest/settings/system_users?business_id=${BM_ID}`, { waitUntil: 'networkidle2', timeout: 30000 }).catch(() => {});
  await wait(5000);
  await page.evaluate(() => {
    const els = Array.from(document.querySelectorAll('a,span,div,li'));
    for (const e of els) { if (e.offsetParent && (e.textContent||'').trim().toLowerCase() === 'usuarios del sistema') { e.click(); return; } }
  });
  await wait(6000);

  // Check if SalesBot is in the list
  const hasSalesBot = await page.evaluate(() => document.body.innerText.includes('SalesBot') || document.body.innerText.includes('salesbot'));
  console.log('SalesBot visible:', hasSalesBot);

  // ===== STEP 1: Assign Assets =====
  console.log('\n📍 Asignando activos...');
  
  // Click "Asignar activos"
  await page.evaluate(() => {
    const all = Array.from(document.querySelectorAll('*'));
    const btns = all.filter(e => e.offsetParent && (e.textContent || '').trim() === 'Asignar activos');
    // Click the one WITHOUT role="button" (the text label)
    const btn = btns.find(e => !e.getAttribute('role'));
    if (btn) btn.click();
    else btns[0]?.click();
  });
  await wait(5000);

  // Capture the assign dialog
  const assignDialog = await page.evaluate(() => {
    const d = document.querySelector('[role="dialog"]');
    if (!d) return 'no dialog';
    const all = Array.from(d.querySelectorAll('*'));
    const texts = all.filter(e => e.offsetParent).map(e => (e.textContent || '').trim()).filter(t => t.length > 0 && t.length < 100);
    return [...new Set(texts)].slice(0, 30);
  });
  console.log('Assign dialog:', assignDialog);

  // Look for search input to find the Page
  const searchInput = await page.$('input[type="text"]');
  if (searchInput) {
    await searchInput.click();
    await searchInput.type('VentasPro', { delay: 50 });
    await wait(3000);
    console.log('Typed: VentasPro');
    
    // Click on the search result
    const resultClicked = await page.evaluate(() => {
      const all = Array.from(document.querySelectorAll('*'));
      const el = all.find(e => e.offsetParent && (e.textContent || '').trim() === 'VentasPro');
      if (el) { el.click(); return true; }
      return false;
    });
    console.log('Result clicked:', resultClicked);
    await wait(2000);
    
    // Click Save/Next
    await page.evaluate(() => {
      const all = Array.from(document.querySelectorAll('span, div, button, a'));
      for (const el of all) {
        if (!el.offsetParent) continue;
        const t = (el.textContent || '').trim().toLowerCase();
        if (t === 'guardar' || t === 'save' || t === 'siguiente' || t === 'next' || t === 'añadir' || t === 'add' || t === 'listo') {
          el.click(); return;
        }
      }
    });
    await wait(3000);
  }

  // ===== STEP 2: Generate Token =====
  console.log('\n🔑 Generando token...');
  
  await page.evaluate(() => {
    const all = Array.from(document.querySelectorAll('*'));
    const btn = all.find(e => e.offsetParent && e.textContent.trim() === 'Generar identificador' && e.childElementCount === 0);
    if (btn) btn.click();
  });
  await wait(5000);

  // Dialog content
  const dialogStart = await page.evaluate(() => {
    const d = document.querySelector('[role="dialog"]');
    return d ? (d.textContent || '').trim().substring(0, 400) : 'no dialog';
  });
  console.log('Token dialog:', dialogStart);

  // Click the app selector 
  await page.evaluate(() => {
    const dialog = document.querySelector('[role="dialog"]');
    if (!dialog) return;
    const all = Array.from(dialog.querySelectorAll('*'));
    const picker = all.find(e => e.offsetParent && (e.textContent || '').includes('Ninguna aplicación'));
    if (picker) picker.click();
  });
  await wait(3000);

  // After clicking, the dropdown might have appeared. Look for apps
  const apps = await page.evaluate(() => {
    const res = [];
    const all = Array.from(document.querySelectorAll('*'));
    for (const el of all) {
      if (!el.offsetParent) continue;
      const t = (el.textContent || '').trim();
      if (t.includes('ventas-pro') || t === 'ventas-pro') {
        res.push({ tag: el.tagName, text: t.substring(0, 60), role: el.getAttribute('role') });
      }
    }
    return res;
  });
  console.log('Apps found:', apps);

  // If no apps found, try typing in the picker
  if (!apps.length) {
    console.log('No apps in dropdown, trying click on setiap...');
    // The app picker might be a text input that searches. Type the app name
    const textInputs = await page.$$('[role="dialog"] input[type="text"], [role="dialog"] input:not([type])');
    for (const inp of textInputs) {
      try {
        await inp.click();
        await inp.type('ventas', { delay: 30 });
        await wait(2000);
        console.log('Typed into input');
        
        // Look for autocomplete results
        const suggestions = await page.evaluate(() => {
          const res = [];
          const all = Array.from(document.querySelectorAll('*'));
          for (const el of all) {
            if (!el.offsetParent) continue;
            const t = (el.textContent || '').trim();
            if (t.includes('ventas-pro') || t.includes('VentasPro')) {
              res.push({ tag: el.tagName, text: t.substring(0, 60) });
            }
          }
          return res;
        });
        console.log('Suggestions:', suggestions);
        
        if (suggestions.length) {
          await page.evaluate(() => {
            const all = Array.from(document.querySelectorAll('*'));
            const el = all.find(e => e.offsetParent && (e.textContent || '').trim().includes('ventas-pro'));
            if (el) el.click();
          });
          await wait(2000);
        }
        break;
      } catch {}
    }
  }

  // Click Siguiente
  await clickExactInDialog(page, 'Siguiente') || console.log('No Siguiente');
  await wait(3000);

  // Click Listo
  await clickExactInDialog(page, 'Listo') || console.log('No Listo');
  await wait(5000);

  // Extract token
  const token = await page.evaluate(() => {
    const d = document.querySelector('[role="dialog"]');
    if (d) {
      const inputs = Array.from(d.querySelectorAll('input'));
      for (const inp of inputs) if (inp.value && inp.value.length > 170) return inp.value;
      const m = (d.textContent || '').match(/\b(EA[A-Z][A-Za-z0-9_-]{170,300})\b/);
      if (m) return m[1];
    }
    const m = document.body.innerText.match(/\b(EA[A-Z][A-Za-z0-9_-]{170,300})\b/);
    return m ? m[1] : null;
  });

  if (token) {
    saveToken(token);
    await testToken(token);
  } else {
    console.log('❌ No token');
    await page.screenshot({ path: path.join(__dirname, 'debug_no_token.png') });
  }

  browser.disconnect();
  console.log('\n🔵 Chrome queda abierto.');
}

main().catch(e => { console.error('Fatal:', e.message); process.exit(1); });
