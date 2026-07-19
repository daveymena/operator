const p = require('puppeteer');
(async () => {
  try {
    const b = await p.connect({ browserURL: 'http://127.0.0.1:9222', defaultViewport: null });
    const pages = await b.pages();
    const pg = pages.find(x => x.url().includes('creation')) || pages[0];
    
    // Click "Siguiente"
    await pg.evaluate(() => {
      const btn = Array.from(document.querySelectorAll('[role="button"]')).find(e => e.textContent.trim() === 'Siguiente');
      if (btn) btn.click();
    });
    await new Promise(r => setTimeout(r, 3000));
    
    const text = await pg.evaluate(() => document.body.innerText);
    console.log('=== Step: Empresa/Requisitos ===');
    console.log(text.substring(0, 3000));
    b.disconnect();
  } catch (e) { console.error('ERR:', e.message); }
  process.exit(0);
})();