const p = require('puppeteer');
(async () => {
  try {
    const b = await p.connect({ browserURL: 'http://127.0.0.1:9222', defaultViewport: null });
    const pages = await b.pages();
    const pg = pages.find(x => x.url().includes('apps')) || pages[0];
    
    // Change the input type to text and read the value
    const secret = await pg.evaluate(() => {
      const inp = document.querySelector('#js_bv');
      if (!inp) return 'not found';
      inp.type = 'text';
      return inp.value;
    });
    console.log('App Secret:', secret);
    
    // Also get App ID
    const appId = await pg.evaluate(() => {
      const inp = document.querySelector('#js_bq');
      return inp ? inp.value : 'not found';
    });
    console.log('App ID:', appId);
    
    b.disconnect();
  } catch (e) { console.error('ERR:', e.message); }
  process.exit(0);
})();