const p = require('puppeteer');
(async () => {
  try {
    const b = await p.connect({ browserURL: 'http://127.0.0.1:9222', defaultViewport: null });
    const pages = await b.pages();
    const pg = pages.find(x => x.url().includes('creation')) || pages[0];
    
    // Click on "VentasPro" business portfolio
    const clicked = await pg.evaluate(() => {
      const all = Array.from(document.querySelectorAll('*'));
      const el = all.find(e => e.offsetParent !== null && e.childElementCount === 0 && e.textContent.trim() === 'VentasPro');
      if (!el) return 'not found';
      el.click();
      return 'clicked VentasPro';
    });
    console.log('Business:', clicked);
    await new Promise(r => setTimeout(r, 1000));
    
    // Click "Siguiente"
    await pg.evaluate(() => {
      const btn = Array.from(document.querySelectorAll('[role="button"]')).find(e => e.textContent.trim() === 'Siguiente');
      if (btn) btn.click();
    });
    await new Promise(r => setTimeout(r, 3000));
    
    const text = await pg.evaluate(() => document.body.innerText);
    console.log('=== After selecting business ===');
    console.log(text.substring(0, 3000));
    b.disconnect();
  } catch (e) { console.error('ERR:', e.message); }
  process.exit(0);
})();