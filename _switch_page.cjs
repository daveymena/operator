const p = require('puppeteer');
(async () => {
  try {
    const b = await p.connect({ browserURL: 'http://127.0.0.1:9222', defaultViewport: null });
    const pages = await b.pages();
    const pg = pages[0];
    
    // Click "Cambiar" to switch to page identity
    await pg.evaluate(() => {
      const all = Array.from(document.querySelectorAll('*'));
      const el = all.find(e => e.offsetParent !== null && e.childElementCount === 0 && e.textContent.trim() === 'Cambiar');
      if (el) { el.click(); return true; }
      return false;
    });
    console.log('Clicked Cambiar');
    await new Promise(r => setTimeout(r, 4000));
    
    const text = await pg.evaluate(() => document.body.innerText);
    const url = pg.url();
    console.log('URL:', url.substring(0, 200));
    console.log('After switch:', text.substring(0, 2000));
    b.disconnect();
  } catch (e) { console.error('ERR:', e.message); }
  process.exit(0);
})();