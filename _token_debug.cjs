const p = require('puppeteer');
(async () => {
  try {
    const b = await p.connect({ browserURL: 'http://127.0.0.1:9222', defaultViewport: null });
    const pages = await b.pages();
    const pg = pages[0];
    
    // Navigate to the old-style Facebook Page Access Token generator
    await pg.goto('https://developers.facebook.com/tools/debug/accesstoken/', { 
      waitUntil: 'load', timeout: 15000 
    }).catch(() => {});
    await new Promise(r => setTimeout(r, 5000));
    
    console.log('URL:', pg.url().substring(0, 200));
    const text = await pg.evaluate(() => document.body.innerText);
    console.log(text.substring(0, 2000));
    b.disconnect();
  } catch (e) { console.error('ERR:', e.message); }
  process.exit(0);
})();