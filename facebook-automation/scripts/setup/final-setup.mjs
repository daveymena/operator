import puppeteer from 'puppeteer';
import fs from 'fs';

const TOKEN_FILE = 'C:\\Users\\ADMIN\\Music\\fb_tokens_output.json';
const ENV_FILE = 'C:\\Users\\ADMIN\\Videos\\Agent-Sales-Bot\\.env';

async function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function main() {
  const tokenArg = process.argv[2];
  let accessToken = tokenArg;
  
  if (!accessToken) {
    // Try to read from saved file
    try {
      const saved = JSON.parse(fs.readFileSync(TOKEN_FILE, 'utf8'));
      if (saved.accessToken) accessToken = saved.accessToken;
    } catch {}
  }
  
  if (!accessToken) {
    console.log('❌ No token provided.');
    console.log('Usage: node final-setup.mjs EAAG...your_token_here');
    console.log('\nO pega el token aqui y presiona Enter:');
    process.stdin.once('data', (d) => {
      const t = d.toString().trim();
      if (t) mainWithToken(t);
      else console.log('No token provided');
    });
    return;
  }
  
  await mainWithToken(accessToken);
}

async function mainWithToken(token) {
  console.log('🧠 CONFIGURANDO FACEBOOK CON TOKEN...\n');
  
  // Validate token
  console.log('[1/5] Validando token...');
  const res = await fetch(`https://graph.facebook.com/v21.0/me?access_token=${token}&fields=name,id`);
  const json = await res.json();
  
  if (!json.id) {
    console.log('❌ Token invalido:', JSON.stringify(json));
    return;
  }
  
  console.log(`   ✅ Token valido! User: ${json.name || json.id}`);
  
  // Get page token
  console.log('\n[2/5] Obteniendo page access token...');
  const pagesRes = await fetch(`https://graph.facebook.com/v21.0/me/accounts?access_token=${token}&fields=name,id,access_token`);
  const pagesJson = await pagesRes.json();
  
  const result = {
    accessToken: token,
    pageAccessToken: '',
    pageId: '1278583508663384',
    pageName: '',
    adAccountId: '',
    bmId: '4482432028697067',
    pixelId: ''
  };
  
  if (pagesJson.data?.length > 0) {
    const page = pagesJson.data[0];
    result.pageId = page.id;
    result.pageName = page.name;
    result.pageAccessToken = page.access_token || token;
    console.log(`   Pagina: ${page.name} (${page.id})`);
    if (page.access_token) console.log(`   Page Token: OK (${page.access_token.substring(0, 30)}...)`);
  }
  
  // Get ad accounts
  console.log('\n[3/5] Obteniendo Ad Account...');
  try {
    const adRes = await fetch(`https://graph.facebook.com/v21.0/me/adaccounts?access_token=${token}&fields=id,name,account_id`);
    const adJson = await adRes.json();
    if (adJson.data?.length > 0) {
      result.adAccountId = adJson.data[0].account_id;
      console.log(`   Ad Account: ${adJson.data[0].name} (${adJson.data[0].account_id})`);
    } else {
      console.log('   ⚠️ No hay Ad Accounts asociados');
    }
  } catch(e) { console.log(`   ⚠️ Error: ${e.message}`); }
  
  // Save token file
  console.log('\n[4/5] Guardando tokens...');
  fs.writeFileSync(TOKEN_FILE, JSON.stringify(result, null, 2));
  console.log(`   ✅ Tokens guardados en ${TOKEN_FILE}`);
  
  // Update .env
  let env = fs.readFileSync(ENV_FILE, 'utf8');
  
  const updates = {
    'FB_ACCESS_TOKEN': result.accessToken,
    'FB_PAGE_ID': result.pageId,
    'FB_AD_ACCOUNT_ID': result.adAccountId,
    'FB_WEBHOOK_VERIFY_TOKEN': 'salesbot_verify_2024',
    'FB_MESSENGER_VERIFY_TOKEN': 'salesbot_messenger_2024',
    'FB_MESSENGER_PAGE_TOKEN': result.pageAccessToken || result.accessToken,
  };
  
  for (const [key, val] of Object.entries(updates)) {
    const regex = new RegExp(`${key}=.*`, '');
    if (env.match(regex)) {
      env = env.replace(regex, `${key}=${val}`);
    } else {
      env += `\n${key}=${val}`;
    }
  }
  
  fs.writeFileSync(ENV_FILE, env, 'utf8');
  console.log(`   ✅ .env actualizado con tokens de Facebook`);
  
  // Configure using Chrome
  console.log('\n[5/5] Conectando Chrome para verificar configuracion...');
  
  try {
    const browser = await puppeteer.connect({browserURL: 'http://127.0.0.1:9222', defaultViewport: null});
    let page = (await browser.pages()).find(p => p.url().includes('facebook'));
    if (page) {
      await page.goto('https://business.facebook.com/latest/settings/pages?business_id=4482432028697067', {timeout: 20000}).catch(() => {});
      await sleep(2000);
      console.log('   ✅ Chrome conectado - configuracion lista');
    }
    await browser.disconnect();
  } catch(e) {
    console.log(`   ⚠️ Chrome: ${e.message}`);
  }
  
  console.log('\n═══════════════════════════════════════════');
  console.log('  ✅ FACEBOOK CONFIGURADO EXITOSAMENTE');
  console.log('═══════════════════════════════════════════');
  console.log(`  Page: ${result.pageName}`);
  console.log(`  Page ID: ${result.pageId}`);
  console.log(`  Ad Account: ${result.adAccountId || 'No disponible'}`);
  console.log(`  Token: ${result.accessToken.substring(0, 30)}...`);
  console.log('');
  console.log('  Ahora abre http://localhost:3002');
  console.log('  Ve a pestaña Facebook → Canales');
  console.log('  Ahi veras todos los canales activos');
  console.log('═══════════════════════════════════════════\n');
}

main().catch(e => console.log('ERROR:', e.message));
