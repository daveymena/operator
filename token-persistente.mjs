import puppeteer from 'puppeteer';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { setTimeout as wait } from 'timers/promises';
import readline from 'readline';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TOKEN_FILE = path.join(__dirname, 'facebook-automation', 'tokens', 'fb_tokens_output.json');
const ENV_FILE = path.join(__dirname, 'config', '.env');
const BM_ID = '4482432028697067';
const PAGE_ID = '1278583508663384';
const AD_ACCOUNT = '1545022093928422';

function rl(q) {
  return new Promise(r => { const rl = readline.createInterface({input:process.stdin,output:process.stdout}); rl.question(q, a => {rl.close();r(a);}); });
}

async function saveToken(token, source) {
  const result = { accessToken: token, pageId: PAGE_ID, pageName: 'VentasPro', adAccountId: AD_ACCOUNT, bmId: BM_ID };
  fs.writeFileSync(TOKEN_FILE, JSON.stringify(result, null, 2));
  let env = '';
  try { env = fs.readFileSync(ENV_FILE, 'utf8'); } catch {}
  env = env.includes('FACEBOOK_ACCESS_TOKEN=') ? env.replace(/FACEBOOK_ACCESS_TOKEN=.*/g, `FACEBOOK_ACCESS_TOKEN=${token}`) : env + `\nFACEBOOK_ACCESS_TOKEN=${token}\n`;
  fs.writeFileSync(ENV_FILE, env);
  console.log(`\n✅ TOKEN GUARDADO (${source})`);
  console.log(`📁 ${TOKEN_FILE}`);
  console.log(`📁 ${ENV_FILE}`);
  console.log(`🔑 ${token.substring(0, 35)}...${token.slice(-10)}`);

  const val = await fetch(`https://graph.facebook.com/v21.0/me?access_token=${token}&fields=name,id`).then(r=>r.json()).catch(()=>({}));
  if (val.id) console.log(`✅ Válido: ${val.name || val.id}`);
  else console.log(`⚠️ ${val.error?.message || 'error validando'}`);

  const perms = await fetch(`https://graph.facebook.com/v21.0/me/permissions?access_token=${token}`).then(r=>r.json()).catch(()=>({}));
  if (perms.data) {
    const granted = perms.data.filter(p => p.status === 'granted').map(p => p.permission);
    console.log(`📋 Permisos: ${granted.join(', ')}`);
  }
}

async function extractTokenFromPage(page) {
  const token = await page.evaluate(() => {
    const inputs = Array.from(document.querySelectorAll('input'));
    for (const inp of inputs) {
      const v = (inp.value || '').trim();
      if (v.startsWith('EAA') && v.length > 50 && v.length < 400) return v;
    }
    const codes = Array.from(document.querySelectorAll('code, pre'));
    for (const el of codes) {
      const t = (el.textContent || '').trim();
      if (t.startsWith('EAA') && t.length > 50 && t.length < 400) return t;
    }
    const bodyText = document.body.innerText;
    const m = bodyText.match(/\b(EAA[A-Za-z0-9_-]{150,250})\b/);
    if (m) return m[1];
    return null;
  }).catch(() => null);
  return token;
}

async function waitForTokenOnAnyPage(browser) {
  for (let i = 0; i < 180; i++) {
    const pages = await browser.pages();
    for (const p of pages) {
      try {
        const url = p.url();
        const m = url.match(/access_token=([^&]+)/);
        if (m) return decodeURIComponent(m[1]);
        const hashToken = await p.evaluate(() => {
          const h = window.location.hash;
          const mm = h.match(/access_token=([^&]+)/);
          return mm ? mm[1] : null;
        }).catch(() => null);
        if (hashToken) return hashToken;
        const onPage = await extractTokenFromPage(p);
        if (onPage) return onPage;
      } catch {}
    }
    await wait(2000);
  }
  return null;
}

async function main() {
  console.log('\n🔌 Conectando a Chrome existente (localhost:9222)...');
  const browser = await puppeteer.connect({ browserURL: 'http://localhost:9222', defaultViewport: null });
  console.log('✅ Conectado. Chrome persistente (NO se cerrará al terminar)\n');

  const pages = await browser.pages();
  let page = pages[0];
  if (!page) page = await browser.newPage();

  console.log('URL actual:', page.url().substring(0, 100));

  const action = process.argv[2] || await rl(
    'Elige:\n' +
    '  [1] System User - Business Manager (RECOMENDADO)\n' +
    '  [2] Graph API Explorer - token con permisos\n' +
    '  [3] Extraer token de la página actual\n' +
    '  > '
  );

  if (action === '1' || action === '1') {
    console.log('\n📋 Navegando a System Users...');
    await page.goto(`https://business.facebook.com/latest/settings/system_users?business_id=${BM_ID}`, {
      waitUntil: 'networkidle2', timeout: 30000
    }).catch(() => {});
    await wait(6000);

    console.log('\n⚠️  DEBES:');
    console.log('  1. Click "Añadir" / "Add" para crear System User');
    console.log('  2. Nombre: "SalesBot"');
    console.log('  3. Click "Generar token" con permisos:');
    console.log('     - pages_read_engagement');
    console.log('     - pages_manage_metadata');
    console.log('     - business_management');
    console.log('     - ads_management');
    console.log('     - pages_messaging');
    console.log('  4. Copia el token que aparece\n');

    const manual = await rl('¿Ya generaste el token? Pégalo aquí (Enter para buscar automático): ');
    if (manual && manual.length > 50) {
      await saveToken(manual, 'manual');
    } else {
      console.log('🔍 Buscando token en la página...');
      const token = await waitForTokenOnAnyPage(browser);
      if (token) await saveToken(token, 'auto');
      else console.log('❌ No se encontró token automáticamente');
    }

  } else if (action === '2' || action === '2') {
    console.log('\n📋 Navegando a Graph API Explorer...');
    await page.goto('https://developers.facebook.com/tools/explorer/', {
      waitUntil: 'networkidle2', timeout: 30000
    }).catch(() => {});
    await wait(5000);

    console.log('\n⚠️  En la página:');
    console.log('  1. Selecciona la App: "4238613976451604"');
    console.log('  2. En "User or Page": selecciona "User Token"');
    console.log('  3. Permisos: agrega ads_management, pages_read_engagement');
    console.log('  4. Click "Generate Access Token"');
    console.log('  5. Autoriza los permisos en el popup\n');

    const manual = await rl('¿Ya generaste el token? Pégalo aquí (Enter para buscar): ');
    if (manual && manual.length > 50) {
      await saveToken(manual, 'manual');
    } else {
      console.log('🔍 Buscando token en la página...');
      const token = await waitForTokenOnAnyPage(browser);
      if (token) await saveToken(token, 'auto');
      else console.log('❌ No se encontró token automáticamente');
    }

  } else {
    console.log('\n🔍 Buscando token en la página actual...');
    const token = await extractTokenFromPage(page);
    if (token) {
      await saveToken(token, 'página actual');
    } else {
      console.log('No se encontró token. Navegando al Access Token Tool...');
      await page.goto('https://developers.facebook.com/tools/accesstoken/', {
        waitUntil: 'networkidle2', timeout: 30000
      }).catch(() => {});
      await wait(5000);
      const token2 = await extractTokenFromPage(page);
      if (token2) await saveToken(token2, 'Access Token Tool');
      else console.log('❌ No se encontró token');
    }
  }

  console.log('\n🔵 Chrome queda ABIERTO. Puedes seguir usándolo.');
  console.log('   Para salir: cierra la ventana de Chrome manualmente.\n');
  // NO cerrar browser - el usuario quiere persistencia
}

main().catch(e => { console.error('Error:', e.message); });