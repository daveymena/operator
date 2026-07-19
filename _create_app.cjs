const p = require('puppeteer');
(async () => {
  try {
    const b = await p.connect({ browserURL: 'http://127.0.0.1:9222', defaultViewport: null });
    const pages = await b.pages();
    const pg = pages.find(x => x.url().includes('creation')) || pages[0];
    
    // Click "Crear aplicación"
    await pg.evaluate(() => {
      const btn = Array.from(document.querySelectorAll('[role="button"]')).find(e => e.textContent.trim() === 'Crear aplicación');
      if (btn) btn.click();
    });
    console.log('Clicked Crear aplicación');
    await new Promise(r => setTimeout(r, 5000));
    
    const text = await pg.evaluate(() => document.body.innerText);
    const url = pg.url();
    console.log('URL:', url);
    console.log('=== After creating app ===');
    console.log(text.substring(0, 3000));
    b.disconnect();
  } catch (e) { console.error('ERR:', e.message); }
  process.exit(0);
})();