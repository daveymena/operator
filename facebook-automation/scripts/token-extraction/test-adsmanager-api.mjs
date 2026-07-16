import puppeteer from 'puppeteer';
import fs from 'fs';

const browser = await puppeteer.connect({ browserURL: 'http://127.0.0.1:9222' });
const page = await browser.newPage();
page.setViewport({ width: 1400, height: 900 });

// Capture a fresh token
let pageToken = null;
page.on('response', async r => {
  const url = r.url();
  if (url.includes('adsmanager-graph.facebook.com') && url.includes('access_token=')) {
    const match = url.match(/access_token=(EAAB[a-zA-Z0-9_%-]+)/);
    if (match && match[1].length > 80 && !pageToken) {
      pageToken = match[1];
    }
  }
});

await page.goto('https://adsmanager.facebook.com/adsmanager/manage/campaigns?act=1545022093928422', {
  waitUntil: 'networkidle0', timeout: 30000
});
await new Promise(r => setTimeout(r, 5000));

if (pageToken) {
  console.log(`Token: ${pageToken.substring(0, 40)}...`);
  
  // Try to use the token with the adsmanager endpoint directly
  const result = await page.evaluate(async (token) => {
    try {
      const r = await fetch(`https://adsmanager-graph.facebook.com/v22.0/act_1545022093928422/campaigns?access_token=${token}&fields=id,name,status,objective`);
      const d = await r.json();
      return d;
    } catch(e) {
      return { error: e.message };
    }
  }, pageToken);
  
  console.log('Campaigns:', JSON.stringify(result, null, 2).substring(0, 300));
  
  // Now try to create a campaign via adsmanager-graph
  if (result.data !== undefined) {
    console.log('\nToken works with adsmanager-graph!');
    
    // Try to create an ad through the page's fetch
    const createResult = await page.evaluate(async (token) => {
      const catalog = [
        { name: 'Test Campaña Diseño', objective: 'OUTCOME_TRAFFIC', status: 'PAUSED', daily_budget: 5000 }
      ];
      
      for (const camp of catalog) {
        try {
          const r = await fetch(`https://adsmanager-graph.facebook.com/v22.0/act_1545022093928422/campaigns?access_token=${token}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              name: camp.name,
              objective: camp.objective,
              status: camp.status,
              daily_budget: camp.daily_budget,
              special_ad_categories: [],
              buying_type: 'AUCTION'
            })
          });
          const d = await r.json();
          return d;
        } catch(e) {
          return { error: e.message };
        }
      }
    }, pageToken);
    
    console.log('Create result:', JSON.stringify(createResult, null, 2).substring(0, 500));
  }
} else {
  console.log('No token found');
}

await browser.disconnect();
