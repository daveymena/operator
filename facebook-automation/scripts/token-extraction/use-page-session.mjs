import puppeteer from 'puppeteer';
import fs from 'fs';

const ROOT = 'C:\\Users\\ADMIN\\Music\\proyecto-unificado\\facebook-automation';
const browser = await puppeteer.connect({ browserURL: 'http://127.0.0.1:9222' });
const page = await browser.newPage();
page.setViewport({ width: 1400, height: 900 });

// Go to adsmanager page
await page.goto('https://adsmanager.facebook.com/adsmanager/manage/campaigns?act=1545022093928422', {
  waitUntil: 'networkidle0', timeout: 30000
});
await new Promise(r => setTimeout(r, 5000));

// Use the page's internal ADS manager API to create campaigns
// The adsmanager-graph.facebook.com endpoint accepts calls from the page context
const result = await page.evaluate(async () => {
  const results = [];
  
  // First, get the current user's access token from the page
  // Use the embeddable Graph API via the page's session
  const endpoints = [
    // Try the adsmanager graph endpoint (works from page context)
    { url: 'https://adsmanager-graph.facebook.com/v22.0/me?fields=id,name', name: 'me' },
    { url: 'https://adsmanager-graph.facebook.com/v22.0/me/accounts?fields=id,name&limit=5', name: 'accounts' },
  ];
  
  for (const ep of endpoints) {
    try {
      const r = await fetch(ep.url, { credentials: 'include' });
      results.push({ name: ep.name, status: r.status, data: await r.json() });
    } catch(e) {
      results.push({ name: ep.name, error: e.message });
    }
  }
  
  return results;
});

console.log(JSON.stringify(result, null, 2).substring(0, 2000));

// Try to create a campaign using the page's access
if (result.some(r => r.data?.id)) {
  console.log('\n✅ Page session works!');
  
  // Now try creating a campaign via adsmanager-graph
  const createResult = await page.evaluate(async () => {
    try {
      const r = await fetch('https://adsmanager-graph.facebook.com/v22.0/act_1545022093928422/campaigns', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'Test desde agente - Borrador',
          objective: 'OUTCOME_TRAFFIC',
          status: 'PAUSED',
          daily_budget: 5000,
          special_ad_categories: [],
          buying_type: 'AUCTION'
        })
      });
      return { status: r.status, data: await r.json() };
    } catch(e) {
      return { error: e.message };
    }
  });
  console.log('Create campaign:', JSON.stringify(createResult, null, 2).substring(0, 500));
}

await browser.disconnect();
