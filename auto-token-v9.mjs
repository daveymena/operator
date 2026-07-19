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
  const me = await fetch(`https://graph.facebook.com/v21.0/me?fields=name,id&access_token=${e(token)}`).then(r=>r.json()).catch(()=>({}));
  if (me.error) { console.log(`  ❌ ${me.error.message}`); return false; }
  console.log(`  ✅ User: ${me.name}`);

  const p = await fetch(`https://graph.facebook.com/v21.0/me/permissions?access_token=${e(token)}`).then(r=>r.json()).catch(()=>({}));
  if (p.data) {
    const g = p.data.filter(x => x.status === 'granted').map(x => x.permission);
    console.log(`  📋 ${g.join(', ')}`);
  }

  const pg = await fetch(`https://graph.facebook.com/v21.0/${PAGE_ID}?fields=name&access_token=${e(token)}`).then(r=>r.json()).catch(()=>({}));
  console.log(`  Page: ${pg.name || pg.error?.message || '?'}`);

  const ad = await fetch(`https://graph.facebook.com/v21.0/act_${AD_ACCOUNT}?fields=name&access_token=${e(token)}`).then(r=>r.json()).catch(()=>({}));
  console.log(`  Ad: ${ad.name || ad.error?.message || '?'}`);
  return true;
}

async function extractTokenFromPage(page) {
  // 1. Inputs
  const token = await page.evaluate(() => {
    const inputs = Array.from(document.querySelectorAll('input'));
    for (const inp of inputs) {
      const v = inp.value;
      if (v && v.length > 170 && (v.startsWith('EAA') || v.startsWith('EAAG'))) return v;
    }
    const text = document.body.innerText;
    const m = text.match(/\b(EA[A-Z][A-Za-z0-9_-]{170,300})\b/);
    if (m) return m[1];
    return null;
  }).catch(() => null);
  return token;
}

async function main() {
  console.log('🔌 Conectando a Chrome...');
  const browser = await puppeteer.connect({ browserURL: 'http://localhost:9222', defaultViewport: null });
  const pages = await browser.pages();
  const page = pages[0];

  // Navegar a System Users
  await page.goto(`https://business.facebook.com/latest/settings/system_users?business_id=${BM_ID}`, {
    waitUntil: 'networkidle2', timeout: 30000
  }).catch(() => {});
  await wait(4000);

  // Click "Usuarios del sistema" si es necesario
  await page.evaluate(() => {
    const els = Array.from(document.querySelectorAll('a, span, div, li'));
    for (const el of els) {
      if (el.offsetParent === null) continue;
      const t = (el.textContent || '').trim().toLowerCase();
      if ((t === 'usuarios del sistema' || t === 'system users') && !t.includes('usuarios del sistematoken')) {
        el.click();
        return;
      }
    }
  });
  await wait(4000);

  // Esperar que cargue la lista
  let text = await page.evaluate(() => document.body.innerText).catch(() => '');
  let tries = 0;
  while (!text.includes('salesbot') && tries < 10) {
    await wait(2000);
    text = await page.evaluate(() => document.body.innerText).catch(() => '');
    tries++;
  }

  // Click "Generar identificador"
  console.log('\n🔑 Click "Generar identificador"...');
  const genClick = await page.evaluate(() => {
    const els = Array.from(document.querySelectorAll('span, div, button, a, [role="button"]'));
    const btn = els.find(el => {
      if (el.offsetParent === null) return false;
      const t = (el.textContent || '').trim();
      return t === 'Generar identificador' || t === 'Generate token' || t === 'Generate Token' || t.includes('Generar identif');
    });
    if (btn) { btn.click(); return btn.textContent.trim(); }
    return null;
  });
  console.log(`  Click: ${genClick}`);
  await wait(5000);

  // Tomar screenshot
  await page.screenshot({ path: path.join(__dirname, 'debug_su_token_dialog.png'), fullPage: false });
  console.log('  Screenshot: debug_su_token_dialog.png');

  // Ver contenido después
  const afterText = (await page.evaluate(() => document.body.innerText).catch(() => '')).split('\n').filter(l => l.trim());
  console.log('\n  Contenido:');
  afterText.slice(0, 40).forEach((l, i) => console.log(`    ${i}: ${l.substring(0, 140)}`));

  // Extraer token
  let token = await extractTokenFromPage(page);
  if (token) {
    console.log(`\n✅ Token: ${token.substring(0, 30)}...`);
    saveToken(token);
    await testToken(token);
    browser.disconnect();
    return;
  }

  // Si hay diálogo con permisos, seleccionarlos y generar
  const dialogText = await page.evaluate(() => {
    const dialogs = Array.from(document.querySelectorAll('[role="dialog"], [role="alertdialog"]'));
    return dialogs.map(d => ({ text: (d.textContent || '').trim().substring(0, 500), aria: d.getAttribute('aria-label') }));
  }).catch(() => []);
  if (dialogText.length) {
    console.log('\n🗄️  Diálogos:', JSON.stringify(dialogText, null, 2));
  }

  // Buscar botones adicionales en el diálogo
  console.log('\n🔍 Buscando opciones en diálogo...');
  const dialogBtns = await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('[role="dialog"] button, [role="dialog"] [role="button"], [role="dialog"] a, .x1n2onr6 button, [role="alertdialog"] button'));
    return btns.filter(b => b.offsetParent !== null).map(b => ({ text: (b.textContent || '').trim(), tag: b.tagName }));
  }).catch(() => []);
  dialogBtns.forEach((b, i) => console.log(`  ${i}: <${b.tag}> "${b.text}"`));

  // Buscar checkbox de permisos
  const permsInDialog = await page.evaluate(() => {
    const checks = Array.from(document.querySelectorAll('[role="dialog"] input[type="checkbox"], [role="dialog"] [role="checkbox"]'));
    return checks.map(c => ({
      label: (c.parentElement?.textContent || c.nextElementSibling?.textContent || '').trim().substring(0, 60),
      checked: c.checked || c.getAttribute('aria-checked') === 'true'
    }));
  }).catch(() => []);
  if (permsInDialog.length) {
    console.log('\n  Permisos en diálogo:');
    permsInDialog.forEach((p, i) => console.log(`    ${i}: ${p.checked ? '✅' : '⬜'} ${p.label}`));
  }

  // Asignar activos si es necesario
  if (text.includes('No se han asignado activos')) {
    console.log('\n📍 Asignando activos...');
    
    // Click "Asignar activos" o similar
    await page.evaluate(() => {
      const els = Array.from(document.querySelectorAll('span, div, button, a'));
      const btn = els.find(el => {
        if (el.offsetParent === null) return false;
        const t = (el.textContent || '').trim().toLowerCase();
        return t.includes('asignar') || t.includes('assign') || t.includes('añadir') || t.includes('add asset');
      });
      if (btn) { btn.click(); return true; }
      return false;
    });
    await wait(3000);

    const assignText = (await page.evaluate(() => document.body.innerText).catch(() => '')).split('\n').filter(l => l.trim());
    console.log('  Asignación:');
    assignText.slice(0, 20).forEach((l, i) => console.log(`    ${i}: ${l.substring(0, 120)}`));
  }

  // Intentar de nuevo el token después de acciones
  await page.evaluate(() => {
    const els = Array.from(document.querySelectorAll('span, div, button, a'));
    const btn = els.find(el => {
      if (el.offsetParent === null) return false;
      const t = (el.textContent || '').trim();
      return t === 'Generar identificador' || t === 'Generate token' || t.includes('Generar identif');
    });
    if (btn) { btn.click(); return true; }
    return false;
  });
  await wait(5000);

  token = await extractTokenFromPage(page);
  if (token) {
    console.log(`\n✅ Token: ${token.substring(0, 30)}...`);
    saveToken(token);
    await testToken(token);
  } else {
    console.log('\n⚠️ No se pudo generar automáticamente.');
  }

  console.log('\n🔵 Chrome queda abierto.');
  browser.disconnect();
}

main().catch(e => { console.error('Fatal:', e.message); process.exit(1); });
