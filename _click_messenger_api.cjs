const p = require('puppeteer');
(async () => {
  try {
    const b = await p.connect({ browserURL: 'http://127.0.0.1:9222', defaultViewport: null });
    const pages = await b.pages();
    const pg = pages.find(x => x.url().includes('apps')) || pages[0];
    
    // Click on "Configuración de Messenger API"
    await pg.evaluate(() => {
      const all = Array.from(document.querySelectorAll('*'));
      const el = all.find(e => e.offsetParent !== null && e.childElementCount === 0 && e.textContent.trim() === 'Configuración de Messenger API');
      if (el) { el.click(); return true; }
      return false;
    });
    await new Promise(r => setTimeout(r, 4000));
    
    const text = await pg.evaluate(() => document.body.innerText);
    console.log(text.substring(0, 4000));
    b.disconnect();
  } catch (e) { console.error('ERR:', e.message); }
  process.exit(0);
})();