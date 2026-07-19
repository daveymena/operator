const APP_ID = '4238613976451604';
const APP_SECRET = '93071f6b1afe369e4bea20b5bfa19294';
const PAGE_ID = '61591838792522';
const FB_ACCESS_TOKEN = 'EAABsbCS1iHgBR5ahvouq5auoIdyO3EtYXHqVXlMihjGfAesaAjPiAbNqTnZAhiWWJSAuI4WfCVZBiYVKMZBQYBvNtbtp3xUZCvOZBMPMQpPHG27lirrZAqFMpzzHVKC7ZCBwOdrQcZCRJZBQwGDL4FvFMN0nWzVCQ9CM1OBCZBV9w8dKjZBdXivOJfbmvyQ23ij9AZDZD';

async function graphApi(endpoint, params = {}) {
  const qs = new URLSearchParams(params).toString();
  const url = `https://graph.facebook.com/v21.0/${endpoint}${qs ? '?' + qs : ''}`;
  const res = await fetch(url);
  const data = await res.json();
  return data;
}

(async () => {
  try {
    // Step 1: Debug the existing token
    console.log('=== Step 1: Debug existing FB_ACCESS_TOKEN ===');
    const debugInfo = await graphApi('debug_token', {
      input_token: FB_ACCESS_TOKEN,
      access_token: `${APP_ID}|${APP_SECRET}`
    });
    console.log(JSON.stringify(debugInfo, null, 2));
    
    if (debugInfo.data && debugInfo.data.type === 'PAGE') {
      console.log('\nFB_ACCESS_TOKEN is already a Page Token!');
      process.exit(0);
    }
    
    // Step 2: If it's a user token, get page access token
    if (debugInfo.data && (debugInfo.data.type === 'USER' || debugInfo.data.scopes?.includes('pages_show_list'))) {
      console.log('\n=== Step 2: Getting Page Access Token ===');
      const userId = debugInfo.data.user_id;
      console.log('User ID:', userId);
      
      const accounts = await graphApi(`${userId}/accounts`, {
        access_token: FB_ACCESS_TOKEN
      });
      console.log('Accounts:', JSON.stringify(accounts, null, 2));
      
      if (accounts.data) {
        const page = accounts.data.find(p => p.id === PAGE_ID);
        if (page) {
          console.log('\n=== Page Token Found! ===');
          console.log('Page Token:', page.access_token);
        } else {
          console.log('Page not found in accounts');
        }
      }
    }
  } catch (e) {
    console.error('Error:', e.message);
  }
  process.exit(0);
})();