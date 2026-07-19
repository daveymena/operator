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
const SYSTEM_USER_ID = '61591903358831';

function saveToken(token) {
  const r = { accessToken: token, pageId: PAGE_ID, pageName: 'VentasPro', adAccountId: AD_ACCOUNT, bmId: BM_ID, systemUserId: SYSTEM_USER_ID };
  fs.writeFileSync(TOKEN_FILE, JSON.stringify(r, null, 2));
  console.log(`✅ Token guardado (${token.length} chars)`);
}

async function testToken(token) {
  const e = t => encodeURIComponent(t);
  const tests = [
    ['Page', `https://graph.facebook.com/v21.0/${PAGE_ID}?fields=name&access_token=${e(token)}`],
    ['Ad', `https://graph.facebook.com/v21.0/act_${AD_ACCOUNT}?fields=name&access_token=${e(token)}`],
    ['Perms', `https://graph.facebook.com/v21.0/me/permissions?access_token=${e(token)}`],
    ['BM', `https://graph.facebook.com/v21.0/${BM_ID}?fields=name&access_token=${e(token)}`],
  ];
  for (const [label, url] of tests) {
    const r = await fetch(url).then(r=>r.json()).catch(()=>({}));
    console.log(`  ${label}: ${r.name || r.id || r.data?.[0]?.permission || r.error?.message || '?'}`);
    if (r.data) {
      const g = r.data.filter(p => p.status === 'granted').map(p => p.permission);
      if (g.length) console.log(`    → ${g.join(', ')}`);
    }
  }
}

async function main() {
  console.log('🔌 Conectando a Chrome...');
  const browser = await puppeteer.connect({ browserURL: 'http://localhost:9222', defaultViewport: null });
  const pages = await browser.pages();
  const page = pages[0];

  // Interceptar respuestas de la API de BM
  let capturedToken = null;
  page.on('response', async (response) => {
    if (capturedToken) return;
    try {
      const url = response.url();
      if (!url.includes('graph.facebook.com') && !url.includes('business.facebook.com/api')) return;
      if (url.includes('access_tokens') || url.includes('create_token') || url.includes('system_user_access_token')) {
        const json = await response.json().catch(() => null);
        if (json) {
          if (json.access_token) {
            capturedToken = json.access_token;
            console.log(`\n  🎯 Token capturado de API: ${json.access_token.substring(0, 30)}...`);
          }
          if (json.data) {
            for (const d of Array.isArray(json.data) ? json.data : [json.data]) {
              if (d.access_token) {
                capturedToken = d.access_token;
                console.log(`\n  🎯 Token capturado de data: ${d.access_token.substring(0, 30)}...`);
              }
            }
          }
        }
      }
    } catch {}
  });

  // Navegar a System Users
  console.log('\n📍 Navegando a System Users...');
  await page.goto(`https://business.facebook.com/latest/settings/system_users?business_id=${BM_ID}`, {
    waitUntil: 'networkidle2', timeout: 30000
  }).catch(() => {});
  await wait(5000);

  // Click "Usuarios del sistema" en sidebar
  const sidebarClicked = await page.evaluate(() => {
    const els = Array.from(document.querySelectorAll('a,span,div,li'));
    for (const e of els) {
      if (e.offsetParent && (e.textContent||'').trim().toLowerCase() === 'usuarios del sistema') {
        e.click(); return true;
      }
    }
    return false;
  });
  console.log(`  Sidebar click: ${sidebarClicked}`);
  await wait(6000);

  // Click "Generar identificador"
  console.log('\n🔑 Click "Generar identificador"...');
  const genClicked = await page.evaluate(() => {
    const all = Array.from(document.querySelectorAll('*'));
    const btn = all.find(e => e.offsetParent && e.textContent.trim() === 'Generar identificador' && e.childElementCount === 0);
    if (btn) { btn.click(); return 'leaf'; }
    const btn2 = all.find(e => e.offsetParent && e.textContent.trim() === 'Generar identificador');
    if (btn2) { btn2.click(); return 'parent'; }
    return 'not found';
  });
  console.log(`  Click: ${genClicked}`);
  await wait(5000);

  // Check if dialog appeared
  const text = await page.evaluate(() => document.body.innerText).catch(() => '');
  const lines = text.split('\n').filter(l => l.trim());
  console.log('\n  Contenido:');
  lines.filter(l => l.includes('token') || l.includes('Token') || l.includes('EAA') || l.includes('permiso') || l.includes('permis')).slice(0, 20).forEach(l => console.log(`    ${l.substring(0, 140)}`));
  lines.filter(l => l.includes('Aplicación') || l.includes('App') || l.includes('cuenta') || l.includes('asignar')).slice(0, 10).forEach(l => console.log(`    ${l.substring(0, 140)}`));

  // Esperar y chequear token capturado
  for (let i = 0; i < 15; i++) {
    await wait(2000);
    if (capturedToken) break;

    // Try clicking any dialog buttons
    await page.evaluate(() => {
      const els = Array.from(document.querySelectorAll('span, div, button, a'));
      for (const el of els) {
        if (el.offsetParent === null) continue;
        const t = (el.textContent || '').trim().toLowerCase();
        if (['continue', 'continuar', 'permitir', 'allow', 'siguiente', 'next', 'generar', 'generate', 'confirmar', 'confirm'].includes(t)) {
          el.click(); return;
        }
      }
    });
  }

  if (capturedToken) {
    saveToken(capturedToken);
    console.log('\n📊 Probando token...');
    await testToken(capturedToken);
  } else {
    console.log('\n⚠️ No se capturó token de API.');
  }

  // Screenshot final
  await page.screenshot({ path: path.join(__dirname, 'debug_final.png'), fullPage: false });
  console.log('\n🔵 Chrome queda abierto.');
  browser.disconnect();
}

main().catch(e => { console.error('Fatal:', e.message); process.exit(1); });
