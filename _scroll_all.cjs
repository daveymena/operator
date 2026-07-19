const p = require('puppeteer');
(async () => {
  try {
    const b = await p.connect({ browserURL: 'http://127.0.0.1:9222', defaultViewport: null });
    const pages = await b.pages();
    const pg = pages.find(x => x.url().includes('apps')) || pages[0];
    
    // Scroll all the way down
    await pg.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await new Promise(r => setTimeout(r, 1000));
    
    const text = await pg.evaluate(() => document.body.innerText);
    const url = pg.url();
    console.log('URL:', url);
    console.log('=== Full page text ===');
    console.log(text);
    b.disconnect();
  } catch (e) { console.error('ERR:', e.message); }
  process.exit(0);
})();