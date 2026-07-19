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

async function main() {
  console.log('🔌 Conectando...');
  const browser = await puppeteer.connect({ browserURL: 'http://localhost:9222', defaultViewport: null });
  const page = (await browser.pages())[0];

  // Intercept API responses for tokens
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
        console.log(`\n  🎯 Token capturado de API! ${apiToken.substring(0, 20)}...`);
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

  // Abrir Generar identificador
  await page.evaluate(() => {
    const all = Array.from(document.querySelectorAll('*'));
    const btn = all.find(e => e.offsetParent && e.textContent.trim() === 'Generar identificador' && e.childElementCount === 0);
    if (btn) btn.click();
  });
  await wait(5000);

  // Seleccionar app escribiendo en el combo
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

  await page.keyboard.type('ventas-pro', { delay: 20 });
  await wait(3000);
  await page.keyboard.press('Enter');
  await wait(2000);

  await page.evaluate(() => {
    const all = Array.from(document.querySelectorAll('*'));
    const el = all.find(e => e.offsetParent && (e.textContent || '').trim() === 'ventas-pro');
    if (el) el.click();
  });
  await wait(3000);

  // Verificar estado del diálogo
  const state = await page.evaluate(() => {
    const d = document.querySelector('[role="dialog"]');
    if (!d) return 'no dialog';
    const text = d.textContent;
    const buttons = Array.from(d.querySelectorAll('*'))
      .filter(e => e.offsetParent && e.textContent.trim().length > 0 && e.textContent.trim().length < 60)
      .map(e => e.textContent.trim());
    return { text: text.trim().substring(0, 500), buttons: [...new Set(buttons)] };
  });
  console.log('Estado del diálogo:', JSON.stringify(state, null, 2));

  // Click "Generar identificador" si está disponible
  if (typeof state === 'object' && state.buttons) {
    if (state.buttons.includes('Generar identificador')) {
      console.log('\n⚡ Click "Generar identificador"...');
      await page.evaluate(() => {
        const dialog = document.querySelector('[role="dialog"]');
        if (!dialog) return;
        const all = Array.from(dialog.querySelectorAll('*'));
        const btn = all.find(e => e.offsetParent && (e.textContent || '').trim() === 'Generar identificador');
        if (btn) btn.click();
      });
      await wait(8000);
    } else if (state.buttons.includes('Siguiente')) {
      // Need to go through steps
      await page.evaluate(() => {
        const dialog = document.querySelector('[role="dialog"]');
        if (!dialog) return;
        const all = Array.from(dialog.querySelectorAll('*'));
        const sgte = all.find(e => e.offsetParent && (e.textContent || '').trim() === 'Siguiente');
        if (sgte) sgte.click();
      });
      await wait(3000);
      
      // Now click Listo
      await page.evaluate(() => {
        const dialog = document.querySelector('[role="dialog"]');
        if (!dialog) return;
        const all = Array.from(dialog.querySelectorAll('*'));
        const listo = all.find(e => e.offsetParent && (e.textContent || '').trim() === 'Listo');
        if (listo) listo.click();
      });
      await wait(8000);
    }
  }

  // Esperar y capturar token
  if (apiToken) {
    saveToken(apiToken);
    console.log('\n📊 Probando token...');
    const e = s => encodeURIComponent(s);
    const ad = await fetch(`https://graph.facebook.com/v21.0/act_${AD_ACCOUNT}?fields=name&access_token=${e(apiToken)}`).then(r => r.json());
    console.log(`  Ad: ${ad.name || ad.error?.message || '?'}`);
    if (ad.name) {
      const perms = await fetch(`https://graph.facebook.com/v21.0/me/permissions?access_token=${e(apiToken)}`).then(r => r.json()).catch(() => ({}));
      if (perms.data) console.log(`  Perms: ${perms.data.filter(p => p.status === 'granted').map(p => p.permission).join(', ')}`);
    }
    browser.disconnect();
    return;
  }

  // Buscar en el DOM
  const pageToken = await page.evaluate(() => {
    const text = document.body.innerText;
    const m = text.match(/\b(EA[A-Z][A-Za-z0-9_-]{170,300})\b/);
    return m ? m[1] : null;
  });
  if (pageToken) {
    saveToken(pageToken);
    console.log('✅ Token del DOM');
  } else {
    console.log('❌ No se generó token. Revisando página...');
    const finalText = await page.evaluate(() => document.body.innerText);
    const lines = finalText.split('\n').filter(l => l.trim());
    // Show lines around "token" or "EAA" or "identificador"
    lines.filter(l => l.toLowerCase().includes('token') || l.startsWith('EAA') || l.startsWith('EAAG') || l.includes('identificador')).forEach(l => console.log('  ' + l.substring(0, 120)));
    await page.screenshot({ path: path.join(__dirname, 'debug_v19.png') });
  }

  browser.disconnect();
  console.log('\n🔵 Chrome queda abierto.');
}

main().catch(e => { console.error('Fatal:', e.message); process.exit(1); });
