import puppeteer from 'puppeteer';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { setTimeout as wait } from 'timers/promises';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BM_ID = '4482432028697067';
const PAGE_ID = '1278583508663384';
const AD_ACCOUNT = '1545022093928422';
const TOKEN_FILE = path.join(__dirname, 'facebook-automation', 'tokens', 'fb_tokens_output.json');

function saveToken(token) {
  const r = { accessToken: token, pageId: PAGE_ID, adAccountId: AD_ACCOUNT, bmId: BM_ID };
  fs.writeFileSync(TOKEN_FILE, JSON.stringify(r, null, 2));
  console.log(`✅ Token: ${token.substring(0, 20)}...`);
}

async function main() {
  console.log('🔌 Conectando...');
  const browser = await puppeteer.connect({ browserURL: 'http://localhost:9222', defaultViewport: null });
  const page = (await browser.pages())[0];

  // API intercept
  let apiToken = null;
  page.on('response', async (response) => {
    if (apiToken) return;
    try {
      const ct = response.headers()['content-type'] || '';
      if (!ct.includes('json')) return;
      const json = await response.json().catch(() => null);
      if (json?.access_token && json.access_token.length > 170) {
        apiToken = json.access_token;
        console.log(`\n🎯 Token de API: ${apiToken.substring(0, 20)}...`);
      }
    } catch {}
  });

  await page.goto(`https://business.facebook.com/latest/settings/system_users?business_id=${BM_ID}`, { waitUntil: 'networkidle2', timeout: 30000 }).catch(() => {});
  await wait(5000);
  await page.evaluate(() => {
    const els = Array.from(document.querySelectorAll('a,span,div,li'));
    for (const e of els) { if (e.offsetParent && (e.textContent||'').trim().toLowerCase() === 'usuarios del sistema') { e.click(); return; } }
  });
  await wait(8000);

  // Click "Generar identificador"
  await page.evaluate(() => {
    const all = Array.from(document.querySelectorAll('*'));
    const btn = all.find(e => e.offsetParent && e.textContent.trim() === 'Generar identificador' && e.childElementCount === 0);
    if (btn) btn.click();
  });
  await wait(5000);

  // Click on "Ninguna aplicación seleccionada" to open picker
  console.log('\n📍 Abriendo selector de app...');
  const pickerClicked = await page.evaluate(() => {
    const dialog = document.querySelector('[role="dialog"]');
    if (!dialog) return 'no dialog';
    const all = Array.from(dialog.querySelectorAll('*'));
    // First try: role="combobox"
    const combo = all.find(e => e.offsetParent && e.getAttribute('role') === 'combobox');
    if (combo) { combo.click(); return 'combo'; }
    // Second: text "Ninguna aplicación"
    const picker = all.find(e => e.offsetParent && (e.textContent || '').includes('Ninguna aplicación') && !e.querySelector('*'));
    if (picker) { picker.click(); return 'picker'; }
    return 'not found';
  });
  console.log('Picker click:', pickerClicked);
  await wait(3000);

  // After clicking, find ANY input inside the dialog and type in it
  const inputHandle = await page.evaluateHandle(() => {
    const dialog = document.querySelector('[role="dialog"]');
    if (!dialog) return null;
    return dialog.querySelector('input[type="text"], input:not([type]), [contenteditable="true"]');
  });
  
  const inputElement = inputHandle.asElement();
  if (inputElement) {
    await inputElement.click();
    await inputElement.type('ventas-pro', { delay: 20 });
    console.log('Typed in input');
    await wait(3000);
  } else {
    // Keyboard typing on page (might work if combo is focused)
    await page.keyboard.type('ventas-pro', { delay: 20 });
    console.log('Typed on page');
    await wait(3000);
  }

  // Buscar ventas-pro y click
  const clicked = await page.evaluate(() => {
    const all = Array.from(document.querySelectorAll('*'));
    for (const el of all) {
      if (!el.offsetParent) continue;
      const t = (el.textContent || '').trim();
      if (t === 'ventas-pro') { el.click(); return 'exact'; }
    }
    for (const el of all) {
      if (!el.offsetParent) continue;
      const t = (el.textContent || '').trim();
      if (t.includes('ventas-pro') && t.length < 30) { el.click(); return 'partial'; }
    }
    return 'not found';
  });
  console.log('ventas-pro click:', clicked);
  await wait(4000);

  // State after selection
  const state = await page.evaluate(() => {
    const d = document.querySelector('[role="dialog"]');
    if (!d) return { text: 'no dialog' };
    const all = Array.from(d.querySelectorAll('*'));
    const buttons = [...new Set(all.filter(e => e.offsetParent && e.textContent.trim().length < 40 && e.textContent.trim().length > 0).map(e => e.textContent.trim()))];
    return { text: d.textContent.trim().substring(0, 500), buttons };
  });
  console.log('State:', JSON.stringify(state, null, 2));

  // If selection worked, steps should have changed. Click what's available.
  if (typeof state === 'object' && state.buttons) {
    // Try to move through the steps
    const steps = ['Siguiente', 'Listo', 'Generar identificador'];
    for (const step of steps) {
      if (state.buttons.includes(step)) {
        console.log(`\n👉 Click "${step}"`);
        await page.evaluate((btnText) => {
          const dialog = document.querySelector('[role="dialog"]');
          if (!dialog) return;
          const all = Array.from(dialog.querySelectorAll('*'));
          const btn = all.find(e => e.offsetParent && (e.textContent || '').trim() === btnText);
          if (btn) btn.click();
        }, step);
        await wait(5000);
        
        // Check new state
        const newState = await page.evaluate(() => {
          const d = document.querySelector('[role="dialog"]');
          if (!d) return { text: 'no dialog' };
          const all = Array.from(d.querySelectorAll('*'));
          const buttons = [...new Set(all.filter(e => e.offsetParent && e.textContent.trim().length < 40 && e.textContent.trim().length > 0).map(e => e.textContent.trim()))];
          return { text: d.textContent.trim().substring(0, 500), buttons };
        });
        console.log('New state:', JSON.stringify(newState, null, 2));
        state.text = newState.text;
        state.buttons = newState.buttons;
      }
    }
  }

  // Extract token
  if (apiToken) {
    saveToken(apiToken);
    const ad = await fetch(`https://graph.facebook.com/v21.0/act_${AD_ACCOUNT}?fields=name&access_token=${encodeURIComponent(apiToken)}`).then(r => r.json());
    console.log(`Ad: ${ad.name || ad.error?.message || '?'}`);
    browser.disconnect(); return;
  }

  const domToken = await page.evaluate(() => {
    return document.body.innerText.match(/\b(EA[A-Z][A-Za-z0-9_-]{170,300})\b/)?.[1] || null;
  });
  if (domToken) {
    saveToken(domToken);
    const ad = await fetch(`https://graph.facebook.com/v21.0/act_${AD_ACCOUNT}?fields=name&access_token=${encodeURIComponent(domToken)}`).then(r => r.json());
    console.log(`Ad: ${ad.name || ad.error?.message || '?'}`);
  } else {
    console.log('❌ No token generado');
  }

  browser.disconnect();
}

main().catch(e => console.error(e.message));
