import puppeteer from 'puppeteer';
import fs from 'fs';

async function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function main() {
  console.log('[FB] Conectando...');
  const browser = await puppeteer.connect({ browserURL: 'http://127.0.0.1:9222', defaultViewport: null });
  let page = (await browser.pages()).find(p => p.url().includes('facebook'));
  if (!page) page = await browser.newPage();
  
  // Navigate to Graph API Explorer with specific app
  console.log('[1] Graph API Explorer...');
  await page.goto('https://developers.facebook.com/tools/explorer/', { timeout: 20000 }).catch(() => {});
  await sleep(3000);
  
  // Try clicking the "Get Token" button or look for existing token
  const token = await page.evaluate(() => {
    const inputs = document.querySelectorAll('input[type="text"], input[type="password"]');
    for (const input of inputs) {
      const val = input.value || '';
      if (val.startsWith('EA')) return val;
    }
    const pre = document.querySelector('code, pre');
    if (pre && pre.textContent?.startsWith('EA')) return pre.textContent;
    return '';
  });
  
  if (token) {
    console.log(`Token: ${token.substring(0, 40)}...`);
    await validateAndSave(browser, token);
    return;
  }
  
  // Try to navigate to business page settings to get page token
  console.log('[2] Page Settings...');
  await page.goto(`https://www.facebook.com/settings/?tab=pages`, { timeout: 20000 }).catch(() => {});
  await sleep(3000);
  
  const pageToken = await page.evaluate(() => {
    const body = document.body.innerText || '';
    const m = body.match(/(EAAB?[A-Za-z0-9%._\-\/=,]{80,})/);
    return m ? m[1] : '';
  });
  
  if (pageToken) {
    console.log(`Page Token: ${pageToken.substring(0, 40)}...`);
    await validateAndSave(browser, pageToken);
    return;
  }
  
  // Fallback: extract from current page scripts
  console.log('[3] Extracting from page scripts...');
  const scriptTokens = await page.evaluate(() => {
    const tokens = new Set();
    document.querySelectorAll('script').forEach(s => {
      const t = s.textContent || '';
      const matches = t.matchAll(/["']access_token["']\s*:\s*["'](EAAB?[A-Za-z0-9%._\-\/=,]+)["']/g);
      for (const m of matches) if (m[1].length > 80) tokens.add(m[1]);
    });
    return [...tokens];
  });
  
  if (scriptTokens.length > 0) {
    console.log(`Script tokens: ${scriptTokens.length}`);
    const t = scriptTokens[0];
    console.log(`Token: ${t.substring(0, 40)}...`);
    await validateAndSave(browser, scriptTokens[0]);
    return;
  }
  
  console.log('\n❌ No se pudo extraer token automaticamente.');
  console.log('👉 Abre https://developers.facebook.com/tools/explorer/');
  console.log('👉 Selecciona tu app');
  console.log('👉 Permisos: pages_read_engagement, pages_manage_metadata, ads_management');
  console.log('👉 Genera token y pasamelo');
  
  await browser.disconnect();
}

async function validateAndSave(browser, token) {
  try {
    const me = await fetch(`https://graph.facebook.com/v21.0/me?access_token=${token}&fields=name,id`);
    const meJson = await me.json();
    
    if (meJson.id) {
      console.log(`\n✅ Token VALIDO! User: ${meJson.name || meJson.id}`);
      
      const result = { userToken: token, userId: meJson.id, userName: meJson.name || '', pageId: '1278583508663384', pageAccessToken: '', pageName: '', adAccountId: '', bmId: '4482432028697067', pixelId: '' };
      
      const pages = await fetch(`https://graph.facebook.com/v21.0/me/accounts?access_token=${token}&fields=name,id,access_token`);
      const pagesJson = await pages.json();
      if (pagesJson.data?.length) {
        const p = pagesJson.data.find(x => x.id === '1278583508663384') || pagesJson.data[0];
        result.pageId = p.id; result.pageName = p.name; result.pageAccessToken = p.access_token || '';
        console.log(`Pagina: ${p.name}`);
      }
      
      const ad = await fetch(`https://graph.facebook.com/v21.0/me/adaccounts?access_token=${token}&fields=id,name,account_id`);
      const adJson = await ad.json();
      if (adJson.data?.length) { result.adAccountId = adJson.data[0].account_id; console.log(`Ad Account: ${adJson.data[0].name}`); }
      
      const bus = await fetch(`https://graph.facebook.com/v21.0/me/businesses?access_token=${token}&fields=id,name`);
      const busJson = await bus.json();
      if (busJson.data?.length) { result.bmId = busJson.data[0].id; console.log(`Business: ${busJson.data[0].name}`); }
      
      fs.writeFileSync('C:\\Users\\ADMIN\\Music\\fb_tokens_output.json', JSON.stringify(result, null, 2));
      console.log('\n✅ Tokens guardados en fb_tokens_output.json!');
      console.log(JSON.stringify(result, null, 2));
    } else {
      console.log(`Token invalido: ${JSON.stringify(meJson)}`);
    }
  } catch(e) { console.log(`Error: ${e.message}`); }
  await browser.disconnect();
}

main().catch(e => console.log('ERROR:', e.message));
