const USER_TOKEN = 'EAA8OZCzhoChQBRy44ntZBq3esho91NRj43j1zGl0KM3i1agr5tNuddGPFpPwManpmjBrp4gvXCTfgHpYgAR4wxet2F7gyyKQ7yUSbZAdGhFZB9o63wW9XYjCtljlfKCJ9BIWNszHfOqzrZBkiZBV8TgcGTZCk7ZCiYBu1sqtZAaxdjgBBIbXmRc4PstsjFrLeaHKaHgZDZD';
const PAGE_ID = '61591838792522';
const APP_SECRET = '93071f6b1afe369e4bea20b5bfa19294';

async function graphApi(endpoint, params = {}) {
  const qs = new URLSearchParams(params).toString();
  const url = `https://graph.facebook.com/v21.0/${endpoint}${qs ? '?' + qs : ''}`;
  console.log('GET:', url.substring(0, 180));
  const res = await fetch(url);
  return await res.json();
}

async function graphPost(endpoint, params = {}) {
  const qs = new URLSearchParams(params).toString();
  const url = `https://graph.facebook.com/v21.0/${endpoint}${qs ? '?' + qs : ''}`;
  console.log('POST:', url.substring(0, 180));
  const res = await fetch(url, { method: 'POST' });
  return await res.json();
}

(async () => {
  try {
    // Step 1: Get user info
    console.log('=== Step 1: User Info ===');
    const me = await graphApi('me', { access_token: USER_TOKEN, fields: 'id,name' });
    console.log(JSON.stringify(me));
    
    // Step 2: Get page access token
    console.log('\n=== Step 2: Page Account Info ===');
    const accounts = await graphApi('me/accounts', { access_token: USER_TOKEN });
    console.log(JSON.stringify(accounts, null, 2));
    
    // Find our page
    if (accounts.data) {
      const page = accounts.data.find(p => p.id === PAGE_ID);
      if (page) {
        console.log('\n=== Page Token Found! ===');
        console.log('Page Name:', page.name);
        console.log('Page Access Token:', page.access_token);
        
        // Step 3: Subscribe app to page webhooks
        console.log('\n=== Step 3: Subscribe to Webhooks ===');
        const subResult = await graphPost(`${PAGE_ID}/subscribed_apps`, {
          access_token: page.access_token,
          subscribed_fields: 'messages,messaging_postbacks,feed'
        });
        console.log('Subscribe Result:', JSON.stringify(subResult));
        
        // Step 4: Verify the subscription
        console.log('\n=== Step 4: Verify Subscription ===');
        const subs = await graphApi(`${PAGE_ID}/subscribed_apps`, { access_token: page.access_token });
        console.log('Subscriptions:', JSON.stringify(subs));
      } else {
        console.log('Page not found in accounts. Available pages:');
        accounts.data.forEach(p => console.log(`  ${p.id}: ${p.name} (${p.access_token ? 'has token' : 'no token'})`));
      }
    } else {
      console.log('No accounts data:', JSON.stringify(accounts));
    }
  } catch (e) { console.error('Error:', e.message); }
  process.exit(0);
})();