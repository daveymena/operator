import puppeteer from 'puppeteer';
import fs from 'fs';
import path from 'path';
import { execSync, spawn } from 'child_process';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..', '..');
const FB_AUTOMATION = path.resolve(__dirname, '..');
const TOKENS_DIR = path.join(FB_AUTOMATION, 'tokens');
const SS_DIR = 'C:\\Users\\ADMIN\\Music\\ss_ads_full';
fs.mkdirSync(SS_DIR, { recursive: true });
fs.mkdirSync(TOKENS_DIR, { recursive: true });

const CONFIG = {
  chromeUrl: 'http://127.0.0.1:9222',
  userDataDir: path.join(ROOT, 'chrome-profile'),
  bmId: '4482432028697067',
  pageId: '1278583508663384',
  pageName: 'VentasPro - Cursos Digitales',
  adAccountId: '1545022093928422',
  whatsappNumber: '573206541575',
  apiVersion: 'v21.0',
  graphBase: 'https://graph.facebook.com',
  ssDir: SS_DIR,
};

let browser = null;
let page = null;
let step_counter = 0;
let token = null;

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function ss(name) {
  step_counter++;
  const file = path.join(CONFIG.ssDir, `${String(step_counter).padStart(2, '0')}_${name}.png`);
  if (page) await page.screenshot({ path: file, fullPage: false });
  console.log(`  📸 ${step_counter}. ${name}.png`);
}

async function clickByText(text, tag = '*', timeout = 5000) {
  try {
    const start = Date.now();
    while (Date.now() - start < timeout) {
      try {
        const el = await page.$x(`//${tag}[contains(text(), '${text}')]`);
        if (el.length > 0) { await el[0].click(); return true; }
      } catch {}
      try {
        const el = await page.$x(`//*[contains(text(), '${text}')]`);
        if (el.length > 0) { await el[0].click(); return true; }
      } catch {}
      await sleep(300);
    }
  } catch {}
  return false;
}

function log(msg) { console.log(`  ${msg}`); }

// =====================================================
// FASE 1: INICIAR CHROME CON DEBUG
// =====================================================
async function ensureChromeDebug() {
  log('--- FASE 1: Iniciar Chrome con remote debugging ---');

  // Check if already running
  try {
    const resp = await fetch('http://127.0.0.1:9222/json/version');
    if (resp.ok) {
      const data = await resp.json();
      log(`Chrome ya activo en :9222 - ${data.Browser?.substring(0, 50) || 'versión desconocida'}`);
      return;
    }
  } catch {}

  log('Chrome no detectado en :9222. Iniciando...');
  
  fs.mkdirSync(CONFIG.userDataDir, { recursive: true });

  const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
  const args = [
    `--remote-debugging-port=9222`,
    `--user-data-dir="${CONFIG.userDataDir}"`,
    `--no-first-run`,
    `--no-default-browser-check`,
    `--new-window`,
    `https://developers.facebook.com/`,
  ];
  
  spawn(chromePath, args, { detached: true, stdio: 'ignore' });
  
  // Wait for Chrome to start
  for (let i = 0; i < 30; i++) {
    await sleep(2000);
    try {
      const resp = await fetch('http://127.0.0.1:9222/json/version');
      if (resp.ok) {
        log('Chrome listo en :9222');
        return;
      }
    } catch {}
    if (i % 5 === 0) log(`Esperando Chrome... (${(i+1)*2}s)`);
  }
  throw new Error('Chrome no inició después de 60s');
}

// =====================================================
// FASE 2: EXTRAER TOKEN
// =====================================================
async function connectBrowser() {
  browser = await puppeteer.connect({ browserURL: CONFIG.chromeUrl, defaultViewport: null });
  const pages = await browser.pages();
  page = pages[0] || await browser.newPage();
  log(`Página actual: ${await page.title()}`);
  return { browser, page };
}

async function extractToken() {
  log('\n--- FASE 2: Extraer token de Facebook ---');
  
  // Try the stored token first
  try {
    const saved = JSON.parse(fs.readFileSync(path.join(TOKENS_DIR, 'fb_tokens_output.json'), 'utf8'));
    const testToken = saved.accessToken || saved.pageAccessToken;
    if (testToken) {
      const res = await fetch(`${CONFIG.graphBase}/${CONFIG.apiVersion}/me?access_token=${testToken}&fields=id,name`);
      const data = await res.json();
      if (data.id) {
        token = testToken;
        log(`Token guardado VÁLIDO para: ${data.name}`);
        return token;
      } else {
        log(`Token expirado: ${data.error?.message || 'desconocido'}`);
      }
    }
  } catch {}

  // Navigate to Graph API Explorer
  log('Navegando a Graph API Explorer...');
  await page.goto('https://developers.facebook.com/tools/explorer/', {
    waitUntil: 'networkidle2', timeout: 30000
  }).catch(() => {});
  await sleep(5000);
  await ss('graph_explorer');

  // Try to find the token input field
  const tokenInput = await page.evaluate(() => {
    const inputs = document.querySelectorAll('input[type="text"], input:not([type="hidden"])');
    for (const inp of inputs) {
      const val = inp.value || '';
      if (val.startsWith('EA')) return { token: val, id: inp.id, placeholder: inp.placeholder };
    }
    return null;
  });

  if (tokenInput?.token) {
    token = tokenInput.token;
    log(`Token encontrado en input: ${token.substring(0, 40)}...`);
    return token;
  }

  // Check if we need to log in
  const pageText = await page.evaluate(() => document.body.innerText?.substring(0, 500) || '');
  const needsLogin = pageText.includes('Iniciar sesión') || pageText.includes('Log In');
  
  if (needsLogin) {
    log('⚠️ No hay sesión en Meta Developers. Necesitas loguearte.');
    log('Navegando a Facebook para iniciar sesión...');
    await page.goto('https://www.facebook.com/', { waitUntil: 'networkidle2', timeout: 30000 }).catch(() => {});
    await sleep(3000);
    await ss('facebook_login');
    
    log('\n🔴 INICIA SESIÓN EN LA VENTANA DE CHROME QUE SE ABRIÓ');
    log('   Después de loguearte, presiona ENTER aquí para continuar...');
    
    await new Promise(resolve => {
      process.stdin.once('data', () => resolve());
    });

    // Back to Explorer
    await page.goto('https://developers.facebook.com/tools/explorer/', {
      waitUntil: 'networkidle2', timeout: 30000
    }).catch(() => {});
    await sleep(5000);
    await ss('graph_explorer_after_login');
  }

  // Try to find token again
  const tokenAfter = await page.evaluate(() => {
    const inputs = document.querySelectorAll('input[type="text"], input:not([type="hidden"])');
    for (const inp of inputs) {
      if (inp.value?.startsWith('EA')) return inp.value;
    }
    const allText = document.body.innerText || '';
    const m = allText.match(/(EAAB[a-zA-Z0-9_-]+ZDZD|EAAB[a-zA-Z0-9_-]{80,})/);
    return m ? m[1] : '';
  });

  if (tokenAfter) {
    token = tokenAfter;
    log(`Token extraído: ${token.substring(0, 40)}...`);
    return token;
  }

  // Try to get token from any visible source
  const deepToken = await page.evaluate(() => {
    // Look in all inputs
    const allInputs = document.querySelectorAll('input');
    for (const inp of allInputs) {
      if (inp.value?.startsWith('EA')) return inp.value;
    }
    // Look in code blocks
    const codes = document.querySelectorAll('code, pre, .token-display, .x9f619, .x1n2onr6');
    for (const c of codes) {
      if (c.textContent?.startsWith('EA')) return c.textContent;
    }
    // Look in all elements
    const allEls = document.querySelectorAll('*');
    for (const el of allEls) {
      const t = el.textContent || '';
      const m = t.match(/(EAAB[a-zA-Z0-9_-]{100,})/);
      if (m) return m[1];
    }
    return '';
  });

  if (deepToken) {
    token = deepToken;
    log(`Token encontrado (búsqueda profunda): ${token.substring(0, 40)}...`);
    return token;
  }

  // Last resort: try to navigate to a simpler page for token
  log('Buscando token en la página de VentasPro...');
  await page.goto(`https://graph.facebook.com/v21.0/me/accounts?access_token=TOKEN_TEST&fields=name,id`, { timeout: 10000 }).catch(() => {});
  await sleep(2000);

  log('\n❌ No se pudo extraer token automáticamente.');
  log('Por favor:');
  log('1. Ve a https://developers.facebook.com/tools/explorer/');
  log('2. Selecciona la app, permisos y genera un token');
  log('3. Cópialo y pégalo aquí:');
  
  return new Promise(resolve => {
    process.stdin.once('data', (data) => {
      token = data.toString().trim();
      resolve(token);
    });
  });
}

// =====================================================
// FASE 3: VALIDAR Y GUARDAR TOKEN
// =====================================================
async function validateAndSaveToken(tokenStr) {
  log('\n--- FASE 3: Validar y guardar token ---');

  const res = await fetch(`${CONFIG.graphBase}/${CONFIG.apiVersion}/me?access_token=${tokenStr}&fields=name,id`);
  const me = await res.json();
  if (!me.id) {
    log(`❌ Token inválido: ${me.error?.message || 'desconocido'}`);
    return false;
  }
  log(`✅ Token válido para: ${me.name} (${me.id})`);

  // Get pages
  const pagesRes = await fetch(`${CONFIG.graphBase}/${CONFIG.apiVersion}/${me.id}/accounts?access_token=${tokenStr}&fields=name,id,access_token`);
  const pages = await pagesRes.json();
  let pageToken = tokenStr;
  let actualPageId = CONFIG.pageId;

  if (pages.data?.length > 0) {
    const p = pages.data[0];
    actualPageId = p.id;
    pageToken = p.access_token || tokenStr;
    log(`Página: ${p.name} (${p.id})`);
  }

  // Get ad accounts
  const adRes = await fetch(`${CONFIG.graphBase}/${CONFIG.apiVersion}/${me.id}/adaccounts?access_token=${tokenStr}&fields=id,name,account_id`);
  const ads = await adRes.json();
  let adAccount = CONFIG.adAccountId;
  if (ads.data?.length > 0) {
    adAccount = ads.data[0].account_id;
    log(`Ad Account: ${ads.data[0].name} (${adAccount})`);
  }

  // Save token
  const tokenData = {
    accessToken: tokenStr,
    pageAccessToken: pageToken,
    pageId: actualPageId,
    pageName: CONFIG.pageName,
    adAccountId: adAccount,
    bmId: CONFIG.bmId,
    validatedAt: new Date().toISOString(),
    userName: me.name,
    userId: me.id,
  };

  fs.writeFileSync(path.join(TOKENS_DIR, 'fb_tokens_output.json'), JSON.stringify(tokenData, null, 2));
  log('Token guardado en fb_tokens_output.json');

  // Also update the config .env
  const envPath = path.join(ROOT, 'config', '.env');
  let env = fs.readFileSync(envPath, 'utf8');
  const updates = {
    'FACEBOOK_ACCESS_TOKEN': tokenStr,
    'FACEBOOK_AD_ACCOUNT_ID': adAccount,
    'FACEBOOK_PAGE_ID': actualPageId,
  };
  for (const [k, v] of Object.entries(updates)) {
    const re = new RegExp(`${k}=.*`, '');
    if (env.match(re)) env = env.replace(re, `${k}=${v}`);
    else env += `\n${k}=${v}`;
  }
  fs.writeFileSync(envPath, env, 'utf8');
  log('Token actualizado en config/.env');

  // Also update Agent-Sales-Bot .env if exists
  const botEnvPath = 'C:\\Users\\ADMIN\\Videos\\Agent-Sales-Bot\\.env';
  if (fs.existsSync(botEnvPath)) {
    let botEnv = fs.readFileSync(botEnvPath, 'utf8');
    const botUpdates = {
      'FB_ACCESS_TOKEN': tokenStr,
      'FB_PAGE_ID': actualPageId,
      'FB_AD_ACCOUNT_ID': adAccount,
    };
    for (const [k, v] of Object.entries(botUpdates)) {
      const re = new RegExp(`${k}=.*`, '');
      if (botEnv.match(re)) botEnv = botEnv.replace(re, `${k}=${v}`);
      else botEnv += `\n${k}=${v}`;
    }
    fs.writeFileSync(botEnvPath, botEnv, 'utf8');
    log('✅ Token actualizado en Agent-Sales-Bot/.env');
  }

  return tokenData;
}

// =====================================================
// FASE 4: CREAR CAMPAÑAS VÍA API
// =====================================================
async function createCampaigns(tokenData) {
  log('\n--- FASE 4: Crear campañas en Facebook Ads ---');

  const ACCESS_TOKEN = tokenData.accessToken;
  const AD_ACCOUNT = tokenData.adAccountId;
  const PAGE_ID = tokenData.pageId;

  // Load catalog
  let catalog = [];
  try { catalog = JSON.parse(fs.readFileSync(path.join(TOKENS_DIR, 'megapack-82-productos.json'), 'utf8')); } catch {}
  if (catalog.length === 0) {
    try { catalog = JSON.parse(fs.readFileSync(path.join(TOKENS_DIR, 'catalogo-completo-importar.json'), 'utf8')); } catch {}
  }
  log(`Productos en catálogo: ${catalog.length}`);

  const categories = [
    { key: 'diseno',       name: 'Diseño Gráfico',     budget: 10000, emoji: '🎨' },
    { key: 'programacion', name: 'Programación',       budget: 10000, emoji: '💻' },
    { key: 'marketing',    name: 'Marketing',           budget: 8000,  emoji: '📈' },
    { key: 'idiomas',      name: 'Idiomas',             budget: 6000,  emoji: '🌎' },
    { key: 'ofimatica',    name: 'Ofimática',           budget: 5000,  emoji: '📊' },
    { key: 'ingenieria',   name: 'Ingeniería',          budget: 7000,  emoji: '🏗️' },
    { key: 'hacking',      name: 'Ciberseguridad',      budget: 5000,  emoji: '🛡️' },
    { key: 'bundle',       name: 'MegaPack Completo',   budget: 15000, emoji: '🚀' },
  ];

  let campaignsCreated = 0;
  let adsCreated = 0;
  const results = [];

  for (const cat of categories) {
    const campaignName = `[VENTAS] ${cat.emoji} ${cat.name} - 20K`;
    log(`\nCreando campaña: ${campaignName} ($${cat.budget}/día)`);

    try {
      // Create campaign
      const campRes = await fetch(`${CONFIG.graphBase}/${CONFIG.apiVersion}/act_${AD_ACCOUNT}/campaigns`, {
        method: 'POST',
        body: new URLSearchParams({
          name: campaignName,
          objective: 'OUTCOME_SALES',
          status: 'PAUSED',
          special_ad_categories: '[]',
          daily_budget: Math.round(cat.budget * 100),
          access_token: ACCESS_TOKEN,
        }),
      });
      const campaign = await campRes.json();

      if (!campaign.id) {
        log(`❌ Error campaña: ${JSON.stringify(campaign).substring(0, 100)}`);
        continue;
      }
      campaignsCreated++;
      log(`✅ Campaña: ${campaign.id}`);

      // Create ad set
      const adSetRes = await fetch(`${CONFIG.graphBase}/${CONFIG.apiVersion}/act_${AD_ACCOUNT}/adsets`, {
        method: 'POST',
        body: new URLSearchParams({
          name: `AdSet: ${cat.name}`,
          campaign_id: campaign.id,
          status: 'PAUSED',
          billing_event: 'IMPRESSIONS',
          optimization_goal: 'REACH',
          daily_budget: Math.round(cat.budget * 100),
          targeting: JSON.stringify({
            geo_locations: { countries: ['CO'] },
            ages: { min: 18, max: 65 },
            genders: [1, 2],
          }),
          start_time: new Date(Date.now() + 86400000).toISOString().split('.')[0] + '+0000',
          access_token: ACCESS_TOKEN,
        }),
      });
      const adSet = await adSetRes.json();

      if (!adSet.id) {
        log(`❌ Error adset: ${JSON.stringify(adSet).substring(0, 100)}`);
        continue;
      }
      log(`✅ AdSet: ${adSet.id}`);

      results.push({ campaignId: campaign.id, adSetId: adSet.id, category: cat.name });
    } catch (e) {
      log(`❌ Error: ${e.message}`);
    }
  }

  log(`\n✅ Campañas creadas: ${campaignsCreated}`);
  log(`   Estado: PAUSED (activar desde Ads Manager)`);

  // Save results
  fs.writeFileSync(path.join(TOKENS_DIR, 'campaigns-result.json'), JSON.stringify(results, null, 2));
  log(`Resultados guardados en campaigns-result.json`);
}

// =====================================================
// FASE 5: CONECTAR CON WHATSAPP BOT
// =====================================================
async function connectWithBot() {
  log('\n--- FASE 5: Conectar con el bot de WhatsApp ---');

  const botPath = 'C:\\Users\\ADMIN\\Videos\\Agent-Sales-Bot';
  if (!fs.existsSync(botPath)) {
    log('❌ Agent-Sales-Bot no encontrado');
    return;
  }

  // Check if .env has the right token
  const botEnvPath = path.join(botPath, '.env');
  if (fs.existsSync(botEnvPath)) {
    const botEnv = fs.readFileSync(botEnvPath, 'utf8');
    const hasFBToken = botEnv.includes('FB_ACCESS_TOKEN=');
    log(`Bot .env ${hasFBToken ? '✅ tiene FB_ACCESS_TOKEN' : '⚠️ sin FB_ACCESS_TOKEN'}`);
  }

  // Start the bot if not running
  try {
    execSync('tasklist /fi "WINDOWTITLE eq api-server*"', { timeout: 2000, encoding: 'utf8' });
    log('Bot api-server ya está corriendo ✅');
  } catch {
    log('Iniciando api-server del bot...');
    const startScript = path.join(botPath, 'start-dev.bat');
    if (fs.existsSync(startScript)) {
      spawn('cmd', ['/c', 'start', 'BOT-API', startScript], { detached: true, stdio: 'ignore' });
      log('Bot iniciado (puede tomar unos segundos)');
    } else {
      log('Script start-dev.bat no encontrado');
    }
  }

  log('\n✅ Conexión completada:');
  log('   - Facebook token actualizado en ambos proyectos');
  log('   - Campañas creadas (en pausa)');
  log('   - WhatsApp bot conectado (si estaba activo)');
}

// =====================================================
// MAIN
// =====================================================
async function main() {
  console.log('\n╔══════════════════════════════════════════════════════════╗');
  console.log('║   🚀 AUTOMATIZACIÓN COMPLETA FACEBOOK ADS + WHATSAPP    ║');
  console.log('╚══════════════════════════════════════════════════════════╝\n');

  try {
    // Fase 1: Chrome
    await ensureChromeDebug();

    // Fase 2: Connect browser
    await connectBrowser();

    // Fase 3: Extract token
    await extractToken();

    if (!token || token.length < 50) {
      log('❌ No se pudo obtener un token válido');
      return;
    }

    // Fase 4: Validate and save
    const tokenData = await validateAndSaveToken(token);
    if (!tokenData) return;

    // Fase 5: Create campaigns
    await createCampaigns(tokenData);

    // Fase 6: Connect with bot
    await connectWithBot();

    log('\n══════════════════════════════════════════════');
    log('  ✅ AUTOMATIZACIÓN COMPLETA');
    log('══════════════════════════════════════════════');
  } catch (e) {
    log(`\n❌ Error fatal: ${e.message}`);
    console.error(e);
  } finally {
    if (browser) await browser.disconnect().catch(() => {});
  }
}

main();
