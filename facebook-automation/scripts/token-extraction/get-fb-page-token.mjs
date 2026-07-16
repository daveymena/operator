import puppeteer from 'puppeteer';
import fs from 'fs';

async function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function main() {
  console.log('[FB] Conectando a Chrome...');
  const browser = await puppeteer.connect({ browserURL: 'http://127.0.0.1:9222', defaultViewport: null });
  const pages = await browser.pages();
  let fbPage = pages.find(p => p.url().includes('facebook.com'));
  
  if (!fbPage) {
    fbPage = await browser.newPage();
    console.log('[FB] Abriendo Facebook...');
    await fbPage.goto('https://www.facebook.com/', { waitUntil: 'networkidle2', timeout: 30000 });
    await sleep(3000);
  }
  
  console.log(`[FB] URL: ${fbPage.url().substring(0, 80)}`);
  
  // Check if logged in
  const isLoggedIn = !fbPage.url().includes('login');
  if (!isLoggedIn) {
    console.log('[FB] No has iniciado sesion. Hazlo manualmente.');
    console.log('[FB] Esperando login...');
    for (let i = 0; i < 30; i++) {
      await sleep(2000);
      if (!fbPage.url().includes('login')) { console.log('[FB] Login detectado!'); break; }
    }
  }
  
  // Go to Graph API Explorer to generate a proper token
  console.log('\n[FB] Abriendo Graph API Explorer...');
  await fbPage.goto('https://developers.facebook.com/tools/explorer/', { waitUntil: 'networkidle2', timeout: 30000 }).catch(() => {});
  await sleep(4000);
  
  // Try to get existing tokens first
  console.log('[FB] Revisando tokens existentes...');
  await fbPage.goto('https://developers.facebook.com/tools/accesstoken/', { waitUntil: 'networkidle2', timeout: 30000 }).catch(() => {});
  await sleep(4000);
  
  const tokens = await fbPage.evaluate(() => {
    const result = [];
    document.querySelectorAll('table tr, [role="row"]').forEach(row => {
      const text = row.textContent || '';
      const m = text.match(/(EAA[A-Za-z0-9%._\-\/=,]{50,})/);
      if (m) {
        const cells = row.querySelectorAll('td, [role="cell"]');
        result.push({
          token: m[1],
          name: cells.length > 1 ? (cells[1].textContent || '').trim() : 'Unknown'
        });
      }
    });
    return result;
  });
  
  if (tokens.length > 0) {
    console.log(`\n[FB] Tokens encontrados: ${tokens.length}`);
    tokens.forEach((t, i) => console.log(`  ${i+1}. ${t.name}: ${t.token.substring(0, 30)}...`));
    
    // Save the first token
    const data = { token: tokens[0].token, tokenName: tokens[0].name, bmId: '', adAccountId: '', pageId: '1278583508663384', pixelId: '' };
    
    // Validate with Graph API
    try {
      const res = await fetch(`https://graph.facebook.com/v21.0/me?access_token=${data.token}&fields=name,id`);
      const json = await res.json();
      if (json.id) {
        console.log(`\n[FB] Token VALIDO! Usuario: ${json.name} (ID: ${json.id})`);
        
        // Get pages
        const pagesRes = await fetch(`https://graph.facebook.com/v21.0/me/accounts?access_token=${data.token}&fields=name,id,access_token`);
        const pagesJson = await pagesRes.json();
        if (pagesJson.data && pagesJson.data.length > 0) {
          console.log(`\n[FB] Paginas encontradas: ${pagesJson.data.length}`);
          pagesJson.data.forEach(p => {
            console.log(`  - ${p.name} (ID: ${p.id})`);
            data.pageId = p.id;
            if (p.access_token) {
              data.pageAccessToken = p.access_token;
              console.log(`    Token: ${p.access_token.substring(0, 30)}...`);
            }
          });
        }
        
        // Get ad accounts
        const adRes = await fetch(`https://graph.facebook.com/v21.0/me/adaccounts?access_token=${data.token}&fields=id,name,account_id,currency`);
        const adJson = await adRes.json();
        if (adJson.data && adJson.data.length > 0) {
          data.adAccountId = adJson.data[0].account_id;
          console.log(`\n[FB] Ad Account: ${adJson.data[0].name} (${adJson.data[0].account_id})`);
        }
        
        // Get business
        const busRes = await fetch(`https://graph.facebook.com/v21.0/me/businesses?access_token=${data.token}&fields=id,name`);
        const busJson = await busRes.json();
        if (busJson.data && busJson.data.length > 0) {
          data.bmId = busJson.data[0].id;
          console.log(`[FB] Business: ${busJson.data[0].name} (${busJson.data[0].id})`);
        }
      } else {
        console.log(`[FB] Token invalido: ${JSON.stringify(json)}`);
      }
    } catch(e) {
      console.log(`[FB] Error validando: ${e.message}`);
    }
    
    fs.writeFileSync('C:\\Users\\ADMIN\\Music\\fb_tokens_output.json', JSON.stringify(data, null, 2));
    console.log(`\n[FB] Datos guardados en fb_tokens_output.json`);
  } else {
    console.log('[FB] No se encontraron tokens en la pagina');
    console.log('[FB] Necesitas generar un token manualmente:');
    console.log('  1. Ve a https://developers.facebook.com/tools/explorer/');
    console.log('  2. Selecciona tu app y permisos');
    console.log('  3. Genera un token con permisos de pagina y ads');
  }
  
  await browser.disconnect();
  console.log('\n[FB] Listo!');
}

main().catch(e => console.log('ERROR:', e.message));
