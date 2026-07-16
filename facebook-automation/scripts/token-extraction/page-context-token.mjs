import puppeteer from 'puppeteer';
import fs from 'fs';

const ROOT = 'C:\\Users\\ADMIN\\Music\\proyecto-unificado\\facebook-automation';
const CATALOG_PATH = ROOT + '\\tokens\\megapack-82-productos.json';
const IMAGE_DIR = ROOT + '\\assets\\images';

const browser = await puppeteer.connect({ browserURL: 'http://127.0.0.1:9222' });
const page = await browser.newPage();
page.setViewport({ width: 1400, height: 900 });

// Go to Ads Manager (must be logged in)
await page.goto('https://adsmanager.facebook.com/adsmanager/manage/campaigns?act=1545022093928422', {
  waitUntil: 'networkidle0', timeout: 30000
});
await new Promise(r => setTimeout(r, 5000));

// Get page access token from within the page context
const tokenInfo = await page.evaluate(async () => {
  const data = {};
  
  // Try to extract the access token from the page's state
  // Method 1: Look for it in the FB SDK
  try {
    // Make a Graph API call from the page context (where cookies are available)
    const r = await fetch('https://graph.facebook.com/v22.0/me/accounts?fields=id,name,access_token&limit=10', {
      credentials: 'include'
    });
    const d = await r.json();
    data.accounts = d;
  } catch(e) {
    data.error1 = e.message;
  }
  
  // Method 2: Try without credentials but with the page's token
  try {
    const r = await fetch('https://adsmanager-graph.facebook.com/v22.0/act_1545022093928422?fields=id,name&access_token=', {
      credentials: 'include'
    });
    const d = await r.json();
    data.adAccount = d;
  } catch(e) {
    data.error2 = e.message;
  }
  
  return data;
});

console.log('Token info:', JSON.stringify(tokenInfo, null, 2).substring(0, 1000));

if (tokenInfo.accounts?.data?.length > 0) {
  const ventasPage = tokenInfo.accounts.data.find(p => p.id === '1278583508663384');
  if (ventasPage) {
    console.log(`\n✅ Page found: ${ventasPage.name}`);
    if (ventasPage.access_token) {
      console.log(`✅ Page Token: ${ventasPage.access_token.substring(0, 40)}...`);
      
      // Save the token
      const result = {
        accessToken: ventasPage.access_token,
        pageId: ventasPage.id,
        pageName: ventasPage.name,
        pageAccessToken: ventasPage.access_token,
        adAccountId: '1545022093928422',
        bmId: '4482432028697067'
      };
      fs.writeFileSync(ROOT + '\\tokens\\fb_tokens_output.json', JSON.stringify(result, null, 2));
      console.log('✅ Token saved!');
      
      // Now try to create a campaign
      console.log('\nTrying to create test campaign...');
      const createResult = await page.evaluate(async (token, actId) => {
        try {
          const r = await fetch(`https://graph.facebook.com/v22.0/act_${actId}/campaigns?access_token=${token}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              name: 'Test Campaign - Borrador',
              objective: 'OUTCOME_TRAFFIC',
              status: 'PAUSED',
              daily_budget: 5000,
              special_ad_categories: [],
              buying_type: 'AUCTION'
            })
          });
          return await r.json();
        } catch(e) {
          return { error: e.message };
        }
      }, ventasPage.access_token, '1545022093928422');
      
      console.log('Create campaign result:', JSON.stringify(createResult, null, 2).substring(0, 500));
    }
  }
} else {
  console.log('No accounts found. Trying alternative approach...');
  
  // Try the business.facebook.com API
  const altResult = await page.evaluate(async () => {
    try {
      const r = await fetch('https://business.facebook.com/api/graphql/', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: 'doc_id=6336467846421800&variables={}'
      });
      return { status: r.status, text: (await r.text()).substring(0, 500) };
    } catch(e) {
      return { error: e.message };
    }
  });
  console.log('Alt API result:', JSON.stringify(altResult, null, 2).substring(0, 500));
}

await browser.disconnect();
