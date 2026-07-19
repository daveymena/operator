const p = require('puppeteer');
(async () => {
  try {
    const b = await p.connect({ browserURL: 'http://127.0.0.1:9222', defaultViewport: null });
    const pages = await b.pages();
    const pg = pages[0];
    
    // Look for and click "Configuración" in the sidebar
    const configClicked = await pg.evaluate(() => {
      const all = Array.from(document.querySelectorAll('*'));
      const btn = all.find(e => e.offsetParent !== null && e.childElementCount === 0 && e.textContent.trim() === 'Configuración');
      if (btn) { btn.click(); return true; }
      return false;
    });
    console.log('Configuración clicked:', configClicked);
    await new Promise(r => setTimeout(r, 5000));
    
    const text = await pg.evaluate(() => document.body.innerText);
    const url = pg.url();
    console.log('URL:', url.substring(0, 200));
    console.log('Settings:', text.substring(0, 3000));
    b.disconnect();
  } catch (e) { console.error('ERR:', e.message); }
  process.exit(0);
})();