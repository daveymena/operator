const p = require('puppeteer');
(async () => {
  try {
    const b = await p.connect({ browserURL: 'http://127.0.0.1:9222', defaultViewport: null });
    const pages = await b.pages();
    const pg = pages.find(x => x.url().includes('creation')) || pages[0];
    
    // Click on "Interactúa con los clientes en Messenger from Meta"
    const clicked = await pg.evaluate(() => {
      const all = Array.from(document.querySelectorAll('*'));
      const el = all.find(e => e.offsetParent !== null && e.childElementCount === 0 && e.textContent.trim().startsWith('Interactúa con los clientes en Messenger'));
      if (!el) return 'not found';
      const r = el.getBoundingClientRect();
      el.click();
      return 'clicked: ' + el.textContent.trim().substring(0, 50) + ' at (' + Math.round(r.x) + ',' + Math.round(r.y) + ')';
    });
    console.log('Click result:', clicked);
    await new Promise(r => setTimeout(r, 2000));
    
    const text = await pg.evaluate(() => document.body.innerText);
    console.log('=== After clicking Messenger use case ===');
    console.log(text.substring(0, 2500));
    b.disconnect();
  } catch (e) { console.error('ERR:', e.message); }
  process.exit(0);
})();