const p = require('puppeteer');
(async () => {
  const b = await p.connect({ browserURL: 'http://127.0.0.1:9222', defaultViewport: null });
  const pages = await b.pages();
  const pg = pages.find(x => x.url().includes('creation')) || pages[0];
  
  // Find and click the "Mensajes empresariales" filter
  const clicked = await pg.evaluate(() => {
    const all = Array.from(document.querySelectorAll('div, span, a, button, label'));
    const el = all.find(e => e.offsetParent !== null && e.textContent.trim() === 'Mensajes empresariales (3)');
    if (el) { el.click(); return 'clicked: ' + el.textContent.trim(); }
    // try partial match
    const el2 = all.find(e => e.offsetParent !== null && e.textContent.trim().startsWith('Mensajes empresariales'));
    if (el2) { el2.click(); return 'clicked partial: ' + el2.textContent.trim(); }
    return 'not found';
  });
  console.log('Filter click:', clicked);
  await new Promise(r => setTimeout(r, 2000));
  
  const text = await pg.evaluate(() => document.body.innerText);
  console.log('=== After filter ===');
  console.log(text.substring(0, 2500));
  b.disconnect();
})();