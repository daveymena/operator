import puppeteer from 'puppeteer';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { setTimeout as wait } from 'timers/promises';
import readline from 'readline';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TOKEN_OUTPUT = path.join(__dirname, 'facebook-automation', 'tokens', 'fb_tokens_output.json');
const PAGE_TOKEN_FILE = path.join(__dirname, 'page_token.txt');
const ENV_FILE = path.join(__dirname, 'config', '.env');
const CHROME_PROFILE = path.join(__dirname, 'chrome-profile');
const APP_ID = '4238613976451604';
const AD_ACCOUNT = '1545022093928422';
const BM_ID = '4482432028697067';
const PAGE_ID = '1278583508663384';
const PAGE_NAME = 'VentasPro';

function rlQuestion(query) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise(resolve => rl.question(query, a => { rl.close(); resolve(a); }));
}

async function waitForToken(page, browser) {
  for (let i = 0; i < 120; i++) {
    try {
      const pages = await browser.pages();
      for (const p of pages) {
        const url = p.url();
        const hashMatch = url.match(/access_token=([^&]+)/);
        if (hashMatch) return hashMatch[1];

        const tokenFromHash = await p.evaluate(() => {
          const h = window.location.hash;
          const m = h.match(/access_token=([^&]+)/);
          return m ? m[1] : null;
        }).catch(() => null);
        if (tokenFromHash) return tokenFromHash;
      }

      const tokenOnPage = await page.evaluate(() => {
        const inputs = Array.from(document.querySelectorAll('input'));
        for (const inp of inputs) {
          if (inp.offsetParent !== null && inp.value && inp.value.startsWith('EAA') && inp.value.length > 50) {
            return inp.value;
          }
        }
        const textEls = Array.from(document.querySelectorAll('div, span, code, pre'));
        for (const el of textEls) {
          const t = (el.textContent || '').trim();
          if (el.offsetParent !== null && t.startsWith('EAA') && t.length > 50) return t;
        }
        const scripts = Array.from(document.querySelectorAll('script'));
        for (const s of scripts) {
          const m = (s.textContent || '').match(/accessToken["']?\s*[:=]\s*["'](EAA[A-Za-z0-9_-]{100,})["']/);
          if (m) return m[1];
        }
        return null;
      }).catch(() => null);
      if (tokenOnPage) return tokenOnPage;

    } catch {}
    await wait(1500);
  }
  return null;
}

async function main() {
  console.log('\n╔══════════════════════════════════════════════════════════╗');
  console.log('║   🔑 GENERADOR DE TOKEN FACEBOOK                      ║');
  console.log('╚══════════════════════════════════════════════════════════╝\n');

  const mode = process.argv[2] || await rlQuestion(
    'Elige método:\n' +
    '  [1] Access Token Tool (recomendado - usa sesión actual)\n' +
    '  [2] OAuth Dialog (genera token nuevo con permisos)\n' +
    '  [3] System User (Business Manager)\n' +
    '  > '
  );

  console.log('\nLanzando Chrome con tu perfil guardado...\n');
  const browser = await puppeteer.launch({
    headless: false,
    defaultViewport: { width: 1280, height: 900 },
    userDataDir: CHROME_PROFILE,
    args: ['--no-sandbox', '--disable-blink-features=AutomationControlled'],
  });

  const page = await browser.newPage();
  await page.goto('https://www.facebook.com/', { waitUntil: 'networkidle2', timeout: 30000 }).catch(() => {});
  await wait(3000);

  const loggedIn = !page.url().includes('login');
  if (!loggedIn) {
    console.log('⚠️  No estás logueado en Facebook.');
    console.log('Por favor inicia sesión en Chrome y luego presiona Enter...');
    await rlQuestion('');
  } else {
    console.log('✅ Sesión de Facebook activa\n');
  }

  let token = null;

  if (mode === '1') {
    console.log('[1/2] Navegando al Graph API Explorer...');
    await page.goto('https://developers.facebook.com/tools/explorer/', {
      waitUntil: 'networkidle2', timeout: 30000
    }).catch(() => {});
    await wait(6000);

    const pageUrl = page.url();
    const urlMatch = pageUrl.match(/access_token=([^&]+)/);
    if (urlMatch) {
      token = decodeURIComponent(urlMatch[1]);
      console.log('  Token encontrado en URL');
    }
    if (!token && pageUrl.includes('login')) {
      console.log('  Redirigido a login, esperando sesión...');
      await wait(10000);
    }

    console.log('[2/2] Extrayendo token de la página...\n');

        token = await page.evaluate(() => {
      const inputs = Array.from(document.querySelectorAll('input'));
      for (const inp of inputs) {
        const v = (inp.value || '').trim();
        if (v.startsWith('EAA') && v.length > 50 && v.length < 400) return v;
      }
      const codes = Array.from(document.querySelectorAll('code, pre, .mbs, ._58vw'));
      for (const el of codes) {
        const t = (el.textContent || '').trim();
        if (t.startsWith('EAA') && t.length > 50 && t.length < 400) return t;
        const m = t.match(/\b(EAA[A-Za-z0-9_-]{100,})\b/);
        if (m) return m[1];
      }
      const bodyText = document.body.innerText;
      const m = bodyText.match(/\b(EAA[A-Za-z0-9_-]{150,250})\b/);
      if (m) return m[1];
      return null;
    });

    if (!token) {
      console.log('Token no encontrado directamente.');
      console.log('Buscando en scripts de la página...\n');
      token = await page.evaluate(() => {
        const scripts = Array.from(document.querySelectorAll('script'));
        for (const s of scripts) {
          const m = (s.textContent || '').match(/\b(EAA[A-Za-z0-9_-]{150,250})\b/);
          if (m) return m[1];
        }
        for (let i = 0; i < localStorage.length; i++) {
          const k = localStorage.key(i);
          const v = localStorage.getItem(k);
          if (v && v.length > 100) {
            const m = v.match(/\b(EAA[A-Za-z0-9_-]{150,250})\b/);
            if (m) return m[1];
          }
        }
        return null;
      });
    }

  } else if (mode === '2') {
    console.log('[1/3] Solicitando token vía OAuth...');
    const authUrl = `https://www.facebook.com/v21.0/dialog/oauth?client_id=${APP_ID}&redirect_uri=${encodeURIComponent('https://developers.facebook.com/tools/explorer/callback')}&scope=pages_read_engagement,pages_manage_metadata,business_management,ads_management,pages_messaging&response_type=token,granted_scopes&auth_type=rerequest`;
    await page.goto(authUrl, { waitUntil: 'networkidle2', timeout: 60000 }).catch(() => {});
    await wait(4000);

    console.log('[2/3] Esperando autorización...');
    console.log('  → Si ves la pantalla de permisos, haz clic en "Continuar"');
    console.log('  → Esperando token...\n');

    token = await waitForToken(page, browser);

  } else if (mode === '3') {
    console.log('[1/3] Navegando a System Users...');
    await page.goto(`https://business.facebook.com/latest/settings/system_users?business_id=${BM_ID}`, {
      waitUntil: 'networkidle2', timeout: 30000
    }).catch(() => {});
    await wait(5000);

    console.log('[2/3] Buscando token de System User...');
    console.log('  → Si ves la lista de usuarios, haz clic en "Generar token"');
    console.log('  → Esperando token...\n');

    token = await waitForToken(page, browser);
  }

  if (!token || token.length < 50) {
    console.log('\n❌ No se pudo extraer el token automáticamente.');
    const manual = await rlQuestion('Pega el token manualmente (o Enter para cancelar): ');
    if (manual && manual.length > 50) token = manual;
  }

  if (token && token.length > 50) {
    const result = {
      accessToken: token,
      pageId: PAGE_ID,
      pageName: PAGE_NAME,
      adAccountId: AD_ACCOUNT,
      bmId: BM_ID
    };

    fs.mkdirSync(path.dirname(TOKEN_OUTPUT), { recursive: true });
    fs.writeFileSync(TOKEN_OUTPUT, JSON.stringify(result, null, 2));
    fs.writeFileSync(PAGE_TOKEN_FILE, token, 'utf8');

    let envContent = '';
    try { envContent = fs.readFileSync(ENV_FILE, 'utf8'); } catch {}
    if (envContent.includes('FACEBOOK_ACCESS_TOKEN=')) {
      envContent = envContent.replace(/FACEBOOK_ACCESS_TOKEN=.*/g, `FACEBOOK_ACCESS_TOKEN=${token}`);
    } else {
      envContent += `\nFACEBOOK_ACCESS_TOKEN=${token}\n`;
    }
    fs.writeFileSync(ENV_FILE, envContent, 'utf8');

    console.log('\n' + '='.repeat(60));
    console.log('✅ TOKEN GENERADO Y GUARDADO');
    console.log('='.repeat(60));
    console.log(`\n📁 ${TOKEN_OUTPUT}`);
    console.log(`📁 ${PAGE_TOKEN_FILE}`);
    console.log(`📁 ${ENV_FILE}`);
    console.log(`\n🔑 Token: ${token.substring(0, 40)}...${token.slice(-10)}`);
    console.log(`📊 Longitud: ${token.length} caracteres`);

    const val = await fetch(`https://graph.facebook.com/v21.0/me?access_token=${token}&fields=name,id`).then(r => r.json()).catch(() => ({}));
    if (val.id) {
      console.log(`✅ Token VÁLIDO - Usuario: ${val.name || val.id}`);
    } else {
      console.log(`⚠️  Token guardado pero no validado: ${val.error?.message || '?'}`);
    }
  } else {
    console.log('\n❌ No se generó ningún token.');
  }

  await browser.close();
  console.log('');
  process.exit(0);
}

main().catch(e => { console.error('FATAL:', e.message); process.exit(1); });