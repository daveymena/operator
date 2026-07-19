const p = require('puppeteer');
(async () => {
  try {
    const b = await p.connect({ browserURL: 'http://127.0.0.1:9222', defaultViewport: null });
    const pages = await b.pages();
    const pg = pages.find(x => x.url().includes('apps')) || pages[0];
    
    // Try to navigate to Messenger settings
    await pg.goto('https://developers.facebook.com/apps/4238613976451604/messenger/', { waitUntil: 'load', timeout: 15000 }).catch(() => {});
    await new Promise(r => setTimeout(r, 4000));
    
    const url = pg.url();
    console.log('URL:', url);
    const text = await pg.evaluate(() => document.body.innerText);
    console.log(text.substring(0, 3000));
    b.disconnect();
  } catch (e) { console.error('ERR:', e.message); }
  process.exit(0);
})();