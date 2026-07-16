import fs from 'fs';
import path from 'path';
import { execSync, spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { setTimeout as sleep } from 'timers/promises';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const CTX_FILE = path.join(__dirname, 'context.json');
const TOKEN_FILE = path.join(__dirname, 'facebook-automation', 'tokens', 'fb_tokens_output.json');
const CATALOGO_FILE = path.join(__dirname, 'facebook-automation', 'tokens', 'catalogo-completo-importar.json');
const DOCS_DIR = path.join(__dirname, 'docs');

const context = loadContext();

function loadContext() {
  try { return JSON.parse(fs.readFileSync(CTX_FILE, 'utf8')); }
  catch { return { initialized: false, sessions: [] }; }
}

function saveContext() {
  context.lastUsed = new Date().toISOString();
  fs.writeFileSync(CTX_FILE, JSON.stringify(context, null, 2));
}

function getTokens() {
  try { return JSON.parse(fs.readFileSync(TOKEN_FILE, 'utf8')); }
  catch { return null; }
}

function getCatalogo() {
  try { return JSON.parse(fs.readFileSync(CATALOGO_FILE, 'utf8')); }
  catch { return []; }
}

function logSession(action, result) {
  context.sessions.push({
    timestamp: new Date().toISOString(),
    action,
    result: typeof result === 'object' ? { ...result, _truncated: true } : result
  });
  if (context.sessions.length > 100) context.sessions = context.sessions.slice(-100);
  saveContext();
}

async function validateToken() {
  const tokens = getTokens();
  if (!tokens) return { ok: false, error: 'No hay token guardado' };
  try {
    const res = await fetch(`https://graph.facebook.com/v21.0/me?access_token=${tokens.accessToken}&fields=name,id`);
    const data = await res.json();
    if (data.id) return { ok: true, user: data.name || data.id, tokens };
    return { ok: false, error: data.error?.message || 'Token inválido' };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

async function ensureBridge() {
  const bridgeScript = path.join(__dirname, 'iniciar-bridge-independiente.bat');
  try {
    execSync('tasklist /fi "WINDOWTITLE eq BRIDGE*"', { timeout: 3000, encoding: 'utf8' });
    return { running: true };
  } catch {
    console.log('  🌀 Bridge no detectado, iniciando...');
    spawn('cmd', ['/c', 'start', 'BRIDGE', bridgeScript], { detached: true, stdio: 'ignore' });
    await sleep(3000);
    return { running: false, started: true };
  }
}

async function createFacebookCampaigns() {
  console.log('\n🚀 INICIANDO CREACIÓN DE CAMPAÑAS FACEBOOK...\n');

  const tokenVal = await validateToken();
  if (!tokenVal.ok) {
    console.log(`  ❌ ${tokenVal.error}`);
    logSession('facebook-campaigns', { status: 'error', error: tokenVal.error });
    return;
  }

  console.log(`  ✅ Token válido: ${tokenVal.user}`);
  console.log(`  📦 Catálogo: ${getCatalogo().length} productos`);

  const scriptPath = path.join(__dirname, 'facebook-automation', 'scripts', 'ads', 'crear-campanias-catalogo.mjs');
  try {
    execSync(`node "${scriptPath}"`, { stdio: 'inherit', timeout: 120000, cwd: __dirname });
    logSession('facebook-campaigns', { status: 'success', user: tokenVal.user });
  } catch (e) {
    console.log(`  ❌ Error: ${e.message}`);
    logSession('facebook-campaigns', { status: 'error', error: e.message });
  }
}

function showStatus() {
  console.log('\n╔════════════════════════════════════════════════════╗');
  console.log('║        🧠 SISTEMA - CONSCIENTE Y LISTO           ║');
  console.log('╚════════════════════════════════════════════════════╝\n');
  const ctx = loadContext();
  console.log(`  📅 Último uso: ${ctx.lastUsed || 'Nunca'}`);
  console.log(`  📊 Sesiones registradas: ${ctx.sessions.length}`);
  const tokens = getTokens();
  console.log(`  🔑 Facebook Token: ${tokens ? tokens.accessToken.substring(0, 25) + '... ✅' : '❌ No hay'}`);
  const catalogo = getCatalogo();
  console.log(`  📦 Catálogo productos: ${catalogo.length} SKUs`);
  console.log(`  🏢 Business Manager: 4482432028697067`);
  console.log(`  📄 Página: VentasPro - Cursos Digitales`);
  console.log(`  💰 Ad Account: 1545022093928422`);
  try {
    execSync('tasklist /fi "WINDOWTITLE eq BRIDGE*"', { timeout: 2000, encoding: 'utf8' });
    console.log(`  🌉 Bridge: Activo ✅`);
  } catch { console.log(`  🌉 Bridge: Inactivo ❌`); }
  console.log(`\n  📚 Documentación disponible:`);
  fs.readdirSync(DOCS_DIR).forEach(f => console.log(`     - docs/${f}`));
  console.log(`\n  ⚡ Capacidades:`);
  console.log(`     ✅ facebook ads   → Crear campañas desde el catálogo`);
  console.log(`     ✅ operator       → Sistema autónomo tipo ChatGPT Operator`);
  console.log(`     ✅ status         → Ver estado del sistema`);
  console.log(`     ✅ bridge         → Iniciar puente Hermes-OpenCode`);
}

async function main() {
  const command = process.argv[2] || 'status';

  if (!context.initialized) {
    context.initialized = true;
    context.created = new Date().toISOString();
    context.version = '1.0';
    saveContext();
  }

  switch (command.toLowerCase()) {
    case 'status':
    case 'estado':
      showStatus();
      break;

    case 'facebook':
    case 'ads':
    case 'campañas':
    case 'campaigns':
      await createFacebookCampaigns();
      break;

    case 'bridge':
      await ensureBridge();
      break;

    case 'operator':
    case 'auto':
      console.log(`\n  Delegando a operator.mjs...\n`);
      const opArgs = process.argv.slice(3).join(' ') || 'analiza el sistema y dime qué ves';
      const docsFlag = process.argv.includes('--docs') ? `--docs="${path.join(__dirname, 'docs')}"` : '';
      execSync(`node "${path.join(__dirname, 'operator.mjs')}" ${docsFlag} "${opArgs}"`, { stdio: 'inherit', timeout: 300000 });
      break;

    case 'full':
      await ensureBridge();
      await createFacebookCampaigns();
      break;

    default:
      console.log(`\n  Comando no reconocido: "${command}"`);
      console.log(`  Usa: node master.mjs [comando]`);
      console.log(`  Comandos: status, facebook, ads, campañas, bridge, full\n`);
  }
}

main().catch(e => console.log('ERROR:', e.message));
