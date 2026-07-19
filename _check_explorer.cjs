const p = require('puppeteer');
(async () => {
  try {
    const b = await p.connect({ browserURL: 'http://127.0.0.1:9222', defaultViewport: null });
    const pages = await b.pages();
    const pg = pages.find(x => x.url().includes('explorer')) || pages[0];
    
    const token = await pg.evaluate(() => {
      const inp = document.querySelector('input[placeholder="Identificador de acceso"]');
      return inp ? inp.value : 'NO INPUT';
    });
    console.log('Token:', token.substring(0, 80));
    
    const scopes = await pg.evaluate(() => {
      const all = Array.from(document.querySelectorAll('*'));
      const items = all.filter(e => e.offsetParent !== null && e.childElementCount === 0 && e.textContent.trim().startsWith('pages_'));
      return items.map(e => e.textContent.trim());
    });
    console.log('Scopes shown:', scopes);
    
    const text = await pg.evaluate(() => document.body.innerText);
    console.log('Page text excerpt:', text.substring(0, 2000));
    
    b.disconnect();
  } catch (e) { console.error('ERR:', e.message); }
  process.exit(0);
})();