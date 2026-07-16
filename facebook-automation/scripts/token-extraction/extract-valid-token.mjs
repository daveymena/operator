import puppeteer from 'puppeteer';
import fs from 'fs';

const browser = await puppeteer.connect({ browserURL: 'http://127.0.0.1:9222' });
const page = await browser.newPage();
page.setViewport({ width: 1400, height: 900 });

// Capture responses from adsmanager-graph
const foundTokens = new Set();
page.on('response', async r => {
  const url = r.url();
  const match = url.match(/access_token=(EAAB[a-zA-Z0-9_%-]+)/);
  if (match && match[1].length > 80) {
    foundTokens.add(match[1]);
  }
});

// Reload the ads manager
await page.goto('https://adsmanager.facebook.com/adsmanager/manage/campaigns?act=1545022093928422', {
  waitUntil: 'networkidle0', timeout: 30000
});
await new Promise(r => setTimeout(r, 6000));

console.log(`Found ${foundTokens.size} unique tokens\n`);

for (const token of foundTokens) {
  console.log(`Trying: ${token.substring(0, 40)}...`);
  
  // Try regular Graph API
  const r1 = await fetch(`https://graph.facebook.com/v22.0/me?access_token=${token}&fields=id,name`);
  const d1 = await r1.json();
  if (d1.id) {
    console.log(`  VALID! User: ${d1.name}`);
    
    // Get page token
    const pages = await fetch(`https://graph.facebook.com/v22.0/me/accounts?access_token=${token}&fields=id,name,access_token`);
    const pJson = await pages.json();
    const ventas = pJson.data?.find(p => p.id === '1278583508663384');
    
    const result = {
      accessToken: token,
      pageId: '1278583508663384',
      pageName: 'VentasPro',
      pageAccessToken: ventas?.access_token || token,
      adAccountId: '1545022093928422',
      bmId: '4482432028697067'
    };
    
    fs.writeFileSync('C:\\Users\\ADMIN\\Music\\proyecto-unificado\\facebook-automation\\tokens\\fb_tokens_output.json', JSON.stringify(result, null, 2));
    console.log('  TOKEN SAVED!\n');
    break;
  }
  
  // Try with me/adaccounts
  const r2 = await fetch(`https://graph.facebook.com/v22.0/me/adaccounts?access_token=${token}&fields=id,name,account_id`);
  const d2 = await r2.json();
  if (d2.data) {
    console.log(`  Has ad accounts!`);
  }
  
  console.log(`  Status: ${d1.error?.message || d2.error?.message || 'checking...'}`);
}

await browser.disconnect();
