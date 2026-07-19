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

function saveToken(token, source) {
  const r = { accessToken: token, source, pageId: PAGE_ID, pageName: 'VentasPro', adAccountId: AD_ACCOUNT, bmId: BM_ID, systemUserId: SYSTEM_USER_ID };
  fs.writeFileSync(TOKEN_FILE, JSON.stringify(r, null, 2));
  console.log(`\n✅ Token guardado (${token.length} chars)`);
}

async function testToken(token) {
  const fields = ['ads_management', 'business_management', 'pages_read_engagement', 'pages_manage_metadata', 'pages_messaging'];
  const esc = t => encodeURIComponent(t);
  const r = await fetch(`https://graph.facebook.com/v21.0/me?access_token=${esc(token)}&fields=name,id`).then(r=>r.json()).catch(()=>({}));
  if (r.error) { console.log(`  ❌ ${r.error.message}`); return false; }
  console.log(`  ✅ User: ${r.name} (${r.id})`);

  const rp = await fetch(`https://graph.facebook.com/v21.0/me/permissions?access_token=${esc(token)}`).then(r=>r.json()).catch(()=>({}));
  if (rp.data) {
    const granted = rp.data.filter(p => p.status === 'granted').map(p => p.permission);
    const missing = fields.filter(f => !granted.includes(f));
    console.log(`  📋 Permisos: ${granted.length}. Faltan: ${missing.length > 0 ? missing.join(', ') : 'ninguno ✅'}`);
  }

  const rad = await fetch(`https://graph.facebook.com/v21.0/act_${AD_ACCOUNT}?fields=name&access_token=${esc(token)}`).then(r=>r.json()).catch(()=>({}));
  if (rad.name) console.log(`  ✅ Ad Account: ${rad.name}`);
  else if (rad.error) console.log(`  ⚠️ Ad Account: ${rad.error.message}`);

  const rpg = await fetch(`https://graph.facebook.com/v21.0/${PAGE_ID}?fields=name&access_token=${esc(token)}`).then(r=>r.json()).catch(()=>({}));
  if (rpg.name) console.log(`  ✅ Page: ${rpg.name}`);
  else if (rpg.error) console.log(`  ⚠️ Page: ${rpg.error.message}`);

  return !r.error;
}

async function createSystemUserToken(adminToken) {
  const esc = t => encodeURIComponent(t);
  const scopes = 'ads_management,pages_read_engagement,business_management,pages_manage_metadata,pages_messaging';

  console.log('\n⚡ Creando token de System User vía API...');
  const url = `https://graph.facebook.com/v21.0/${SYSTEM_USER_ID}/access_tokens?app_id=${APP_ID}&scope=${scopes}&access_token=${esc(adminToken)}`;

  const r = await fetch(url, { method: 'POST' }).then(r=>r.json());
  if (r.access_token) {
    console.log(`  ✅ System User Token: ${r.access_token.substring(0, 30)}...`);
    saveToken(r.access_token, 'api_system_user');
    return r.access_token;
  }
  console.log(`  ❌ ${r.error?.message || JSON.stringify(r)}`);
  return null;
}

async function assignAssets(adminToken) {
  const esc = t => encodeURIComponent(t);
  console.log('\n📍 Asignando Page al System User...');

  const r1 = await fetch(`https://graph.facebook.com/v21.0/${SYSTEM_USER_ID}/assigned_pages?page_id=${PAGE_ID}&access_token=${esc(adminToken)}`, { method: 'POST' }).then(r=>r.json());
  console.log(`  Page: ${r1.success ? '✅' : '⚠️ ' + (r1.error?.message || JSON.stringify(r1))}`);

  const r2 = await fetch(`https://graph.facebook.com/v21.0/${SYSTEM_USER_ID}/assigned_ad_accounts?ad_account_id=act_${AD_ACCOUNT}&access_token=${esc(adminToken)}`, { method: 'POST' }).then(r=>r.json());
  console.log(`  Ad Account: ${r2.success ? '✅' : '⚠️ ' + (r2.error?.message || JSON.stringify(r2))}`);
}

async function main() {
  console.log('🔌 Conectando a Chrome...');
  const browser = await puppeteer.connect({ browserURL: 'http://localhost:9222', defaultViewport: null });
  const pages = await browser.pages();
  const page = pages[0];

  // 1. Ir al Graph API Explorer
  console.log('\n📍 Graph API Explorer...');
  await page.goto('https://developers.facebook.com/tools/explorer/', {
    waitUntil: 'domcontentloaded', timeout: 15000
  }).catch(() => {});
  await wait(4000);

  // 2. Click "Generate Access Token"
  console.log('\n🔑 Click en Generate Access Token...');
  const btnClicked = await page.evaluate(() => {
    const spans = Array.from(document.querySelectorAll('span, div, a, button'));
    for (const el of spans) {
      if (el.offsetParent !== null) {
        const t = (el.textContent || '').trim().toLowerCase();
        if (t === 'generate access token' || t.includes('generate access') || t.includes('acceso')) {
          el.click();
          return true;
        }
      }
    }
    return false;
  });
  console.log(`  Click: ${btnClicked}`);
  await wait(4000);

  // 3. Seleccionar permisos adicionales
  console.log('\n📋 Seleccionando permisos...');
  const neededPerms = ['ads_management', 'business_management', 'pages_read_engagement', 'pages_manage_metadata', 'pages_messaging'];
  for (const perm of neededPerms) {
    const clicked = await page.evaluate((p) => {
      const labels = Array.from(document.querySelectorAll('label, span, div, li'));
      for (const lb of labels) {
        if (lb.offsetParent === null) continue;
        const t = (lb.textContent || '').trim().toLowerCase().replace(/\s/g, '_');
        if (t === p || t.includes(p)) {
          const chk = document.getElementById(lb.htmlFor) || lb.querySelector('input[type="checkbox"]');
          if (chk && !chk.checked) { chk.click(); return 'checked'; }
          if (chk && chk.checked) return 'already';
          lb.click();
          return 'clicked';
        }
      }
      return 'not found';
    }, perm);
    console.log(`  ${perm}: ${clicked}`);
    await wait(300);
  }

  // 4. Click botón de confirmar permisos
  console.log('\n✅ Confirmando permisos...');
  await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('span, div, a, button, [role="button"]'));
    for (const el of btns) {
      if (el.offsetParent === null) continue;
      const t = (el.textContent || '').trim().toLowerCase();
      if (t === 'continue' || t.includes('continuar') || t === 'done' || t === 'hecho' || t === 'allow' || t === 'permitir' || t === 'confirmar') {
        el.click();
        return true;
      }
    }
    return false;
  });
  await wait(5000);
  console.log('  Esperando confirmación...');

  // 5. Esperar a que aparezca el nuevo token (puede redirigir a callback)
  for (let i = 0; i < 30; i++) {
    await wait(2000);

    // Check all pages for access_token in URL or hash
    const allPages = await browser.pages();
    for (const p of allPages) {
      try {
        const url = p.url();
        const m = url.match(/access_token=([^&]+)/);
        if (m) {
          const tok = decodeURIComponent(m[1]);
          console.log(`\n✅ Token en URL: ${tok.substring(0, 30)}...`);
          saveToken(tok, 'graph_explorer_url');
          await testToken(tok);

          // Try to create System User token
          console.log('\n⚡ Creando System User token con este admin token...');
          await assignAssets(tok);
          const suToken = await createSystemUserToken(tok);
          if (suToken) {
            console.log(`\n🎉 System User token: ${suToken.substring(0, 30)}...`);
            await testToken(suToken);
          }
          browser.disconnect();
          return;
        }

        const hashTok = await p.evaluate(() => {
          const h = window.location.hash;
          const mm = h.match(/access_token=([^&]+)/);
          return mm ? mm[1] : null;
        }).catch(() => null);
        if (hashTok) {
          console.log(`\n✅ Token en hash: ${hashTok.substring(0, 30)}...`);
          saveToken(hashTok, 'graph_explorer_hash');
          await testToken(hashTok);

          const suToken = await createSystemUserToken(hashTok);
          if (suToken) {
            console.log(`\n🎉 System User token: ${suToken.substring(0, 30)}...`);
            await testToken(suToken);
          }
          browser.disconnect();
          return;
        }
      } catch {}
    }

    // Check current page for token field
    const tokenInField = await page.evaluate(() => {
      const inputs = Array.from(document.querySelectorAll('input'));
      for (const inp of inputs) {
        if (inp.value && inp.value.length > 170 && (inp.value.startsWith('EAA') || inp.value.startsWith('EAAG'))) {
          return inp.value;
        }
      }
      return null;
    }).catch(() => null);

    if (tokenInField) {
      console.log(`\n✅ Token en input: ${tokenInField.substring(0, 30)}...`);
      saveToken(tokenInField, 'graph_explorer_input');
      await testToken(tokenInField);

      const suToken = await createSystemUserToken(tokenInField);
      if (suToken) {
        console.log(`\n🎉 System User token: ${suToken.substring(0, 30)}...`);
        await testToken(suToken);
      }
      browser.disconnect();
      return;
    }

    console.log(`  Esperando... ${(i + 1) * 2}s`);
  }

  console.log('\n⚠️ No se completó. Chrome queda abierto.');
  browser.disconnect();
}

main().catch(e => { console.error('Fatal:', e.message); process.exit(1); });
