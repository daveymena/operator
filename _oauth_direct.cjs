const p = require('puppeteer');
(async () => {
  try {
    const b = await p.connect({ browserURL: 'http://127.0.0.1:9222', defaultViewport: null });
    const pages = await b.pages();
    const pg = pages[0];
    
    // Open the OAuth dialog directly
    const oauthUrl = 'https://www.facebook.com/v21.0/dialog/oauth?' +
      'client_id=4238613976451604' +
      '&redirect_uri=https://developers.facebook.com/tools/explorer/' +
      '&response_type=token,granted_scopes' +
      '&scope=pages_show_list,pages_read_engagement,pages_messaging,pages_manage_metadata' +
      '&auth_type=rerequest';
    
    await pg.goto(oauthUrl, { waitUntil: 'load', timeout: 20000 }).catch(() => {});
    await new Promise(r => setTimeout(r, 5000));
    
    const url = pg.url();
    console.log('URL:', url.substring(0, 300));
    const text = await pg.evaluate(() => document.body.innerText);
    console.log(text.substring(0, 3000));
    b.disconnect();
  } catch (e) { console.error('ERR:', e.message); }
  process.exit(0);
})();