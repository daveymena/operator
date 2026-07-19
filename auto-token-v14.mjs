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
  console.log(`✅ Token guardado (${token.length} chars): ${token.substring(0, 20)}...${token.slice(-10)}`);
}

async function testToken(token) {
  const e = s => encodeURIComponent(s);
  const ad = await fetch(`https://graph.facebook.com/v21.0/act_${AD_ACCOUNT}?fields=name&access_token=${e(token)}`).then(r => r.json());
  console.log(`  Ad: ${ad.name || '❌ ' + (ad.error?.message || '?')}`);
  if (ad.name) {
    const perms = await fetch(`https://graph.facebook.com/v21.0/me/permissions?access_token=${e(token)}`).then(r => r.json()).catch(() => ({}));
    if (perms.data) console.log(`  Perms: ${perms.data.filter(p => p.status === 'granted').map(p => p.permission).join(', ')}`);
    return true;
  }
  return false;
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

  // Open token dialog
  await page.evaluate(() => {
    const all = Array.from(document.querySelectorAll('*'));
    const btn = all.find(e => e.offsetParent && e.textContent.trim() === 'Generar identificador' && e.childElementCount === 0);
    if (btn) btn.click();
  });
  await wait(5000);

  // Get dialog reference
  const dialogBox = await page.evaluate(() => {
    const d = document.querySelector('[role="dialog"]');
    if (!d) return null;
    const rect = d.getBoundingClientRect();
    return { x: rect.x, y: rect.y, w: rect.width, h: rect.height };
  });
  console.log('Dialog box:', dialogBox);

  if (!dialogBox) { console.log('No dialog'); browser.disconnect(); return; }

  // Find and click the app selector ("Ninguna aplicación seleccionada")
  const selectorBox = await page.evaluate(() => {
    const dialog = document.querySelector('[role="dialog"]');
    if (!dialog) return null;
    const all = Array.from(dialog.querySelectorAll('*'));
    // Find the element that contains "Ninguna aplicación"
    const el = all.find(e => e.offsetParent && (e.textContent || '').includes('Ninguna aplicación'));
    if (el) {
      const rect = el.getBoundingClientRect();
      return { x: rect.x, y: rect.y, w: rect.width, h: rect.height, text: (el.textContent || '').trim().substring(0, 60) };
    }
    return null;
  });
  console.log('Selector area:', selectorBox);

  if (selectorBox) {
    // Click the CENTER of the selector area
    const cx = selectorBox.x + selectorBox.w / 2;
    const cy = selectorBox.y + selectorBox.h / 2;
    console.log(`Clicking at (${cx}, ${cy})`);
    
    await page.mouse.click(cx, cy);
    await wait(3000);

    // After clicking, a dropdown should appear. Look for it and find the app
    const dropdownItems = await page.evaluate(() => {
      const results = [];
      // Search for any new dropdown/popup elements
      const all = Array.from(document.querySelectorAll('[role="listbox"], [role="menu"], [role="option"], [role="menuitem"]'));
      all.forEach(el => {
        if (el.offsetParent) {
          results.push({ role: el.getAttribute('role'), text: (el.textContent || '').trim().substring(0, 80), tag: el.tagName });
        }
      });
      return results;
    });
    console.log('Dropdown items:', dropdownItems);

    // If no dropdown items, the app picker might need keyboard interaction
    if (!dropdownItems.length) {
      // Try pressing Enter or ArrowDown
      await page.keyboard.press('ArrowDown');
      await wait(1000);
      await page.keyboard.press('Enter');
      await wait(2000);
      
      const items2 = await page.evaluate(() => {
        const results = [];
        const all = Array.from(document.querySelectorAll('[role="listbox"], [role="menu"], [role="option"], [role="menuitem"]'));
        all.forEach(el => {
          if (el.offsetParent) results.push({ role: el.getAttribute('role'), text: (el.textContent || '').trim().substring(0, 80) });
        });
        return results;
      });
      console.log('After keyboard:', items2);
    }

    // Try to find and click "ventas-pro" anywhere in the page after opening the picker
    const appFound = await page.evaluate(() => {
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
    console.log('App click:', appFound);
    await wait(3000);
  }

  // Try clicking Siguiente
  await page.evaluate(() => {
    const dialog = document.querySelector('[role="dialog"]');
    if (!dialog) return;
    const all = Array.from(dialog.querySelectorAll('*'));
    const el = all.find(e => e.offsetParent && (e.textContent || '').trim() === 'Siguiente');
    if (el) el.click();
  });
  await wait(3000);

  // Try clicking Listo
  await page.evaluate(() => {
    const dialog = document.querySelector('[role="dialog"]');
    if (!dialog) return;
    const all = Array.from(dialog.querySelectorAll('*'));
    const el = all.find(e => e.offsetParent && (e.textContent || '').trim() === 'Listo');
    if (el) el.click();
  });
  await wait(5000);

  // Look for token
  const token = await page.evaluate(() => {
    const dialog = document.querySelector('[role="dialog"]');
    if (dialog) {
      const inputs = Array.from(dialog.querySelectorAll('input'));
      for (const inp of inputs) if (inp.value && inp.value.length > 170) return inp.value;
      const text = dialog.textContent;
      const m = text.match(/\b(EA[A-Z][A-Za-z0-9_-]{170,300})\b/);
      if (m) return m[1];
    }
    const text = document.body.innerText;
    const m = text.match(/\b(EA[A-Z][A-Za-z0-9_-]{170,300})\b/);
    if (m) return m[1];
    return null;
  });

  if (token) {
    saveToken(token);
    await testToken(token);
  } else {
    console.log('❌ Token no generado');
    // Take screenshot
    await page.screenshot({ path: path.join(__dirname, 'debug_token_final.png') });
  }

  browser.disconnect();
  console.log('\n🔵 Chrome queda abierto.');
}

main().catch(e => { console.error('Fatal:', e.message); process.exit(1); });
