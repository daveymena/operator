import puppeteer from 'puppeteer';
import fs from 'fs';

const browser = await puppeteer.connect({ browserURL: 'http://127.0.0.1:9222' });
const page = await browser.newPage();
page.setViewport({ width: 1400, height: 900 });

// Capture ALL network responses
const allResponses = [];
page.on('response', async r => {
  const url = r.url();
  if (url.includes('graph') || url.includes('api') || url.includes('token') || url.includes('access')) {
    try {
      const text = await r.text();
      allResponses.push({ url: url.substring(0, 150), status: r.status(), type: r.headers()['content-type'] || '', body: text.substring(0, 300) });
    } catch {}
  }
});

// Go to the Ads Manager page
await page.goto('https://adsmanager.facebook.com/adsmanager/manage/campaigns?act=1545022093928422', {
  waitUntil: 'networkidle0', timeout: 30000
});
await new Promise(r => setTimeout(r, 6000));

console.log(`Captured ${allResponses.length} responses`);

// Look for tokens
let bestToken = null;
for (const res of allResponses) {
  // Check URL for token
  const urlToken = res.url.match(/access.token.?=([a-fA-F0-9]+|EAAB[a-zA-Z0-9_%-]+)/);
  if (urlToken) {
    console.log(`\nToken in URL: ${urlToken[1].substring(0, 40)}...`);
    bestToken = urlToken[1];
  }
  
  // Check body for token
  const bodyToken = res.body.match(/EAAB[a-zA-Z0-9_%-]+/);
  if (bodyToken) {
    console.log(`\nToken in body: ${bodyToken[0].substring(0, 40)}...`);
    bestToken = bodyToken[0];
  }
  
  if (res.body && res.body.length > 10 && !res.body.startsWith('<!')) {
    console.log(`\n[${res.status}] ${res.url.substring(0, 100)}`);
    console.log(`  Type: ${res.type}`);
    console.log(`  Body: ${res.body.substring(0, 200)}`);
  }
}

// If we found a token, validate it
if (bestToken && bestToken.startsWith('EA') && bestToken.length > 50) {
  console.log(`\n\nTrying token: ${bestToken.substring(0, 40)}...`);
  const r = await fetch(`https://graph.facebook.com/v22.0/me?access_token=${bestToken}&fields=id,name`);
  const d = await r.json();
  if (d.id) {
    console.log(`TOKEN VALID! User: ${d.name}`);
    const result = {
      accessToken: bestToken,
      pageId: '1278583508663384',
      pageName: 'VentasPro',
      adAccountId: '1545022093928422',
      bmId: '4482432028697067'
    };
    fs.writeFileSync('C:\\Users\\ADMIN\\Music\\proyecto-unificado\\facebook-automation\\tokens\\fb_tokens_output.json', JSON.stringify(result, null, 2));
    console.log('SAVED!');
  } else {
    console.log(`Token invalid: ${JSON.stringify(d)}`);
  }
}

if (allResponses.length === 0) {
  console.log('No responses captured. Checking page...');
  const info = await page.evaluate(() => ({
    url: location.href,
    title: document.title,
    hasScripts: document.querySelectorAll('script').length
  }));
  console.log(JSON.stringify(info));
}

await browser.disconnect();
