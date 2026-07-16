import puppeteer from 'puppeteer';
import fs from 'fs';

const browser = await puppeteer.connect({ browserURL: 'http://127.0.0.1:9222' });
const page = await browser.newPage();
page.setViewport({ width: 1400, height: 900 });

// Intercept network requests
const tokens = [];
await page.setRequestInterception(true);
page.on('request', request => {
  const url = request.url();
  // Look for Graph API calls with access tokens
  if (url.includes('graph.facebook.com') && url.includes('access_token=')) {
    const match = url.match(/access_token=(EAAB[a-zA-Z0-9_%-]+)/);
    if (match && match[1].length > 80) {
      if (!tokens.includes(match[1])) {
        tokens.push(match[1]);
      }
    }
  }
  request.continue();
});

// Navigate to Business Manager
await page.goto('https://business.facebook.com/latest/settings/system_users?business_id=4482432028697067', {
  waitUntil: 'networkidle0', timeout: 30000
});
await new Promise(r => setTimeout(r, 5000));

console.log(`Found ${tokens.length} unique tokens`);

// Validate each token
for (const token of tokens) {
  console.log(`\nToken: ${token.substring(0, 40)}...`);
  try {
    const r = await fetch(`https://graph.facebook.com/v22.0/me?access_token=${token}&fields=id,name`);
    const d = await r.json();
    if (d.id) {
      console.log(`  VALID! User: ${d.name} (${d.id})`);
      
      // Get more info
      const pages = await fetch(`https://graph.facebook.com/v22.0/me/accounts?access_token=${token}&fields=id,name,access_token`);
      const pJson = await pages.json();
      const ventas = pJson.data?.find(p => p.id === '1278583508663384');
      if (ventas) {
        console.log(`  Page: ${ventas.name}`);
        if (ventas.access_token) {
          console.log(`  Page Token: ${ventas.access_token.substring(0, 30)}...`);
        }
      }
      
      // Save token
      const result = { accessToken: token, pageId: '1278583508663384', pageName: 'VentasPro', adAccountId: '1545022093928422', bmId: '4482432028697067' };
      
      if (ventas?.access_token) {
        result.pageAccessToken = ventas.access_token;
      }
      
      fs.writeFileSync('C:\\Users\\ADMIN\\Music\\proyecto-unificado\\facebook-automation\\tokens\\fb_tokens_output.json', JSON.stringify(result, null, 2));
      console.log('\n✅ TOKEN SAVED!');
      break;
    } else {
      console.log(`  Invalid: ${d.error?.message || 'unknown'}`);
    }
  } catch(e) {
    console.log(`  Error: ${e.message}`);
  }
}

if (tokens.length === 0) {
  console.log('No tokens found via network interception.');
  console.log('Checking cookies and page content...');
  
  const cookies = await page.cookies('https://www.facebook.com');
  const sessionCookies = cookies.filter(c => ['c_user', 'xs', 'fr', 'sb', 'datr'].includes(c.name));
  sessionCookies.forEach(c => console.log(`Cookie ${c.name}: ${c.value.substring(0, 20)}...`));
}

await browser.disconnect();
