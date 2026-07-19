const p = require('puppeteer');
(async () => {
  try {
    const b = await p.connect({ browserURL: 'http://127.0.0.1:9222', defaultViewport: null });
    const pages = await b.pages();
    const pg = pages.find(x => x.url().includes('apps')) || pages[0];
    
    // Click "Información básica"
    const clicked = await pg.evaluate(() => {
      const all = Array.from(document.querySelectorAll('*'));
      const el = all.find(e => e.offsetParent !== null && e.childElementCount === 0 && e.textContent.trim() === 'Información básica');
      if (el) { el.click(); return 'clicked'; }
      return 'not found';
    });
    console.log('Click result:', clicked);
    await new Promise(r => setTimeout(r, 3000));
    
    const text = await pg.evaluate(() => document.body.innerText);
    console.log('=== Basic settings ===');
    console.log(text.substring(0, 3000));
    b.disconnect();
  } catch (e) { console.error('ERR:', e.message); }
  process.exit(0);
})();