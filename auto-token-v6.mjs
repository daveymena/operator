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
  console.log(`\n✅ Token guardado (${token.length} chars): ${token.substring(0, 30)}...${token.slice(-10)}`);
}

async function testToken(token) {
  const esc = t => encodeURIComponent(t);
  const perms = await fetch(`https://graph.facebook.com/v21.0/me/permissions?access_token=${esc(token)}`).then(r=>r.json()).catch(()=>({}));
  if (perms.data) {
    const g = perms.data.filter(p => p.status === 'granted').map(p => p.permission);
    console.log(`  📋 Permisos: ${g.join(', ') || 'ninguno'}`);
  }

  const page = await fetch(`https://graph.facebook.com/v21.0/${PAGE_ID}?fields=name&access_token=${esc(token)}`).then(r=>r.json()).catch(()=>({}));
  console.log(`  Page: ${page.name || page.error?.message || '?'}`);

  const ad = await fetch(`https://graph.facebook.com/v21.0/act_${AD_ACCOUNT}?fields=name,account_status&access_token=${esc(token)}`).then(r=>r.json()).catch(()=>({}));
  console.log(`  Ad: ${ad.name || ad.error?.message || '?'}`);

  return !page.error;
}

async function main() {
  console.log('🔌 Conectando a Chrome...');
  const browser = await puppeteer.connect({ browserURL: 'http://localhost:9222', defaultViewport: null });
  const pages = await browser.pages();
  const page = pages.find(p => !p.url().includes('chrome-error')) || pages[0];

  // ===== PASO 1: Ir al detalle del System User =====
  console.log('\n📍 Navegando a System User...');
  await page.goto(`https://business.facebook.com/latest/settings/system_users/${SYSTEM_USER_ID}?business_id=${BM_ID}`, {
    waitUntil: 'domcontentloaded', timeout: 20000
  }).catch(() => {});
  await wait(6000);

  // ===== PASO 2: Ver qué hay en la página =====
  const text = await page.evaluate(() => document.body.innerText).catch(() => '');
  const lines = text.split('\n').filter(l => l.trim());
  console.log('  Contenido:');
  lines.slice(0, 40).forEach((l, i) => console.log(`    ${i}: ${l.substring(0, 120)}`));

  // ===== PASO 3: Buscar botón Generate Token =====
  console.log('\n🔑 Buscando Generate Token...');
  const buttons = await page.evaluate(() => {
    const all = Array.from(document.querySelectorAll('button, [role="button"], a, span'));
    return all.filter(e => e.offsetParent !== null).map(e => ({
      tag: e.tagName,
      text: (e.textContent || '').trim().substring(0, 60),
      class: e.className?.substring(0, 60)
    }));
  });
  buttons.forEach((b, i) => console.log(`  ${i}: <${b.tag}> "${b.text}"`));

  // Click "Generate Token" si existe
  for (const btn of buttons) {
    const t = btn.text.toLowerCase();
    if (t.includes('generate') || t.includes('token') || t.includes('generar')) {
      console.log(`  👆 Click: "${btn.text}"`);
      await page.evaluate((text) => {
        const all = Array.from(document.querySelectorAll('button, [role="button"], a, span'));
        const el = all.find(e => (e.textContent || '').trim().toLowerCase().includes(text.toLowerCase()) && e.offsetParent !== null);
        if (el) el.click();
      }, btn.text);
      await wait(5000);
      break;
    }
  }

  // ===== PASO 4: Ver si hay dialog con token =====
  const text2 = await page.evaluate(() => document.body.innerText).catch(() => '');
  const lines2 = text2.split('\n').filter(l => l.trim());
  console.log('\n  Después del click:');
  lines2.slice(0, 30).forEach((l, i) => console.log(`    ${i}: ${l.substring(0, 120)}`));

  // ===== PASO 5: Extraer token de inputs o del DOM =====
  const tokens = await page.evaluate(() => {
    const results = [];
    // Check all input values
    document.querySelectorAll('input').forEach(inp => {
      const v = inp.value;
      if (v && v.length > 100 && (v.startsWith('EAA') || v.startsWith('EAAG'))) {
        results.push({ type: 'input', id: inp.id || inp.name, value: v });
      }
    });
    // Check code/pre/div/span content
    document.querySelectorAll('code, pre, div[class*="token"], span[class*="token"]').forEach(el => {
      const t = (el.textContent || '').trim();
      if (t.length > 150 && (t.startsWith('EAA') || t.startsWith('EAAG'))) {
        results.push({ type: el.tagName, id: el.id, value: t.substring(0, 50) + '...' });
      }
    });
    // Full page search for long tokens
    const allText = document.body.innerText;
    const m = allText.match(/\b(EAA[A-Za-z0-9_-]{180,300})\b/);
    if (m) results.push({ type: 'regex', value: m[1].substring(0, 50) + '...' });
    const m2 = allText.match(/\b(EAAG[A-Za-z0-9_-]{180,300})\b/);
    if (m2) results.push({ type: 'regex', value: m2[1].substring(0, 50) + '...' });
    return results;
  }).catch(() => []);

  console.log(`\n🔎 Tokens encontrados: ${tokens.length}`);
  tokens.forEach((t, i) => console.log(`  ${i}: ${t.type} ${t.value}`));

  if (tokens.length > 0) {
    const full = tokens[0];
    let realToken = full.value;
    // If it's an input, get the full value
    if (full.type === 'input') {
      realToken = await page.evaluate(() => {
        const inp = document.querySelector('input');
        if (inp && inp.value && inp.value.length > 100) return inp.value;
        const allInps = Array.from(document.querySelectorAll('input'));
        for (const i of allInps) if (i.value && i.value.length > 100 && (i.value.startsWith('EAA') || i.value.startsWith('EAAG'))) return i.value;
        return null;
      }).catch(() => null);
    }
    // If regex, get from body
    if (full.type === 'regex') {
      realToken = await page.evaluate(() => {
        const t = document.body.innerText;
        const m = t.match(/\b(EAA[A-Za-z0-9_-]{180,300})\b/);
        if (m) return m[1];
        const m2 = t.match(/\b(EAAG[A-Za-z0-9_-]{180,300})\b/);
        if (m2) return m2[1];
        return null;
      }).catch(() => null);
    }

    if (realToken && realToken.length > 100) {
      saveToken(realToken);
      console.log('\n📊 Probando token...');
      await testToken(realToken);
    }
  }

  // ===== PASO 6: Si no hay token, ir al Token Tool =====
  if (!tokens.length) {
    console.log('\n📍 Token no encontrado. Navegando al Token Tool...');
    await page.goto(`https://business.facebook.com/latest/settings/system_users?business_id=${BM_ID}`, {
      waitUntil: 'domcontentloaded', timeout: 20000
    }).catch(() => {});
    await wait(5000);

    // Buscar SalesBot en la lista y hacer click
    const clickSalesBot = await page.evaluate(() => {
      const els = Array.from(document.querySelectorAll('a, span, div'));
      for (const el of els) {
        if (el.offsetParent !== null && (el.textContent || '').trim() === 'SalesBot') {
          el.closest('a, div[role="button"]')?.click() || el.click();
          return true;
        }
      }
      return false;
    });
    console.log(`  Click SalesBot: ${clickSalesBot}`);
    await wait(5000);

    // Now look for token
    const text3 = await page.evaluate(() => document.body.innerText).catch(() => '');
    const m = text3.match(/\b(EAA[A-Za-z0-9_-]{180,300})\b/) || text3.match(/\b(EAAG[A-Za-z0-9_-]{180,300})\b/);
    if (m) {
      console.log(`✅ Token encontrado en texto: ${m[1].substring(0, 30)}...`);
      saveToken(m[1]);
      await testToken(m[1]);
    }
  }

  console.log('\n🔵 Chrome queda abierto.');
  browser.disconnect();
}

main().catch(e => { console.error('Fatal:', e.message); process.exit(1); });
