const p = require('puppeteer');
(async () => {
  try {
    const b = await p.connect({ browserURL: 'http://127.0.0.1:9222', defaultViewport: null });
    const pages = await b.pages();
    const pg = pages.find(x => x.url().includes('facebook')) || pages[0];
    
    // Go to Graph API Explorer
    await pg.goto('https://developers.facebook.com/tools/explorer/', { 
      waitUntil: 'domcontentloaded', timeout: 15000 
    }).catch(() => {});
    await new Promise(r => setTimeout(r, 6000));
    
    console.log('URL:', pg.url().substring(0, 200));
    const text = await pg.evaluate(() => document.body.innerText);
    console.log(text.substring(0, 3000));
    b.disconnect();
  } catch (e) { console.error('ERR:', e.message); }
  process.exit(0);
})();