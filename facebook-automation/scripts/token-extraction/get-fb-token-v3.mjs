import puppeteer from 'puppeteer';
import fs from 'fs';

async function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function main() {
  console.log('[FB] Conectando a Chrome...');
  const browser = await puppeteer.connect({ browserURL: 'http://127.0.0.1:9222', defaultViewport: null });
  let fbPage = (await browser.pages()).find(p => p.url().includes('facebook.com') || p.url().includes('business.facebook.com'));
  if (!fbPage) { fbPage = await browser.newPage(); }

  // Step 1: Go to Graph API Explorer to generate a fresh token
  console.log('\n[1/4] Abriendo Graph API Explorer...');
  await fbPage.goto('https://developers.facebook.com/tools/explorer/', { waitUntil: 'networkidle2', timeout: 30000 }).catch(() => {});
  await sleep(4000);
  
  // Check if we got a token from the explorer
  let token = await fbPage.evaluate(() => {
    const el = document.querySelector('[data-testid="access-token-display"] input, .access-token-display input, input[type="text"][value*="EA"]');
    return el ? el.value : '';
  });
  
  if (token && token.length > 30) {
    console.log(`[FB] Token encontrado en Graph Explorer: ${token.substring(0, 30)}...`);
  }
  
  // Step 2: Try to get token from a page access token page
  if (!token) {
    console.log('\n[2/4] Buscando token via Facebook Business...');
    
    // Go to a page that has the token in the DOM
    await fbPage.goto('https://business.facebook.com/latest/settings/pages?business_id=4482432028697067', { 
      waitUntil: 'networkidle2', timeout: 30000 
    }).catch(() => {});
    await sleep(4000);
    
    // Get all visible text looking for page ID or token
    const pageInfo = await fbPage.evaluate(() => {
      const body = document.body.innerText || '';
      const links = Array.from(document.querySelectorAll('a')).map(a => ({ href: a.href, text: a.textContent?.trim() })).filter(a => a.href && a.href.includes('facebook.com'));
      return { bodyLength: body.length, links: links.slice(0, 10) };
    });
    console.log(`[FB] Body length: ${pageInfo.bodyLength}`);
    pageInfo.links.forEach(l => console.log(`  Link: ${l.text} -> ${l.href.substring(0, 80)}`));
  }
  
  // Step 3: Fallback - try to get token from any open page that has it
  if (!token) {
    console.log('\n[3/4] Buscando en todas las pestanas...');
    const allPages = await browser.pages();
    for (const p of allPages) {
      try {
        const t = await p.evaluate(() => {
          const el = document.querySelector('input[value*="EA"], [data-testid="access-token-display"] input');
          return el ? el.value : '';
        });
        if (t && t.length > 40) { token = t; console.log(`[FB] Token encontrado en: ${await p.title()}`); break; }
      } catch {}
    }
  }
  
  // Step 4: If we have a user token, exchange for page token
  if (token) {
    console.log(`\n[4/4] Validando token y obteniendo page token...`);
    try {
      const res = await fetch(`https://graph.facebook.com/v21.0/me?access_token=${token}&fields=name,id`);
      const json = await res.json();
      
      if (json.id) {
        console.log(`[FB] Token valido para: ${json.name} (${json.id})`);
        
        // Get page access token
        const pagesRes = await fetch(`https://graph.facebook.com/v21.0/me/accounts?access_token=${token}&fields=name,id,access_token`);
        const pagesJson = await pagesRes.json();
        
        const result = {
          userToken: token,
          userId: json.id,
          userName: json.name || '',
          pageId: '1278583508663384',
          pageAccessToken: '',
          pageName: '',
          adAccountId: '',
          bmId: '4482432028697067',
          pixelId: ''
        };
        
        if (pagesJson.data && pagesJson.data.length > 0) {
          const page = pagesJson.data.find(p => p.id === '1278583508663384') || pagesJson.data[0];
          result.pageId = page.id;
          result.pageName = page.name;
          result.pageAccessToken = page.access_token || '';
          console.log(`[FB] Pagina: ${page.name} (${page.id})`);
          if (page.access_token) console.log(`[FB] Page Token: ${page.access_token.substring(0, 30)}...`);
        } else {
          console.log('[FB] No hay paginas asociadas');
        }
        
        // Get ad accounts
        const adRes = await fetch(`https://graph.facebook.com/v21.0/me/adaccounts?access_token=${token}&fields=id,name,account_id`);
        const adJson = await adRes.json();
        if (adJson.data && adJson.data.length > 0) {
          result.adAccountId = adJson.data[0].account_id;
          console.log(`[FB] Ad Account: ${adJson.data[0].name} (${adJson.data[0].account_id})`);
        }
        
        fs.writeFileSync('C:\\Users\\ADMIN\\Music\\fb_tokens_output.json', JSON.stringify(result, null, 2));
        console.log('\n✅ TOKENS GUARDADOS!');
      } else {
        console.log(`[FB] Token invalido: ${JSON.stringify(json)}`);
      }
    } catch(e) {
      console.log(`[FB] Error: ${e.message}`);
    }
  } else {
    console.log('\n[FB] No se pudo extraer token automaticamente.');
    console.log('👉 Ve a https://developers.facebook.com/tools/explorer/');
    console.log('👉 Selecciona la app y permisos: pages_read_engagement, pages_manage_metadata, ads_management, business_management');
    console.log('👉 Genera token y pasamelo');
  }
  
  await browser.disconnect();
}

main().catch(e => console.log('ERROR:', e.message));
