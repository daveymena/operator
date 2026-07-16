import puppeteer from 'puppeteer';
import fs from 'fs';

async function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function main() {
  console.log('[FB] Conectando a Chrome...');
  const browser = await puppeteer.connect({ browserURL: 'http://127.0.0.1:9222', defaultViewport: null });
  const pages = await browser.pages();
  const fbPage = pages.find(p => p.url().includes('facebook.com'));
  
  if (!fbPage) {
    console.log('[FB] ERROR: No hay pagina de Facebook abierta en Chrome');
    await browser.disconnect();
    return;
  }
  
  console.log(`[FB] Pagina: "${await fbPage.title()}"`);
  console.log(`[FB] URL: ${fbPage.url().substring(0,80)}`);
  
  // Navigate to Business Settings
  console.log('\n[FB] Navegando a Business Settings...');
  await fbPage.goto('https://business.facebook.com/settings/', { waitUntil: 'networkidle2', timeout: 30000 }).catch(() => {});
  await sleep(3000);
  
  // Extract data from page scripts
  const data = await fbPage.evaluate(() => {
    const r = { token: '', bmId: '', adAccountId: '', pageId: '', pixelId: '', pageName: '' };
    document.querySelectorAll('script').forEach(s => {
      const t = s.textContent || '';
      let m;
      if ((m = t.match(/EAA[A-Za-z0-9%._\-\/=,]+/)) && m[0].length > 30) {
        if (!r.token || m[0].length > r.token.length) r.token = m[0];
      }
      if ((m = t.match(/act_(\d+)/))) r.adAccountId = r.adAccountId || m[1];
      if ((m = t.match(/"page(?:ID|_id)"\s*:\s*"(\d+)"/))) r.pageId = r.pageId || m[1];
      if ((m = t.match(/"pixel(?:Id|_id)"\s*:\s*"(\d+)"/))) r.pixelId = r.pixelId || m[1];
    });
    const bmInput = document.querySelector('input[name="business_id"]');
    if (bmInput) r.bmId = bmInput.value;
    r.pageName = document.title;
    return r;
  });
  
  console.log('\n=== DATOS ENCONTRADOS ===');
  console.log(`Page Name: ${data.pageName}`);
  console.log(`BM ID: ${data.bmId}`);
  console.log(`Page ID: ${data.pageId}`);
  console.log(`Ad Account: ${data.adAccountId}`);
  console.log(`Pixel: ${data.pixelId}`);
  console.log(`Token: ${data.token ? data.token.substring(0, 40) + '...' : 'NO ENCONTRADO'}`);
  
  // If no token, try to get from Graph API page
  if (!data.token) {
    console.log('\n[FB] Token no encontrado. Intentando Facebook Developers...');
    await fbPage.goto('https://developers.facebook.com/tools/accesstoken/', { waitUntil: 'networkidle2', timeout: 30000 }).catch(() => {});
    await sleep(3000);
    
    const tokenData = await fbPage.evaluate(() => {
      const r = { token: '' };
      document.querySelectorAll('table tr, [data-testid]').forEach(row => {
        const txt = row.textContent || '';
        const m = txt.match(/(EAA[A-Za-z0-9%._\-\/=,]+)/);
        if (m && m[0].length > 40) r.token = m[0];
      });
      return r;
    });
    
    if (tokenData.token) data.token = tokenData.token;
  }
  
  // Save results
  fs.writeFileSync('C:\\Users\\ADMIN\\Music\\fb_tokens_output.json', JSON.stringify(data, null, 2));
  
  // Validate token
  if (data.token) {
    try {
      const res = await fetch(`https://graph.facebook.com/v21.0/me?access_token=${data.token}&fields=name,id,accounts`);
      const json = await res.json();
      console.log(`\n[FB] Token valido! Conectado como: ${json.name || json.id}`);
      
      data.pageName = json.name || data.pageName;
      
      if (json.accounts && json.accounts.data) {
        const page = json.accounts.data[0];
        if (page) {
          data.pageId = data.pageId || page.id;
          console.log(`[FB] Pagina encontrada: ${page.name} (ID: ${page.id})`);
          
          // Get page access token
          const pageRes = await fetch(`https://graph.facebook.com/v21.0/${page.id}?access_token=${data.token}&fields=access_token,name`);
          const pageJson = await pageRes.json();
          if (pageJson.access_token) {
            data.pageAccessToken = pageJson.access_token;
            console.log(`[FB] Page Access Token obtenido!`);
          }
        }
      }
      
      fs.writeFileSync('C:\\Users\\ADMIN\\Music\\fb_tokens_output.json', JSON.stringify(data, null, 2));
    } catch(e) {
      console.log(`[FB] Error validando token: ${e.message}`);
    }
    
    console.log('\n=== TOKENS GUARDADOS EN fb_tokens_output.json ===');
  }
  
  // Get Ad Accounts
  if (data.token) {
    console.log('\n[FB] Buscando Ad Accounts...');
    try {
      const adRes = await fetch(`https://graph.facebook.com/v21.0/me/adaccounts?access_token=${data.token}&fields=id,name,account_id,currency`);
      const adJson = await adRes.json();
      if (adJson.data && adJson.data.length > 0) {
        const acct = adJson.data[0];
        data.adAccountId = data.adAccountId || acct.account_id;
        console.log(`[FB] Ad Account: ${acct.name} (${acct.account_id})`);
      }
    } catch(e) { console.log(`[FB] Error buscando ad accounts: ${e.message}`); }
    
    fs.writeFileSync('C:\\Users\\ADMIN\\Music\\fb_tokens_output.json', JSON.stringify(data, null, 2));
  }
  
  console.log('\n[FB] Listo!');
  await browser.disconnect();
}

main().catch(e => console.log('ERROR:', e.message));
