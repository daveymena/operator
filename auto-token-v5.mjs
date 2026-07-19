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

function esc(s) { return encodeURIComponent(s); }
function saveToken(token, source) {
  const r = { accessToken: token, source, pageId: PAGE_ID, pageName: 'VentasPro', adAccountId: AD_ACCOUNT, bmId: BM_ID, systemUserId: SYSTEM_USER_ID };
  fs.writeFileSync(TOKEN_FILE, JSON.stringify(r, null, 2));
  console.log(`\n✅ Token guardado (${token.length} chars)`);
}

async function testToken(token) {
  const t = esc(token);
  const perms = await fetch(`https://graph.facebook.com/v21.0/me/permissions?access_token=${t}`).then(r=>r.json()).catch(()=>({}));
  if (perms.data) {
    const granted = perms.data.filter(p => p.status === 'granted').map(p => p.permission);
    const needed = ['ads_management', 'business_management', 'pages_read_engagement', 'pages_manage_metadata', 'pages_messaging'];
    const missing = needed.filter(f => !granted.includes(f));
    console.log(`  📋 Permisos (${granted.length}): ${granted.slice(0, 10).join(', ')}${granted.length > 10 ? '...' : ''}`);
    console.log(`  ❌ Faltan: ${missing.length > 0 ? missing.join(', ') : 'NINGUNO ✅'}`);
  }
  const me = await fetch(`https://graph.facebook.com/v21.0/me?access_token=${t}&fields=name,id`).then(r=>r.json()).catch(()=>({}));
  console.log(`  User: ${me.name || me.error?.message || '?'}`);
  return !me.error;
}

async function createSystemUserToken(adminToken) {
  const t = esc(adminToken);
  const scopes = 'ads_management,pages_read_engagement,business_management,pages_manage_metadata,pages_messaging';
  console.log(`\n⚡ System User token via API (business_app=${APP_ID})...`);

  const body = new URLSearchParams({ business_app: APP_ID, scope: scopes, access_token: adminToken });
  const r = await fetch(`https://graph.facebook.com/v21.0/${SYSTEM_USER_ID}/access_tokens`, { method: 'POST', body }).then(r=>r.json());
  if (r.access_token) {
    console.log(`  ✅ Token: ${r.access_token.substring(0, 30)}...`);
    saveToken(r.access_token, 'api_system_user');
    return r.access_token;
  }
  console.log(`  ❌ ${r.error?.message || JSON.stringify(r)}`);
  return null;
}

async function assignAssets(adminToken) {
  const t = esc(adminToken);
  const results = [];

  const r1 = await fetch(`https://graph.facebook.com/v21.0/${SYSTEM_USER_ID}/assigned_pages`, {
    method: 'POST',
    body: new URLSearchParams({ page_id: PAGE_ID, access_token: adminToken })
  }).then(r=>r.json()).catch(()=>({}));
  results.push(`Page: ${r1.success ? '✅' : r1.error?.message || '?'}`);

  const r2 = await fetch(`https://graph.facebook.com/v21.0/${SYSTEM_USER_ID}/assigned_ad_accounts`, {
    method: 'POST',
    body: new URLSearchParams({ ad_account_id: `act_${AD_ACCOUNT}`, access_token: adminToken })
  }).then(r=>r.json()).catch(()=>({}));
  results.push(`Ad Account: ${r2.success ? '✅' : r2.error?.message || '?'}`);

  results.forEach(r => console.log(`  ${r}`));
}

async function main() {
  console.log('🔌 Conectando a Chrome...');
  const browser = await puppeteer.connect({ browserURL: 'http://localhost:9222', defaultViewport: null });
  const pages = await browser.pages();
  let page = pages.find(p => !p.url().includes('chrome-error')) || pages[0];

  // Buscar token existente en localStorage del Explorer
  const existingAdmin = await page.evaluate(() => {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      const v = localStorage.getItem(k);
      if (v && v.length > 150 && (v.startsWith('EAA') || v.startsWith('EAAG'))) return v;
    }
    return null;
  }).catch(() => null);
  if (existingAdmin) console.log(`\n🔑 Token en localStorage: ${existingAdmin.substring(0, 30)}...`);

  // ===== PASO 1: OAuth dialog para obtener token con todos los permisos =====
  const scopes = 'ads_management,business_management,pages_read_engagement,pages_manage_metadata,pages_messaging,pages_show_list';
  const cb = 'https://developers.facebook.com/tools/explorer/callback';
  const oauthUrl = `https://www.facebook.com/v21.0/dialog/oauth?client_id=${APP_ID}&redirect_uri=${esc(cb)}&scope=${scopes}&response_type=token,granted_scopes&auth_type=rerequest`;

  console.log('\n📍 Abriendo OAuth dialog...');
  await page.goto(oauthUrl, { waitUntil: 'domcontentloaded', timeout: 20000 }).catch(() => {});
  await wait(5000);

  // Monitorear redirecciones
  let newToken = null;
  browser.on('targetcreated', async (target) => {
    if (target.type() !== 'page') return;
    await wait(3000);
    try {
      const p = await target.page();
      const url = p.url();
      const m = url.match(/access_token=([^&]+)/);
      if (m) { newToken = decodeURIComponent(m[1]); console.log(`  🎯 Token de popup! ${newToken.substring(0, 30)}...`); }
      const hm = await p.evaluate(() => { const h = window.location.hash; const mm = h.match(/access_token=([^&]+)/); return mm ? mm[1] : null; }).catch(() => null);
      if (hm) { newToken = hm; console.log(`  🎯 Token de hash! ${hm.substring(0, 30)}...`); }
    } catch {}
  });

  // Esperar y ver estado actual
  for (let i = 0; i < 40; i++) {
    await wait(2000);

    try {
      const u = page.url();
      const m = u.match(/access_token=([^&]+)/);
      if (m) { newToken = decodeURIComponent(m[1]); }

      const h = await page.evaluate(() => { const hh = window.location.hash; const mm = hh.match(/access_token=([^&]+)/); return mm ? mm[1] : null; }).catch(() => null);
      if (h) { newToken = h; }

      // Find Continue button
      const btns = await page.$$('button, [role="button"], a[role="button"], span[role="button"]');
      for (const btn of btns) {
        try {
          const t = (await page.evaluate(el => el.textContent.trim().toLowerCase(), btn)) || '';
          if ((t === 'continue' || t.includes('continuar') || t === 'allow' || t.includes('permitir')) && !t.includes('guardar')) {
            const isVisible = await page.evaluate(el => el.offsetParent !== null, btn);
            if (isVisible) {
              await btn.click();
              console.log(`  👆 Click: "${t}"`);
              await wait(3000);
            }
          }
        } catch {}
      }
    } catch {}

    if (newToken) break;

    const txt = await page.evaluate(() => document.body.innerText.substring(0, 200)).catch(() => '');
    console.log(`  [${(i+1)*2}s] ${(txt.substring(0, 80) || '...').replace(/\n/g, ' ')}`);
  }

  // ===== PASO 2: Usar el token obtenido =====
  let adminToken = newToken;

  if (!adminToken) {
    console.log('\n⚠️ No se obtuvo token OAuth. Usando token existente...');
    adminToken = existingAdmin || JSON.parse(fs.readFileSync(TOKEN_FILE, 'utf8')).accessToken;
  }

  if (adminToken) {
    console.log('\n📊 Probando admin token...');
    const valid = await testToken(adminToken);
    if (valid) {
      saveToken(adminToken, 'user_token');
      await assignAssets(adminToken);
      const suToken = await createSystemUserToken(adminToken);
      if (suToken) {
        console.log('\n🎉 ¡System User token generado!');
      }
    }
  }

  console.log('\n🔵 Chrome queda abierto.');
  browser.disconnect();
}

main().catch(e => { console.error('Fatal:', e.message); process.exit(1); });
