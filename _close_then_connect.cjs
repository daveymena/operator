const p = require('puppeteer');
(async () => {
  try {
    const b = await p.connect({ browserURL: 'http://127.0.0.1:9222', defaultViewport: null });
    const pages = await b.pages();
    const pg = pages.find(x => x.url().includes('apps')) || pages[0];
    
    // Click "Cerrar" to close the popup
    const clicked = await pg.evaluate(() => {
      const all = Array.from(document.querySelectorAll('*'));
      const el = all.find(e => e.offsetParent !== null && e.childElementCount === 0 && e.textContent.trim() === 'Cerrar');
      if (el) { el.click(); return 'CLICKED'; }
      return 'NOT FOUND';
    });
    console.log('Close clicked:', clicked);
    await new Promise(r => setTimeout(r, 2000));
    
    // Try clicking "Conectar" now
    const connectResult = await pg.evaluate(() => {
      const all = Array.from(document.querySelectorAll('span, div, a, button'));
      // Try different variations
      let el = all.find(e => e.offsetParent !== null && e.textContent.trim() === 'Conectar');
      if (!el) el = all.find(e => e.offsetParent !== null && e.textContent.trim().includes('Conectar') && e.childElementCount === 0);
      if (el) { 
        el.click(); 
        const r = el.getBoundingClientRect();
        return 'CLICKED Conectar at (' + Math.round(r.x) + ',' + Math.round(r.y) + ')'; 
      }
      return 'NOT FOUND Conectar';
    });
    console.log('Connect clicked:', connectResult);
    await new Promise(r => setTimeout(r, 5000));
    
    const text = await pg.evaluate(() => document.body.innerText);
    console.log('=== After connect click ===');
    console.log(text.substring(0, 3000));
    b.disconnect();
  } catch (e) { console.error('ERR:', e.message); }
  process.exit(0);
})();