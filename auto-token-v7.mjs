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
  const me = await fetch(`https://graph.facebook.com/v21.0/me?fields=name,id&access_token=${e(token)}`).then(r=>r.json());
  if (me.name || me.id) console.log(`  ✅ /me: ${me.name || me.id}`);
  else console.log(`  ❌ ${me.error?.message || 'error'}`);

  const perms = await fetch(`https://graph.facebook.com/v21.0/me/permissions?access_token=${e(token)}`).then(r=>r.json());
  if (perms.data) {
    const g = perms.data.filter(p => p.status === 'granted').map(p => p.permission);
    console.log(`  📋 ${g.join(', ')}`);
  }

  const page = await fetch(`https://graph.facebook.com/v21.0/${PAGE_ID}?fields=name&access_token=${e(token)}`).then(r=>r.json());
  console.log(`  Page: ${page.name || page.error?.message || '?'}`);

  const ad = await fetch(`https://graph.facebook.com/v21.0/act_${AD_ACCOUNT}?fields=name&access_token=${e(token)}`).then(r=>r.json());
  console.log(`  Ad: ${ad.name || ad.error?.message || '?'}`);

  return !!me.name;
}

async function clickVisibleByText(page, texts) {
  for (const text of texts) {
    const clicked = await page.evaluate((t) => {
      const all = Array.from(document.querySelectorAll('button, [role="button"], a, span, div[role="menuitem"], li'));
      for (const el of all) {
        if (el.offsetParent === null) continue;
        const txt = (el.textContent || '').trim().toLowerCase();
        if (txt === t.toLowerCase() || txt.includes(t.toLowerCase())) {
          el.click();
          return el.textContent.trim().substring(0, 50);
        }
      }
      return null;
    }, text);
    if (clicked) { console.log(`  👆 "${clicked}"`); await wait(2000); return true; }
  }
  return false;
}

async function main() {
  console.log('🔌 Conectando a Chrome...');
  const browser = await puppeteer.connect({ browserURL: 'http://localhost:9222', defaultViewport: null });
  const pages = await browser.pages();
  const page = pages[0];

  // ===== NAVEGAR A SYSTEM USERS (vista clásica) =====
  console.log('\n📍 Navegando a System Users (clásico)...');
  await page.goto(`https://business.facebook.com/settings/system-users?business_id=${BM_ID}`, {
    waitUntil: 'networkidle2', timeout: 30000
  }).catch(() => {});
  await wait(5000);
  console.log(`  URL: ${page.url().substring(0, 120)}`);

  const pageText = await page.evaluate(() => document.body.innerText).catch(() => '');
  const pageLines = pageText.split('\n').filter(l => l.trim());
  console.log(`  Líneas: ${pageLines.length}`);
  pageLines.slice(0, 30).forEach((l, i) => console.log(`    ${i}: ${l.substring(0, 120)}`));

  // ===== CLICK EN SALESBOT =====
  console.log('\n👤 Click en SalesBot...');
  const clickedSalesBot = await page.evaluate(() => {
    const all = Array.from(document.querySelectorAll('a, span, div, td, tr'));
    for (const el of all) {
      if (el.offsetParent === null) continue;
      const txt = (el.textContent || '').trim();
      if (txt.includes('SalesBot')) {
        el.click();
        return true;
      }
    }
    return false;
  });
  console.log(`  Click: ${clickedSalesBot}`);
  await wait(4000);

  const text2 = (await page.evaluate(() => document.body.innerText).catch(() => '')).split('\n').filter(l => l.trim());
  console.log('  Después del click:');
  text2.slice(0, 40).forEach((l, i) => console.log(`    ${i}: ${l.substring(0, 120)}`));

  // ===== CLICK "GENERATE TOKEN" =====
  console.log('\n🔑 Buscando Generate Token...');
  await clickVisibleByText(page, ['Generate Token', 'Generar token', 'Auth Token', 'Access Token', 'Token']);

  const text3 = (await page.evaluate(() => document.body.innerText).catch(() => '')).split('\n').filter(l => l.trim());
  console.log('  Después de Generate Token:');
  text3.slice(0, 30).forEach((l, i) => console.log(`    ${i}: ${l.substring(0, 120)}`));

  // ===== BUSCAR TOKEN EN INPUTS =====
  console.log('\n🔍 Buscando token en inputs...');
  const inputTokens = await page.evaluate(() => {
    const results = [];
    document.querySelectorAll('input[type="text"], input:not([type]), input[type="password"]').forEach(inp => {
      const v = inp.value || '';
      if (v.length > 100 && (v.startsWith('EAA') || v.startsWith('EAAG'))) {
        results.push({ id: inp.id, name: inp.name, value: v });
      }
    });
    return results;
  }).catch(() => []);
  console.log(`  Inputs con token: ${inputTokens.length}`);
  inputTokens.forEach(t => console.log(`    id="${t.id}" name="${t.name}" value="${t.value.substring(0, 30)}...${t.value.slice(-10)}"`));

  if (inputTokens.length > 0) {
    const tok = inputTokens[0].value;
    saveToken(tok);
    console.log('\n📊 Probando...');
    const ok = await testToken(tok);
    if (ok) { console.log('🎉 Válido!'); browser.disconnect(); return; }
  }

  // ===== BUSCAR TOKEN EN TEXTO =====
  console.log('\n🔍 Buscando token en el DOM...');
  const regexToken = await page.evaluate(() => {
    const t = document.body.innerText;
    const m = t.match(/\b(EAA[A-Za-z0-9_-]{180,300})\b/) || t.match(/\b(EAAG[A-Za-z0-9_-]{180,300})\b/);
    return m ? m[1] : null;
  }).catch(() => null);
  if (regexToken) {
    console.log(`  Regex: ${regexToken.substring(0, 30)}...${regexToken.slice(-10)}`);
    saveToken(regexToken);
    await testToken(regexToken);
  } else {
    console.log('  No token en texto.');
  }

  // ===== CAPTURAR HTML DE DIALOG =====
  const dialogHtml = await page.evaluate(() => {
    const dialogs = Array.from(document.querySelectorAll('[role="dialog"], [class*="dialog"], [class*="modal"]'));
    return dialogs.map(d => ({
      role: d.getAttribute('role'),
      class: d.className.substring(0, 80),
      text: (d.textContent || '').trim().substring(0, 300)
    }));
  }).catch(() => []);
  if (dialogHtml.length) {
    console.log(`\n🗄️  Diálogos encontrados: ${dialogHtml.length}`);
    dialogHtml.forEach((d, i) => console.log(`  ${i}: role="${d.role}" class="${d.class}" text="${d.text}"`));
  }

  console.log('\n🔵 Chrome queda abierto.');
  browser.disconnect();
}

main().catch(e => { console.error('Fatal:', e.message); process.exit(1); });
