import puppeteer from 'puppeteer';
import fs from 'fs';

async function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function main() {
  console.log('[FB] Conectando a Chrome y configurando Facebook...');
  const browser = await puppeteer.connect({ browserURL: 'http://127.0.0.1:9222', defaultViewport: null });
  let page = (await browser.pages()).find(p => p.url().includes('facebook'));
  if (!page) page = await browser.newPage();
  
  // Navigate to Business Manager System Users to get an access token
  console.log('\n[1/3] Yendo a System Users - Business Manager...');
  await page.goto(
    'https://business.facebook.com/latest/settings/system_users?business_id=4482432028697067',
    { waitUntil: 'networkidle2', timeout: 30000 }
  ).catch(() => {});
  await sleep(4000);
  
  // Take screenshot
  await page.screenshot({ path: 'C:\\Users\\ADMIN\\Music\\fb-system-users.png' });
  console.log('Screenshot saved: fb-system-users.png');
  
  const pageInfo = await page.evaluate(() => ({
    url: window.location.href,
    title: document.title,
    hasLoginBtn: document.body.innerText.includes('Iniciar sesión') || document.body.innerText.includes('Log In'),
    hasSystemUsers: document.body.innerText.includes('System Users') || document.body.innerText.includes('Usuarios del sistema'),
  }));
  console.log(`URL: ${pageInfo.url}`);
  console.log(`Title: ${pageInfo.title}`);
  console.log(`Login needed: ${pageInfo.hasLoginBtn}`);
  console.log(`System Users page: ${pageInfo.hasSystemUsers}`);
  
  // If we got to the page, try to get the access token
  if (!pageInfo.hasLoginBtn && pageInfo.hasSystemUsers) {
    console.log('\n[2/3] En System Users. Intentando generar token...');
    
    // Look for existing token or click to create new
    const tokenInfo = await page.evaluate(() => {
      const result = { token: '', pageId: '1278583508663384', adAccountId: '', bmId: '4482432028697067' };
      document.querySelectorAll('script').forEach(s => {
        const t = s.textContent || '';
        const m = t.match(/["']access_token["']\s*:\s*["'](EAAB?[A-Za-z0-9%._\-\/=,]+)["']/);
        if (m && m[1].length > 80) result.token = m[1];
        const m2 = t.match(/act_(\d+)/);
        if (m2) result.adAccountId = m2[1];
      });
      return result;
    });
    
    if (tokenInfo.token) {
      console.log(`Token found: ${tokenInfo.token.substring(0, 40)}...`);
      await validateAndSave(browser, tokenInfo.token, tokenInfo);
      return;
    }
  }
  
  // Last resort: navigate to regular Facebook to get the page access token
  console.log('\n[3/3] Intentando obtener token via Graph API directamente...');
  
  // Try to access page access token from the page's settings
  await page.goto(
    `https://www.facebook.com/settings/?tab=pages&ref=settings`,
    { waitUntil: 'networkidle2', timeout: 30000 }
  ).catch(() => {});
  await sleep(4000);
  
  await page.screenshot({ path: 'C:\\Users\\ADMIN\\Music\\fb-page-settings.png' });
  
  const finalData = { token: '', pageId: '1278583508663384', pageAccessToken: '', pageName: '', adAccountId: '', bmId: '4482432028697067', pixelId: '' };
  
  const saved = await page.evaluate((pid) => {
    document.querySelectorAll('script').forEach(s => {
      const t = s.textContent || '';
      const m = t.match(/["']access_token["']\s*:\s*["'](EAAB?[A-Za-z0-9%._\-\/=,]+)["']/);
      if (m && m[1].length > 80) return m[1];
    });
    return '';
  }, '1278583508663384');
  
  if (saved) finalData.pageAccessToken = saved;
  
  console.log('\n=== RESUMEN ===');
  console.log(JSON.stringify(finalData, null, 2));
  
  fs.writeFileSync('C:\\Users\\ADMIN\\Music\\fb_tokens_output.json', JSON.stringify(finalData, null, 2));
  console.log('\nSaved to fb_tokens_output.json');
  
  if (!finalData.pageAccessToken && !finalData.token) {
    console.log('\n⚠️ No se pudo generar el token automaticamente.');
    console.log('Para generar el token manualmente:');
    console.log('1. Ve a https://business.facebook.com/latest/settings/system_users?business_id=4482432028697067');
    console.log('2. Crea un System User o usa uno existente');
    console.log('3. Genera un access token con permisos: pages_read_engagement, pages_manage_metadata, business_management, ads_management');
    console.log('4. Copia el token y ponlo en el .env como FB_ACCESS_TOKEN');
  }
  
  await browser.disconnect();
}

async function validateAndSave(browser, token, info) {
  console.log('\n✅ Validando token...');
  try {
    const res = await fetch(`https://graph.facebook.com/v21.0/me?access_token=${token}&fields=name,id`);
    const json = await res.json();
    if (json.id) {
      console.log(`Token valido para: ${json.name || json.id}`);
      
      const result = { ...info, token, userName: json.name || '' };
      
      const pages = await fetch(`https://graph.facebook.com/v21.0/me/accounts?access_token=${token}&fields=name,id,access_token`);
      const pJson = await pages.json();
      if (pJson.data?.length) {
        const p = pJson.data.find(x => x.id === '1278583508663384') || pJson.data[0];
        result.pageId = p.id;
        result.pageName = p.name;
        result.pageAccessToken = p.access_token || '';
      }
      
      const ad = await fetch(`https://graph.facebook.com/v21.0/me/adaccounts?access_token=${token}&fields=id,name,account_id`);
      const aJson = await ad.json();
      if (aJson.data?.length) result.adAccountId = aJson.data[0].account_id;
      
      fs.writeFileSync('C:\\Users\\ADMIN\\Music\\fb_tokens_output.json', JSON.stringify(result, null, 2));
      console.log('\n✅ TOKENS GUARDADOS Y VALIDADOS!');
      console.log(JSON.stringify(result, null, 2));
    } else {
      console.log(`Token invalido: ${JSON.stringify(json)}`);
    }
  } catch(e) { console.log(`Error: ${e.message}`); }
  await browser.disconnect();
}

main().catch(e => { console.log('ERROR:', e.message); process.exit(1); });
