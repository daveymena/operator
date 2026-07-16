import puppeteer from 'puppeteer';
import fs from 'fs';

const browser = await puppeteer.connect({ browserURL: 'http://127.0.0.1:9222' });
const page = await browser.newPage();
page.setViewport({ width: 1400, height: 900 });

// Listen for ALL Graph API responses
const apiCalls = [];
page.on('response', async response => {
  const url = response.url();
  if (url.includes('graph.facebook.com') || url.includes('graph-fallback')) {
    try {
      const text = await response.text();
      apiCalls.push({ url: url.substring(0, 120), status: response.status(), body: text.substring(0, 200) });
    } catch {}
  }
});

// Navigate to a Facebook page that makes Graph API calls
await page.goto('https://www.facebook.com/ads/library/?active_status=all&ad_type=all&country=CO&sort_data=no&search_type=keyword_unordered&q=cursos', {
  waitUntil: 'networkidle0', timeout: 30000
});
await new Promise(r => setTimeout(r, 4000));

// Also try going to Business Manager
await page.goto('https://business.facebook.com/latest/home?business_id=4482432028697067', {
  waitUntil: 'networkidle0', timeout: 30000
});
await new Promise(r => setTimeout(r, 5000));

console.log(`Captured ${apiCalls.length} API responses`);
apiCalls.forEach(c => {
  console.log(`\n${c.status} ${c.url}`);
  console.log(`  Body: ${c.body}`);
  
  // Try to extract token from URL or body
  const urlMatch = c.url.match(/access_token=(EAAB[a-zA-Z0-9_%-]+)/);
  const bodyMatch = c.body.match(/"access_token"\s*:\s*"(EAAB[a-zA-Z0-9_%-]+)"/);
  if (urlMatch) console.log(`  TOKEN IN URL: ${urlMatch[1].substring(0, 40)}...`);
  if (bodyMatch) console.log(`  TOKEN IN BODY: ${bodyMatch[1].substring(0, 40)}...`);
});

// If found a token, validate and save
for (const c of apiCalls) {
  const urlMatch = c.url.match(/access_token=(EAAB[a-zA-Z0-9_%-]+)/);
  const bodyMatch = c.body.match(/"access_token"\s*:\s*"(EAAB[a-zA-Z0-9_%-]+)"/);
  const token = (urlMatch?.[1] || bodyMatch?.[1]);
  
  if (token && token.length > 80) {
    console.log(`\n\nValidating token: ${token.substring(0, 40)}...`);
    const r = await fetch(`https://graph.facebook.com/v22.0/me?access_token=${token}&fields=id,name`);
    const d = await r.json();
    if (d.id) {
      console.log(`VALID! User: ${d.name}`);
      
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
      console.log('SAVED!');
      break;
    }
  }
}

if (apiCalls.length === 0) {
  console.log('No API calls captured. Trying direct approach...');
  // Use the page to call the API directly
  const result = await page.evaluate(async () => {
    try {
      const r = await fetch('https://graph.facebook.com/v22.0/1278583508663384?fields=id,name,access_token', {
        credentials: 'include',
        headers: { 'Authorization': '' }
      });
      return await r.text();
    } catch(e) { return 'Error: ' + e.message; }
  });
  console.log('Direct call result:', result.substring(0, 200));
}

await browser.disconnect();
