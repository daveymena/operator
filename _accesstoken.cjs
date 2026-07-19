const p = require('puppeteer');
(async () => {
  try {
    const b = await p.connect({ browserURL: 'http://127.0.0.1:9222', defaultViewport: null });
    const pages = await b.pages();
    const pg = pages.find(x => x.url().includes('accesstoken')) || pages[0];
    
    // Go to the Access Token Tool
    await pg.goto('https://developers.facebook.com/tools/accesstoken/', {
      waitUntil: 'load', timeout: 15000
    }).catch(() => {});
    await new Promise(r => setTimeout(r, 4000));
    
    // Get current state - look for existing user token
    const text = await pg.evaluate(() => document.body.innerText);
    console.log('Current page:', text.substring(0, 3000));
    
    b.disconnect();
  } catch (e) { console.error('ERR:', e.message); }
  process.exit(0);
})();