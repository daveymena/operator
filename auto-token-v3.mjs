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

function escape(s) { return encodeURIComponent(s); }
function saveToken(token, source) {
  const r = { accessToken: token, source, pageId: PAGE_ID, pageName: 'VentasPro', adAccountId: AD_ACCOUNT, bmId: BM_ID, systemUserId: SYSTEM_USER_ID };
  fs.writeFileSync(TOKEN_FILE, JSON.stringify(r, null, 2));
  console.log(`\n✅ Token guardado (${token.length} chars)`);
}

async function testToken(token) {
  const r1 = await fetch(`https://graph.facebook.com/v21.0/me?access_token=${escape(token)}&fields=name,id`).then(r=>r.json()).catch(()=>({}));
  if (r1.name) { console.log(`  ✅ /me: ${r1.name}`); return true; }
  if (r1.id) { console.log(`  ✅ /me: ID ${r1.id}`); return true; }

  const r2 = await fetch(`https://graph.facebook.com/v21.0/${PAGE_ID}?fields=name&access_token=${escape(token)}`).then(r=>r.json()).catch(()=>({}));
  if (r2.name) { console.log(`  ✅ Page: ${r2.name}`); return true; }

  const r3 = await fetch(`https://graph.facebook.com/v21.0/act_${AD_ACCOUNT}?fields=name&access_token=${escape(token)}`).then(r=>r.json()).catch(()=>({}));
  if (r3.name) { console.log(`  ✅ Ad Account: ${r3.name}`); return true; }

  console.log(`  ❌ ${r1.error?.message || r2.error?.message || r3.error?.message || 'unknown'}`);
  return false;
}

async function extractTokenFromAllPages(browser) {
  const pages = await browser.pages();
  for (const p of pages) {
    try {
      const tok = await p.evaluate(() => {
        const text = document.body.innerText;
        let m = text.match(/\b(EAA[A-Za-z0-9_-]{170,300})\b/);
        if (m) return m[1];
        m = text.match(/\b(EAAG[A-Za-z0-9_-]{170,300})\b/);
        if (m) return m[1];
        const inputs = Array.from(document.querySelectorAll('input'));
        for (const inp of inputs) {
          if (inp.value && inp.value.length > 170 && (inp.value.startsWith('EAA') || inp.value.startsWith('EAAG'))) return inp.value;
        }
        return null;
      }).catch(() => null);
      if (tok) { console.log(`  Token en page "${p.url().substring(0,60)}"`); return tok; }
    } catch {}
  }
  return null;
}

async function main() {
  console.log('🔌 Conectando a Chrome...');
  const browser = await puppeteer.connect({ browserURL: 'http://localhost:9222', defaultViewport: null });
  const pages = await browser.pages();
  const page = pages[0];

  // ===== ESTRATEGIA 1: Ir a la página del System User y gestionar activos + token =====
  console.log('\n📍 Sistema: Navegando a System User detail...');
  await page.goto(`https://business.facebook.com/latest/settings/system_users/${SYSTEM_USER_ID}?business_id=${BM_ID}`, {
    waitUntil: 'domcontentloaded', timeout: 20000
  }).catch(() => {});
  await wait(6000);
  console.log(`  URL: ${page.url().substring(0, 120)}`);

  // Tomar screenshot
  await page.screenshot({ path: path.join(__dirname, 'debug_system_user.png'), fullPage: false });
  console.log('  Screenshot: debug_system_user.png');

  // Extraer texto visible
  const visible = await page.evaluate(() => document.body.innerText).catch(() => '');
  const lines = visible.split('\n').filter(l => l.trim()).slice(0, 50);
  lines.forEach((l, i) => console.log(`  ${i}: ${l.substring(0, 120)}`));

  // Los System User tokens generados desde la UI de BM a veces se muestran en un input de solo lectura
  // o en un bloque <code>. Busquemos en todo el DOM
  const allTokenFields = await page.evaluate(() => {
    const results = [];
    // Buscar inputs con valor que parezca token
    document.querySelectorAll('input').forEach(inp => {
      if (inp.value && inp.value.length > 100 && (inp.value.startsWith('EAA') || inp.value.startsWith('EAAG'))) {
        results.push({ tag: 'input', id: inp.id, val: inp.value });
      }
    });
    // Buscar divs/code/pre con token
    document.querySelectorAll('code, pre, div, span, textarea').forEach(el => {
      const t = (el.textContent || '').trim();
      if (t.length > 170 && (t.startsWith('EAA') || t.startsWith('EAAG'))) {
        results.push({ tag: el.tagName, id: el.id, val: t.substring(0, 50) + '...' });
      }
    });
    return results;
  }).catch(() => []);
  console.log(`\n🔑 Campos con token: ${JSON.stringify(allTokenFields)}`);

  // Si encontramos token completo en input, usarlo
  if (allTokenFields.length > 0) {
    const fullToken = allTokenFields.find(f => f.tag === 'input')?.val || allTokenFields[0].val;
    // Need to get the full value from the input
    const realToken = await page.evaluate(() => {
      const inp = document.querySelector('input');
      if (inp && inp.value && inp.value.length > 170 && (inp.value.startsWith('EAA') || inp.value.startsWith('EAAG'))) return inp.value;
      const code = document.querySelector('code');
      if (code) return code.textContent.trim();
      const allCode = Array.from(document.querySelectorAll('code'));
      for (const c of allCode) if (c.textContent.trim().length > 170) return c.textContent.trim();
      return null;
    }).catch(() => null);

    if (realToken) {
      console.log(`\n✅ Token encontrado en página: ${realToken.substring(0, 30)}...`);
      saveToken(realToken, 'system_user_ui_page');
      const valid = await testToken(realToken);
      if (valid) { console.log('\n🎉 Token válido!'); browser.disconnect(); return; }
      console.log('  No es válido, buscando otro método...');
    }
  }

  // ===== ESTRATEGIA 2: Navegar al Token Debugger para ver qué pasa =====
  console.log('\n📍 Debug: Token Debugger...');
  // Test the saved token in the debugger
  const savedToken = JSON.parse(fs.readFileSync(TOKEN_FILE, 'utf8')).accessToken;
  await page.goto(`https://developers.facebook.com/tools/debug/accesstoken/?access_token=${savedToken}&version=v21.0`, {
    waitUntil: 'domcontentloaded', timeout: 15000
  }).catch(() => {});
  await wait(5000);
  const debugInfo = await page.evaluate(() => document.body.innerText).catch(() => '');
  console.log(`  Debug: ${debugInfo.substring(0, 500).replace(/\n/g, ' | ')}`);

  // ===== ESTRATEGIA 3: System User desde Graph API Explorer =====
  // Ir al Graph API Explorer
  console.log('\n📍 Graph API Explorer...');
  await page.goto('https://developers.facebook.com/tools/explorer/', {
    waitUntil: 'domcontentloaded', timeout: 15000
  }).catch(() => {});
  await wait(6000);
  const explorerText = await page.evaluate(() => document.body.innerText).catch(() => '');
  console.log(`  Explorer: ${explorerText.substring(0, 500).replace(/\n/g, ' | ')}`);

  // Ver si ya hay un token seleccionado
  const existingToken = await page.evaluate(() => {
    const all = Array.from(document.querySelectorAll('*'));
    const inp = all.find(el => el.tagName === 'INPUT' && el.offsetParent !== null && el.value && el.value.length > 100 && (el.value.startsWith('EAA') || el.value.startsWith('EAAG')));
    if (inp) return inp.value;
    return null;
  }).catch(() => null);

  if (existingToken) {
    console.log(`  Token en Explorer: ${existingToken.substring(0, 30)}...`);
    saveToken(existingToken, 'graph_api_explorer');
    const valid = await testToken(existingToken);
    if (valid) { console.log('\n🎉 Token válido!'); browser.disconnect(); return; }
  }

  // ===== ESTRATEGIA 4: OAuth directo desde la app =====
  console.log('\n📍 OAuth: Abriendo diálogo de permisos...');
  const scopes = 'ads_management,pages_read_engagement,business_management,pages_manage_metadata,pages_messaging,pages_show_list';
  const oauthUrl = `https://www.facebook.com/v21.0/dialog/oauth?client_id=${APP_ID}&redirect_uri=${escape('https://developers.facebook.com/tools/explorer/callback')}&scope=${scopes}&response_type=token,granted_scopes&auth_type=rerequest`;
  await page.goto(oauthUrl, { waitUntil: 'domcontentloaded', timeout: 20000 }).catch(() => {});
  await wait(5000);
  const oauthText = await page.evaluate(() => {
    return { url: window.location.href.substring(0, 200), body: document.body.innerText.substring(0, 200) };
  }).catch(() => ({}));
  console.log(`  OAuth: ${JSON.stringify(oauthText)}`);

  // Esperar a que redirija con token
  for (let i = 0; i < 60; i++) {
    await wait(2000);
    try {
      const url = page.url();
      const m = url.match(/access_token=([^&]+)/);
      if (m) {
        const tok = decodeURIComponent(m[1]);
        console.log(`\n✅ Token de OAuth: ${tok.substring(0, 30)}...`);
        saveToken(tok, 'oauth_direct');
        const valid = await testToken(tok);
        if (valid) { browser.disconnect(); return; }
      }
      const hashTok = await page.evaluate(() => {
        const h = window.location.hash;
        const mm = h.match(/access_token=([^&]+)/);
        return mm ? mm[1] : null;
      }).catch(() => null);
      if (hashTok) {
        console.log(`\n✅ Token de hash: ${hashTok.substring(0, 30)}...`);
        saveToken(hashTok, 'oauth_hash');
        const valid = await testToken(hashTok);
        if (valid) { browser.disconnect(); return; }
      }
    } catch {}
  }

  // ===== ESTRATEGIA 5: Usar API para crear System User token con admin token =====
  // Si conseguimos token de admin, creamos System User token vía API
  console.log('\n⚠️ No se encontró token válido. Chrome queda abierto para debug manual.');
  console.log('Abre tú la página y busca el token generado.');
  browser.disconnect();
}

main().catch(e => { console.error('Fatal:', e.message); process.exit(1); });
