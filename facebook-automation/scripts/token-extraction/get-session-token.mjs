import puppeteer from 'puppeteer';
import fs from 'fs';

const browser = await puppeteer.connect({ browserURL: 'http://127.0.0.1:9222' });
const page = await browser.newPage();
page.setViewport({ width: 1400, height: 900 });

// Navigate to Business Manager where user has session
await page.goto('https://business.facebook.com/latest/home?business_id=4482432028697067', {
  waitUntil: 'networkidle0', timeout: 30000
});
await new Promise(r => setTimeout(r, 4000));

// Try multiple approaches to get a working token
console.log('=== METHOD 1: Extract from scripts ===');
const tokenFromScripts = await page.evaluate(() => {
  const scripts = Array.from(document.querySelectorAll('script'));
  for (const s of scripts) {
    const text = s.textContent || '';
    const patterns = [
      /access_token["': ]+([A-Za-z0-9_%\-]+)/,
      /"accessToken"["': ]+([A-Za-z0-9_%\-]+)/,
      /EAAB[A-Za-z0-9_%\-]+ZDZD/,
      /EAAB[A-Za-z0-9_%\-]+/
    ];
    for (const p of patterns) {
      const m = text.match(p);
      if (m) {
        const token = m[1] || m[0];
        if (token.startsWith('EA') && token.length > 50) return token;
      }
    }
  }
  return null;
});
console.log('Token from scripts:', tokenFromScripts ? tokenFromScripts.substring(0, 40) + '...' : 'none');

// Method 2: Use page fetch to call Graph API with session cookies
console.log('\n=== METHOD 2: Graph API via page fetch ===');
const apiResult = await page.evaluate(async () => {
  const results = [];
  // Try to get page access token via Facebook's internal API
  const endpoints = [
    'https://graph.facebook.com/v22.0/1278583508663384?fields=access_token&access_token=',
    'https://graph.facebook.com/v22.0/me/accounts?fields=name,id,access_token&access_token='
  ];
  for (const url of endpoints) {
    try {
      const r = await fetch(url, { credentials: 'include' });
      const text = await r.text();
      results.push({ url: url.substring(0, 60), status: r.status, body: text.substring(0, 200) });
    } catch(e) {
      results.push({ url: url.substring(0, 60), error: e.message });
    }
  }
  return results;
});
apiResult.forEach(r => console.log(`${r.status || 'ERR'}: ${r.body || r.error}`));

// Method 3: Use the actual page tokens
console.log('\n=== METHOD 3: Extract from Facebook DTSG / session info ===');
const fbState = await page.evaluate(() => {
  const data = {};
  try {
    const meta = document.querySelector('meta[name="facebook-user"]');
    if (meta) data.user = meta.content;
  } catch(e) {}
  try {
    // Check for FB session info in localStorage
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      const val = localStorage.getItem(key);
      if (val && val.length > 100 && (val.includes('EAAB') || val.includes('access_token'))) {
        const m = val.match(/EAAB[A-Za-z0-9_%\-]+/);
        if (m) data.lsToken = m[0].substring(0, 40);
      }
    }
  } catch(e) {}
  return data;
});
console.log('FB State:', JSON.stringify(fbState));

// Method 4: Try to use the sessionStorage from business.facebook
console.log('\n=== METHOD 4: Session-based API call ===');
const sessionResult = await page.evaluate(async () => {
  try {
    // Try making a request through the business.facebook.com domain
    const r = await fetch('https://business.facebook.com/api/graphql/?doc_id=6336467846421800&variables={}', {
      credentials: 'include',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
    });
    return { status: r.status, text: (await r.text()).substring(0, 300) };
  } catch(e) {
    return { error: e.message };
  }
});
console.log('Session API:', JSON.stringify(sessionResult, null, 2));

await browser.disconnect();
