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

  await page.goto(`https://business.facebook.com/latest/settings/system_users?business_id=${BM_ID}`, { waitUntil: 'networkidle2', timeout: 30000 }).catch(() => {});
  await wait(5000);
  await page.evaluate(() => {
    const els = Array.from(document.querySelectorAll('a,span,div,li'));
    for (const e of els) { if (e.offsetParent && (e.textContent||'').trim().toLowerCase() === 'usuarios del sistema') { e.click(); return; } }
  });
  await wait(8000);

  // Abrir diálogo
  await page.evaluate(() => {
    const all = Array.from(document.querySelectorAll('*'));
    const btn = all.find(e => e.offsetParent && e.textContent.trim() === 'Generar identificador' && e.childElementCount === 0);
    if (btn) btn.click();
  });
  await wait(5000);

  // Click combo y seleccionar app
  console.log('\n📍 Seleccionando app...');
  await page.evaluate(() => {
    const dialog = document.querySelector('[role="dialog"]');
    if (!dialog) return;
    const all = Array.from(dialog.querySelectorAll('*'));
    // Find the combobox or clickable area
    const combo = all.find(e => e.offsetParent && e.getAttribute('role') === 'combobox');
    if (combo) combo.click();
    else {
      const picker = all.find(e => e.offsetParent && (e.textContent || '').includes('Ninguna aplicación'));
      if (picker) picker.click();
    }
  });
  await wait(2000);

  // Focus any input that appeared or type directly
  await page.keyboard.type('ventas-pro', { delay: 15 });
  await wait(3000);
  await page.keyboard.press('Enter');
  await wait(2000);

  // Try pressing ArrowDown + Enter if the first didn't work
  await page.keyboard.press('ArrowDown');
  await wait(500);
  await page.keyboard.press('ArrowDown');
  await wait(500);
  await page.keyboard.press('Enter');
  await wait(2000);

  // Selected from DOM
  await page.evaluate(() => {
    const all = Array.from(document.querySelectorAll('*'));
    const el = all.find(e => e.offsetParent && (e.textContent || '').trim() === 'ventas-pro');
    if (el) el.click();
  });
  await wait(3000);

  // Click "Generar identificador"
  console.log('\n⚡ Click "Generar identificador"...');
  await page.evaluate(() => {
    const dialog = document.querySelector('[role="dialog"]');
    if (!dialog) return;
    const all = Array.from(dialog.querySelectorAll('*'));
    const btn = all.find(e => e.offsetParent && (e.textContent || '').trim() === 'Generar identificador');
    if (btn) btn.click();
  });
  await wait(5000);

  // Ver qué pasó
  const dialogContent = await page.evaluate(() => {
    const d = document.querySelector('[role="dialog"]');
    return d ? (d.textContent || '').trim().substring(0, 600) : 'no dialog';
  });
  console.log('Content:', dialogContent);

  // Buscar token
  const token = await page.evaluate(() => {
    const d = document.querySelector('[role="dialog"]');
    if (d) {
      const inputs = Array.from(d.querySelectorAll('input'));
      for (const inp of inputs) if (inp.value && inp.value.length > 170) return inp.value;
      const m = (d.textContent || '').match(/\b(EA[A-Z][A-Za-z0-9_-]{170,300})\b/);
      if (m) return m[1];
    }
    const allText = document.body.innerText;
    const m = allText.match(/\b(EA[A-Z][A-Za-z0-9_-]{170,300})\b/);
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
      if (perms.data) {
        const granted = perms.data.filter(p => p.status === 'granted').map(p => p.permission);
        console.log(`  Permisos: ${granted.join(', ')}`);
      }
    }
  } else {
    console.log('❌ No token encontrado');
    // Si el botón aún está, podría necesitar más pasos
    // Listar todos los botones en el diálogo
    const buttons = await page.evaluate(() => {
      const d = document.querySelector('[role="dialog"]');
      if (!d) return [];
      return Array.from(d.querySelectorAll('*')).filter(e => e.offsetParent && e.textContent.trim().length > 0 && e.textContent.trim().length < 50).map(e => e.textContent.trim()).filter((v,i,a) => a.indexOf(v) === i);
    });
    console.log('Botones:', buttons);
  }

  browser.disconnect();
}

main().catch(e => { console.error('Fatal:', e.message); process.exit(1); });
