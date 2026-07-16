import puppeteer from 'puppeteer';
import fs from 'fs';

const S_DIR = 'C:\\Users\\ADMIN\\Music\\screenshots';
fs.mkdirSync(S_DIR, { recursive: true });

let step = 0;
async function ss(page, name) {
  step++;
  const path = `${S_DIR}\\${step}_${name}.png`;
  await page.screenshot({ path, fullPage: false });
  console.log(`  📸 ${step}. ${name}.png`);
}

async function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function clickByText(page, text, tag = 'span') {
  try {
    const el = await page.$x(`//${tag}[contains(text(), '${text}')]`);
    if (el.length > 0) { await el[0].click(); return true; }
  } catch {}
  try {
    const el = await page.$x(`//*[contains(text(), '${text}')]`);
    if (el.length > 0) { await el[0].click(); return true; }
  } catch {}
  return false;
}

async function waitForText(page, text, timeout = 10000) {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    const found = await page.evaluate((t) => document.body.innerText.includes(t), text);
    if (found) return true;
    await sleep(500);
  }
  return false;
}

async function main() {
  console.log('🧠 ENTRENANDO AGENTE - MODO VISION TOTAL\n');
  console.log('Conectando a Chrome...');
  
  const browser = await puppeteer.connect({ browserURL: 'http://127.0.0.1:9222', defaultViewport: null });
  const fbPage = (await browser.pages()).find(p => p.url().includes('facebook'));
  const page = fbPage || await browser.newPage();
  
  // Step 1: Go to Business Manager Pages
  console.log('\n🖱️ [FASE 1] Navegando Business Manager...');
  await page.goto('https://business.facebook.com/latest/settings/pages?business_id=4482432028697067', { 
    waitUntil: 'networkidle2', timeout: 30000 
  }).catch(() => console.log('  ⚠️ Timeout'));
  await sleep(4000);
  await ss(page, 'business_pages');
  
  // Step 2: Look for the page and click it
  console.log('\n🖱️ [FASE 2] Buscando pagina VentasPro...');
  const pagesList = await page.evaluate(() => {
    const links = Array.from(document.querySelectorAll('a'));
    return links.filter(l => l.href).map(l => ({ text: l.textContent?.trim()?.substring(0, 80), href: l.href?.substring(0, 120) }));
  });
  
  const ventasLink = pagesList.find(l => l.text?.includes('VentasPro') || l.href?.includes('1278583508663384'));
  if (ventasLink) {
    console.log(`  Encontrado: ${ventasLink.text}`);
    await page.goto(ventasLink.href, { waitUntil: 'networkidle2', timeout: 30000 }).catch(() => {});
    await sleep(4000);
    await ss(page, 'ventaspro_page');
  } else {
    console.log('  No encontrado en lista, yendo directo...');
    await page.goto('https://www.facebook.com/1278583508663384', { waitUntil: 'networkidle2', timeout: 20000 }).catch(() => {});
    await sleep(3000);
    await ss(page, 'ventaspro_direct');
  }
  
  // Step 3: Try to access settings/advanced messaging for page token
  console.log('\n🖱️ [FASE 3] Buscando Page Access Token...');
  
  // Method A: Try the advanced messaging settings URL
  await page.goto('https://www.facebook.com/1278583508663384/settings/?tab=advanced_messaging', { 
    timeout: 20000 
  }).catch(() => {});
  await sleep(3000);
  await ss(page, 'advanced_messaging');
  
  const hasTokenField = await page.evaluate(() => 
    document.body.innerText.includes('access_token') || 
    document.body.innerText.includes('Access Token') ||
    document.body.innerText.includes('token de acceso')
  );
  console.log(`  Token field visible: ${hasTokenField}`);
  
  // If we see the token field, extract it
  if (hasTokenField) {
    const tokenVal = await page.evaluate(() => {
      const inputs = document.querySelectorAll('input[type="text"], input[type="password"]');
      for (const inp of inputs) {
        const val = inp.value || '';
        if (val.startsWith('EA')) return val;
      }
      return '';
    });
    if (tokenVal) {
      console.log(`\n🎉 TOKEN ENCONTRADO! ${tokenVal.substring(0, 50)}...`);
      await saveToken(browser, tokenVal);
      return;
    }
  }
  
  // Method B: Look for token in any visible element
  console.log('\n🖱️ [FASE 4] Busqueda ampliada de token...');
  
  const tokenSearch = await page.evaluate(() => {
    const result = { found: false, token: '', sources: [] };
    const allElements = document.querySelectorAll('*');
    for (const el of allElements) {
      const text = el.textContent || '';
      const m = text.match(/(EAAB?[A-Za-z0-9%._\/\-=,]{80,})/);
      if (m) {
        result.found = true;
        result.token = m[1];
        result.sources.push(el.tagName + ': ' + text.substring(0, 100));
      }
    }
    return result;
  });
  
  if (tokenSearch.found) {
    console.log(`  🎉 Token en DOM: ${tokenSearch.token.substring(0, 50)}...`);
    await saveToken(browser, tokenSearch.token);
    return;
  }
  
  // Method C: Navigate to the Graph API Explorer
  console.log('\n🖱️ [FASE 5] Intentando Graph API Explorer...');
  await page.goto('https://developers.facebook.com/tools/explorer/', { timeout: 20000 }).catch(() => {});
  await sleep(5000);
  await ss(page, 'graph_explorer');
  
  const onExplorer = await page.evaluate(() => ({
    url: window.location.href,
    loggedIn: !document.body.innerText.includes('Iniciar sesión') && !document.body.innerText.includes('Log In'),
    title: document.title,
    text: document.body.innerText?.substring(0, 200)
  }));
  console.log(`  URL: ${onExplorer.url}`);
  console.log(`  Logged in: ${onExplorer.loggedIn}`);
  
  if (onExplorer.loggedIn && onExplorer.url.includes('/tools/explorer')) {
    console.log('  ✅ En Graph API Explorer! Buscando token...');
    
    // Try to get the token from the explorer page
    const explorerToken = await page.evaluate(() => {
      const inputs = document.querySelectorAll('input');
      for (const inp of inputs) {
        if (inp.value?.startsWith('EA')) return inp.value;
      }
      const codeBlocks = document.querySelectorAll('code, pre, .token-display');
      for (const code of codeBlocks) {
        if (code.textContent?.startsWith('EA')) return code.textContent;
      }
      return '';
    });
    
    if (explorerToken) {
      console.log(`  🎉 Token del Explorer: ${explorerToken.substring(0, 50)}...`);
      await saveToken(browser, explorerToken);
      return;
    }
  }
  
  // Method D: Try business.facebook.com API
  console.log('\n🖱️ [FASE 6] Business Manager API...');
  await page.goto('https://business.facebook.com/latest/settings/pages?business_id=4482432028697067', { timeout: 20000 }).catch(() => {});
  await sleep(3000);
  
  // Click on the page name to go to page settings
  const clicked = await clickByText(page, 'VentasPro');
  console.log(`  Click VentasPro: ${clicked}`);
  await sleep(3000);
  await ss(page, 'after_click_ventas');
  
  // Method E: Get token from any page element
  console.log('\n🖱️ [FASE 7] Busqueda profunda en DOM...');
  const deepSearch = await page.evaluate(() => {
    const result = { tokens: [], scripts: 0, lsa: 0 };
    
    // Check all script tags
    document.querySelectorAll('script').forEach(s => {
      result.scripts++;
      const t = s.textContent || '';
      const matches = t.matchAll(/EAAB?[A-Za-z0-9%._\/\-=,]{80,}/g);
      for (const m of matches) result.tokens.push(m[0]);
    });
    
    // Check localStorage
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k) {
          const v = localStorage.getItem(k);
          if (v && v.startsWith('EA')) result.tokens.push(v);
        }
      }
    } catch {}
    result.lsa = localStorage.length;
    
    return result;
  });
  
  console.log(`  Scripts: ${deepSearch.scripts}, LocalStorage items: ${deepSearch.lsa}`);
  console.log(`  Tokens found: ${deepSearch.tokens.length}`);
  
  if (deepSearch.tokens.length > 0) {
    // Find the longest token (most likely the valid one)
    const bestToken = deepSearch.tokens.sort((a, b) => b.length - a.length)[0];
    console.log(`  Best token: ${bestToken.substring(0, 50)}... (len: ${bestToken.length})`);
    
    // Validate
    try {
      const valRes = await fetch(`https://graph.facebook.com/v21.0/me?access_token=${bestToken}&fields=name,id`);
      const valJson = await valRes.json();
      if (valJson.id) {
        console.log(`  ✅ Token VALIDO para: ${valJson.name}`);
        await saveToken(browser, bestToken);
        return;
      } else {
        console.log(`  ❌ Token invalido: ${valJson.error?.message || 'unknown'}`);
      }
    } catch {}
  }
  
  // Final: Navigate to the Meta for Developers Apps page
  console.log('\n🖱️ [FASE 8] Intentando Apps de Meta Developers...');
  await page.goto('https://developers.facebook.com/apps/', { timeout: 20000 }).catch(() => {});
  await sleep(4000);
  await ss(page, 'meta_apps');
  
  const appsStatus = await page.evaluate(() => ({
    url: window.location.href,
    title: document.title,
    loggedIn: !document.body.innerText.includes('Iniciar sesión'),
    hasApps: document.body.innerText.includes('Apps') || document.body.innerText.includes('My Apps'),
    text: document.body.innerText?.substring(0, 300)
  }));
  console.log(`  URL: ${appsStatus.url}`);
  console.log(`  Logged in: ${appsStatus.loggedIn}`);
  console.log(`  Has apps: ${appsStatus.hasApps}`);
  
  if (!appsStatus.loggedIn) {
    console.log('\n⚠️ No estas logeado en Meta Developers.');
    console.log('Voy a intentar loguearte con tu cuenta de Facebook...');
    
    // Click login
    const loginClicked = await clickByText(page, 'Iniciar sesión') || await clickByText(page, 'Log In');
    console.log(`  Login clicked: ${loginClicked}`);
    if (loginClicked) {
      await sleep(4000);
      await ss(page, 'after_login');
      
      // Check if already logged in via Facebook
      const afterLogin = await page.evaluate(() => window.location.href);
      console.log(`  URL after login: ${afterLogin}`);
    }
  }
  
  if (appsStatus.hasApps && appsStatus.loggedIn) {
    console.log('\n  Hay apps. Buscando Graph API Explorer...');
    await page.goto('https://developers.facebook.com/tools/explorer/', { timeout: 20000 }).catch(() => {});
    await sleep(4000);
    await ss(page, 'explorer_final');
    
    const finalToken = await page.evaluate(() => {
      const inputs = document.querySelectorAll('input');
      for (const inp of inputs) {
        if (inp.value?.startsWith('EA')) return inp.value;
      }
      const allText = document.body.innerText || '';
      const m = allText.match(/(EAAB?[A-Za-z0-9%._\/\-=,]{80,})/);
      return m ? m[1] : '';
    });
    
    if (finalToken) {
      console.log(`  🎉 Token: ${finalToken.substring(0, 50)}...`);
      await saveToken(browser, finalToken);
      return;
    }
  }
  
  console.log('\n⚠️ No se pudo obtener token automaticamente.');
  console.log('\nCapturas guardadas en: ' + S_DIR);
  console.log('Revisa las imagenes para ver donde estamos.');
  console.log('\nPara continuar manualmente:');
  console.log('1. Abre https://developers.facebook.com/tools/explorer/');
  console.log('2. Inicia sesion si te pide');
  console.log('3. Selecciona "VentasPro - Cursos Digitales"');
  console.log('4. Permisos: pages_read_engagement, pages_manage_metadata, ads_management, pages_messaging');
  console.log('5. Genera token y pasamelo');
  console.log('\nO ejecuta: node final-setup.mjs TU_TOKEN_AQUI');
  
  await browser.disconnect();
}

async function saveToken(browser, token) {
  console.log('\n💾 Configurando todo con el token...');
  
  const result = {
    accessToken: token,
    pageId: '1278583508663384',
    pageAccessToken: token,
    pageName: 'VentasPro - Cursos Digitales',
    adAccountId: '',
    bmId: '4482432028697067',
    pixelId: ''
  };
  
  // Validate and get page info
  try {
    const meRes = await fetch(`https://graph.facebook.com/v21.0/me?access_token=${token}&fields=name,id`);
    const meJson = await meRes.json();
    if (meJson.id) {
      console.log(`  User: ${meJson.name || meJson.id}`);
      
      const pagesRes = await fetch(`https://graph.facebook.com/v21.0/me/accounts?access_token=${token}&fields=name,id,access_token`);
      const pJson = await pagesRes.json();
      if (pJson.data?.length > 0) {
        const p = pJson.data[0];
        result.pageId = p.id;
        result.pageName = p.name;
        result.pageAccessToken = p.access_token || token;
        console.log(`  Page: ${p.name}`);
      }
      
      const adRes = await fetch(`https://graph.facebook.com/v21.0/me/adaccounts?access_token=${token}&fields=id,name,account_id`);
      const aJson = await adRes.json();
      if (aJson.data?.length > 0) {
        result.adAccountId = aJson.data[0].account_id;
        console.log(`  Ad Account: ${aJson.data[0].name} (${aJson.data[0].account_id})`);
      }
    } else {
      console.log(`  Token no es de usuario, intentando como page token...`);
      result.pageAccessToken = token;
    }
  } catch(e) { console.log(`  Error: ${e.message}`); }
  
  // Save
  fs.writeFileSync('C:\\Users\\ADMIN\\Music\\fb_tokens_output.json', JSON.stringify(result, null, 2));
  console.log('  ✅ Tokens guardados');
  
  // Update .env
  const envPath = 'C:\\Users\\ADMIN\\Videos\\Agent-Sales-Bot\\.env';
  let env = fs.readFileSync(envPath, 'utf8');
  
  const upd = {
    'FB_ACCESS_TOKEN': result.accessToken,
    'FB_PAGE_ID': result.pageId,
    'FB_AD_ACCOUNT_ID': result.adAccountId,
    'FB_WEBHOOK_VERIFY_TOKEN': 'salesbot_verify_2024',
    'FB_MESSENGER_VERIFY_TOKEN': 'salesbot_messenger_2024',
    'FB_MESSENGER_PAGE_TOKEN': result.pageAccessToken || result.accessToken,
  };
  
  for (const [k, v] of Object.entries(upd)) {
    const re = new RegExp(`${k}=.*`, '');
    if (env.match(re)) env = env.replace(re, `${k}=${v}`);
    else env += `\n${k}=${v}`;
  }
  
  fs.writeFileSync(envPath, env, 'utf8');
  console.log('  ✅ .env actualizado');
  
  console.log('\n═══════════════════════════════════════════');
  console.log('  ✅ FACEBOOK CONFIGURADO!');
  console.log('═══════════════════════════════════════════');
  console.log(`  Page: ${result.pageName}`);
  console.log(`  Ad Account: ${result.adAccountId || 'No disponible'}`);
  console.log(`  Token: ${token.substring(0, 30)}...`);
  console.log('═══════════════════════════════════════════\n');
  
  await browser.disconnect();
}

main().catch(e => console.log('ERROR:', e.message));
