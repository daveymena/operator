const p = require('puppeteer');
(async () => {
  try {
    const b = await p.connect({ browserURL: 'http://127.0.0.1:9222', defaultViewport: null });
    const pages = await b.pages();
    const pg = pages.find(x => x.url().includes('creation')) || pages[0];
    
    // Scroll to bottom slowly
    for (let i = 0; i < 15; i++) {
      await pg.evaluate(() => window.scrollBy(0, 400));
      await new Promise(r => setTimeout(r, 200));
    }
    
    // Get full text
    const text = await pg.evaluate(() => document.body.innerText);
    console.log(text);
    b.disconnect();
  } catch (e) { console.error('ERR:', e.message); }
  process.exit(0);
})();