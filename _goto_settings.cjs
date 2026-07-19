const p = require('puppeteer');
(async () => {
  try {
    const b = await p.connect({ browserURL: 'http://127.0.0.1:9222', defaultViewport: null });
    const pages = await b.pages();
    const pg = pages.find(x => x.url().includes('apps')) || pages[0];
    
    // Go directly to settings page
    await pg.goto('https://developers.facebook.com/apps/4238613976451604/settings/basic/', { waitUntil: 'networkidle2', timeout: 30000 });
    await new Promise(r => setTimeout(r, 3000));
    
    const url = pg.url();
    const text = await pg.evaluate(() => document.body.innerText);
    console.log('URL:', url);
    console.log('=== Settings Basic ===');
    console.log(text.substring(0, 3000));
    b.disconnect();
  } catch (e) { console.error('ERR:', e.message); }
  process.exit(0);
})();