import puppeteer from 'puppeteer';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { setTimeout as wait } from 'timers/promises';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TOKEN_FILE = path.join(__dirname, 'facebook-automation', 'tokens', 'fb_tokens_output.json');
const ENV_FILE = path.join(__dirname, 'config', '.env');
const BM_ID = '4482432028697067';
const PAGE_ID = '1278583508663384';
const AD_ACCOUNT = '1545022093928422';

async function saveToken(token) {
  const result = { accessToken: token, pageId: PAGE_ID, pageName: 'VentasPro', adAccountId: AD_ACCOUNT, bmId: BM_ID };
  fs.writeFileSync(TOKEN_FILE, JSON.stringify(result, null, 2));
  let env = '';
  try { env = fs.readFileSync(ENV_FILE, 'utf8'); } catch {}
  env = env.includes('FACEBOOK_ACCESS_TOKEN=') ? env.replace(/FACEBOOK_ACCESS_TOKEN=.*/g, `FACEBOOK_ACCESS_TOKEN=${token}`) : env + `\nFACEBOOK_ACCESS_TOKEN=${token}\n`;
  fs.writeFileSync(ENV_FILE, env);
  console.log(`\n✅ Token guardado: ${token.substring(0, 35)}...${token.slice(-10)}`);

  const val = await fetch(`https://graph.facebook.com/v21.0/me?access_token=${token}&fields=name,id`).then(r=>r.json()).catch(()=>({}));
  if (val.id) console.log(`✅ Válido: ${val.name || val.id}`);
  else console.log(`⚠️ ${val.error?.message || '?'}`);

  const perms = await fetch(`https://graph.facebook.com/v21.0/me/permissions?access_token=${token}`).then(r=>r.json()).catch(()=>({}));
  if (perms.data) {
    const granted = perms.data.filter(p => p.status === 'granted').map(p => p.permission);
    console.log(`📋 Permisos: ${granted.join(', ')}`);
    const hasAds = granted.includes('ads_management');
    console.log(`📊 ads_management: ${hasAds ? '✅' : '❌'}`);
  }
}

async function clickButton(page, texts, opts = {}) {
  for (const text of texts) {
    try {
      const els = await page.$$('button, [role="button"], a, span, div[role="menuitem"], li');
      for (const el of els) {
        const t = (await el.evaluate(e => (e.textContent || '').trim().toLowerCase()).catch(() => ''));
        if (t.includes(text.toLowerCase())) {
          await el.click();
          await wait(opts.wait || 2000);
          return true;
        }
      }
    } catch {}
  }
  return false;
}

async function waitForSelector(page, selectors, timeout = 8000) {
  for (const sel of selectors) {
    try {
      await page.waitForSelector(sel, { timeout });
      return sel;
    } catch {}
  }
  return null;
}

async function extractToken(page) {
  return await page.evaluate(() => {
    const inputs = Array.from(document.querySelectorAll('input'));
    for (const inp of inputs) {
      const v = (inp.value || '').trim();
      if (v.startsWith('EAA') && v.length > 50 && v.length < 400) return v;
    }
    const all = Array.from(document.querySelectorAll('code, pre, div, span'));
    for (const el of all) {
      const t = (el.textContent || '').trim();
      const m = t.match(/\b(EAA[A-Za-z0-9_-]{150,250})\b/);
      if (m) return m[1];
    }
    const scripts = Array.from(document.querySelectorAll('script'));
    for (const s of scripts) {
      const m = (s.textContent || '').match(/\b(EAA[A-Za-z0-9_-]{150,250})\b/);
      if (m) return m[1];
    }
    return null;
  }).catch(() => null);
}

async function monitorPopups(browser, callback) {
  browser.on('targetcreated', async (target) => {
    if (target.type() !== 'page') return;
    await wait(2000);
    try {
      const p = await target.page();
      const url = p.url();
      console.log(`  Popup: ${url.substring(0, 100)}`);
      const m = url.match(/access_token=([^&]+)/);
      if (m) { callback(decodeURIComponent(m[1])); }
      const hashToken = await p.evaluate(() => {
        const h = window.location.hash;
        const mm = h.match(/access_token=([^&]+)/);
        return mm ? mm[1] : null;
      }).catch(() => null);
      if (hashToken) callback(hashToken);
    } catch {}
  });
}

async function main() {
  console.log('\n🔌 Conectando a Chrome...');
  const browser = await puppeteer.connect({ browserURL: 'http://localhost:9222', defaultViewport: null });
  let foundToken = null;

  monitorPopups(browser, (t) => {
    if (!foundToken) { foundToken = t; console.log('  ✅ Token capturado de popup!'); }
  });

  const page = (await browser.pages())[0] || await browser.newPage();

  // Ir a System Users
  console.log('\n📍 Navegando a System Users...');
  await page.goto(`https://business.facebook.com/latest/settings/system_users?business_id=${BM_ID}`, {
    waitUntil: 'networkidle2', timeout: 30000
  }).catch(() => {});
  await wait(5000);
  console.log(`  URL: ${page.url().substring(0, 100)}`);

  // Revisar si ya hay un SalesBot
  const pageText = await page.evaluate(() => document.body.innerText).catch(() => '');
  const hasSalesBot = pageText.includes('SalesBot');

  if (!hasSalesBot) {
    console.log('\n👤 Creando System User "SalesBot"...');
    await clickButton(page, ['Añadir', 'Add', 'Crear', 'Create', 'New', 'Nuevo']);
    await wait(3000);

    // Escribir nombre
    const nameInput = await page.$('input[type="text"], input:not([type]), input[name*="name"], div[contenteditable="true"]');
    if (nameInput) {
      await nameInput.click();
      await nameInput.type('SalesBot', { delay: 50 });
      console.log('  Nombre escrito');
    } else {
      // Intentar con evaluate
      await page.evaluate(() => {
        const inputs = Array.from(document.querySelectorAll('input'));
        const visible = inputs.find(i => i.offsetParent !== null);
        if (visible) {
          visible.focus();
          visible.value = 'SalesBot';
          const ev = new Event('input', { bubbles: true });
          visible.dispatchEvent(ev);
        }
      });
      console.log('  Nombre insertado');
    }
    await wait(1500);

    // Guardar
    await clickButton(page, ['Guardar', 'Save', 'Crear', 'Create', 'Siguiente', 'Next', 'Continuar', 'Continue', 'Hecho', 'Done']);
    await wait(4000);

    // Cerrar modales
    await clickButton(page, ['Cerrar', 'Close', 'Hecho', 'Done', 'OK', 'Aceptar']);
    await wait(2000);
  } else {
    console.log('✅ SalesBot ya existe');
  }

  // Buscar el usuario y generar token
  console.log('\n🔑 Buscando botón "Generar token"...');
  await clickButton(page, ['Generar token', 'Generate token', 'Generate Token', 'Token']);

  await wait(3000);

  // Marcar permisos en el dialog
  console.log('\n📋 Marcando permisos...');
  const permsToCheck = ['ads_management', 'pages_read_engagement', 'pages_manage_metadata', 'business_management', 'pages_messaging'];
  for (const perm of permsToCheck) {
    try {
      const els = await page.$$('label, span, div, li');
      for (const el of els) {
        const t = (await el.evaluate(e => (e.textContent || '').trim().toLowerCase()).catch(() => ''));
        if (t.includes(perm.replace(/_/g, ' ').toLowerCase()) || t.includes(perm.toLowerCase())) {
          const checkbox = await el.$('input[type="checkbox"]') || el;
          const checked = await checkbox.evaluate(e => e.checked || e.getAttribute('aria-checked') === 'true').catch(() => false);
          if (!checked) {
            await checkbox.click().catch(() => {});
            console.log(`  ✅ ${perm}`);
          } else {
            console.log(`  ℹ️  ${perm} ya marcado`);
          }
          break;
        }
      }
    } catch {}
    await wait(300);
  }

  // Generar token
  console.log('\n⚡ Generando token...');
  await clickButton(page, ['Generar token', 'Generate token', 'Generate', 'Crear token', 'Create token']);
  await wait(5000);

  // Extraer token de la página
  console.log('\n🔍 Extrayendo token...');
  let token = await extractToken(page);

  if (!token) {
    // Buscar en todas las páginas abiertas (popups)
    const allPages = await browser.pages();
    for (const p of allPages) {
      if (!token) token = await extractToken(p);
      if (token) break;
    }
  }

  if (token) {
    await saveToken(token);
  } else {
    console.log('❌ No se pudo extraer automáticamente.');
    console.log('Revisa Chrome - debería mostrar el token generado.');
    console.log('Si ves el token, cópialo y ejecuta:');
    console.log('  node -e "import(\'./auto-token.mjs\').then(m => m.guardar(\'TU_TOKEN_AQUI\'))"');
  }

  console.log('\n🔵 Chrome queda ABIERTO. Puedes seguirlo usando.');
}

main().catch(e => console.error('Error:', e.message));

export { saveToken };