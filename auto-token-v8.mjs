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
  if (me.error) return console.log(`  ❌ ${me.error.message}`), false;
  console.log(`  ✅ User: ${me.name}`);

  const perms = await fetch(`https://graph.facebook.com/v21.0/me/permissions?access_token=${e(token)}`).then(r=>r.json()).catch(()=>({}));
  if (perms.data) {
    const g = perms.data.filter(p => p.status === 'granted').map(p => p.permission);
    console.log(`  📋 ${g.join(', ')}`);
  }

  const page = await fetch(`https://graph.facebook.com/v21.0/${PAGE_ID}?fields=name&access_token=${e(token)}`).then(r=>r.json()).catch(()=>({}));
  console.log(`  Page: ${page.name || page.error?.message || '?'}`);

  const ad = await fetch(`https://graph.facebook.com/v21.0/act_${AD_ACCOUNT}?fields=name&access_token=${e(token)}`).then(r=>r.json()).catch(()=>({}));
  console.log(`  Ad: ${ad.name || ad.error?.message || '?'}`);
  return true;
}

async function main() {
  console.log('🔌 Conectando a Chrome...');
  const browser = await puppeteer.connect({ browserURL: 'http://localhost:9222', defaultViewport: null });
  const pages = await browser.pages();
  const page = pages[0];

  // ===== 1. Ir a System Users =====
  console.log('\n📍 System Users...');
  await page.goto(`https://business.facebook.com/latest/settings/system_users?business_id=${BM_ID}`, {
    waitUntil: 'networkidle2', timeout: 30000
  }).catch(() => {});
  await wait(5000);

  // ===== 2. Click "Usuarios del sistema" en sidebar =====
  console.log('\n📂 Click "Usuarios del sistema"...');
  const sidebarClick = await page.evaluate(() => {
    const els = Array.from(document.querySelectorAll('a, span, div, li, [role="button"]'));
    for (const el of els) {
      if (el.offsetParent === null) continue;
      const t = (el.textContent || '').trim().toLowerCase();
      if (t === 'usuarios del sistema' || t === 'system users') {
        el.click();
        return true;
      }
    }
    return false;
  });
  console.log(`  Click: ${sidebarClick}`);
  await wait(5000);

  // Screenshot
  await page.screenshot({ path: path.join(__dirname, 'debug_su_list.png'), fullPage: false });
  console.log('  Screenshot: debug_su_list.png');

  // ===== 3. Buscar SalesBot en la lista =====
  const listText = await page.evaluate(() => document.body.innerText).catch(() => '');
  const listLines = listText.split('\n').filter(l => l.trim());
  console.log(`\n  Contenido después del click (${listLines.length} líneas):`);
  listLines.slice(0, 50).forEach((l, i) => console.log(`    ${i}: ${l.substring(0, 140)}`));

  if (listText.includes('SalesBot')) {
    console.log('\n✅ SalesBot encontrado!');

    // ===== 4. Click en SalesBot =====
    const clickRow = await page.evaluate(() => {
      const els = Array.from(document.querySelectorAll('a, span, div, tr, td, [role="row"], [role="button"]'));
      for (const el of els) {
        if (el.offsetParent === null) continue;
        const t = (el.textContent || '').trim();
        if (t === 'SalesBot' || t.includes('SalesBot')) {
          el.click();
          return el.textContent.trim().substring(0, 50);
        }
      }
      return false;
    });
    console.log(`  Click SalesBot: ${clickRow}`);
    await wait(5000);

    await page.screenshot({ path: path.join(__dirname, 'debug_su_detail.png'), fullPage: false });
    console.log('  Screenshot: debug_su_detail.png');

    // ===== 5. Ver detalle =====
    const detailText = (await page.evaluate(() => document.body.innerText).catch(() => '')).split('\n').filter(l => l.trim());
    console.log('\n  Detalle:');
    detailText.slice(0, 40).forEach((l, i) => console.log(`    ${i}: ${l.substring(0, 140)}`));

    // ===== 6. Buscar "Generate Token" =====
    console.log('\n🔑 Buscando Generate Token...');
    await page.evaluate(() => {
      const els = Array.from(document.querySelectorAll('button, [role="button"], a, span, div'));
      for (const el of els) {
        if (el.offsetParent === null) continue;
        const t = (el.textContent || '').trim().toLowerCase();
        if (t.includes('generate') || t.includes('generar') || t.includes('token')) {
          el.click();
          return;
        }
      }
    });
    await wait(5000);

    // ===== 7. Ver si hay diálogo con token =====
    const afterGenText = (await page.evaluate(() => document.body.innerText).catch(() => '')).split('\n').filter(l => l.trim());
    console.log('\n  Después de Generate:');
    afterGenText.slice(0, 30).forEach((l, i) => console.log(`    ${i}: ${l.substring(0, 140)}`));

    await page.screenshot({ path: path.join(__dirname, 'debug_su_token.png'), fullPage: false });
    console.log('  Screenshot: debug_su_token.png');

    // ===== 8. Extraer token =====
    const allInputs = await page.evaluate(() => {
      const res = [];
      document.querySelectorAll('input').forEach(inp => {
        const v = inp.value || '';
        res.push({ id: inp.id, name: inp.name, type: inp.type, value_preview: v.substring(0, 30) + (v.length > 30 ? `...(${v.length})` : '') });
      });
      return res;
    }).catch(() => []);
    console.log('\n  Inputs:');
    allInputs.forEach((inp, i) => console.log(`    ${i}: ${inp.type} "${inp.name || inp.id}" = "${inp.value_preview}"`));

    const tokenInput = allInputs.find(i => i.value_preview.startsWith('EAA') || i.value_preview.startsWith('EAAG'));
    if (tokenInput) {
      const fullVal = await page.evaluate(() => {
        const inp = document.querySelector('input');
        if (inp && inp.value && inp.value.length > 100) return inp.value;
        const all = Array.from(document.querySelectorAll('input'));
        for (const i of all) if (i.value && i.value.length > 100 && (i.value.startsWith('EAA') || i.value.startsWith('EAAG'))) return i.value;
        return null;
      });
      if (fullVal) {
        saveToken(fullVal);
        console.log('\n📊 Probando...');
        await testToken(fullVal);
      }
    }

    // Buscar en todo el DOM
    const domToken = await page.evaluate(() => {
      const t = document.body.innerText;
      const m = t.match(/\b(EA[A-Z][A-Za-z0-9_-]{170,300})\b/);
      return m ? m[1] : null;
    }).catch(() => null);
    if (domToken) {
      console.log(`\n  Token del DOM: ${domToken.substring(0, 30)}...${domToken.slice(-10)}`);
      saveToken(domToken);
      await testToken(domToken);
    }
  } else {
    console.log('\n⚠️ SalesBot no visible. Contenido:');
    listLines.slice(50, 80).forEach((l, i) => console.log(`    ${i + 50}: ${l.substring(0, 140)}`));
  }

  console.log('\n🔵 Chrome queda abierto.');
  browser.disconnect();
}

main().catch(e => { console.error('Fatal:', e.message); process.exit(1); });
