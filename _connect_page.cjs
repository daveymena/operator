const p = require('puppeteer');
(async () => {
  try {
    const b = await p.connect({ browserURL: 'http://127.0.0.1:9222', defaultViewport: null });
    const pages = await b.pages();
    const pg = pages.find(x => x.url().includes('apps')) || pages[0];
    
    // Click "Conectar" in the access token section
    const clicked = await pg.evaluate(() => {
      const all = Array.from(document.querySelectorAll('*'));
      // Look for the "Conectar" button in the access token section
      const el = all.find(e => e.offsetParent !== null && e.childElementCount === 0 && e.textContent.trim() === 'Conectar');
      if (el) { el.click(); return 'CLICKED Conectar'; }
      return 'NOT FOUND';
    });
    console.log('Result:', clicked);
    await new Promise(r => setTimeout(r, 5000));
    
    const text = await pg.evaluate(() => document.body.innerText);
    const url = pg.url();
    console.log('URL:', url);
    console.log('=== After clicking Conectar ===');
    console.log(text.substring(0, 3000));
    b.disconnect();
  } catch (e) { console.error('ERR:', e.message); }
  process.exit(0);
})();