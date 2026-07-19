const p = require('puppeteer');
(async () => {
  try {
    const b = await p.connect({ browserURL: 'http://127.0.0.1:9222', defaultViewport: null });
    const pages = await b.pages();
    const pg = pages.find(x => x.url().includes('accesstoken')) || pages[0];
    
    // Look for buttons or links related to user token
    const btns = await pg.evaluate(() => {
      const all = Array.from(document.querySelectorAll('div, span, a, button, label'));
      const tokenItems = all.filter(e => e.offsetParent !== null && e.childElementCount === 0 && (
        e.textContent.trim().includes('Token') || 
        e.textContent.trim().includes('token') ||
        e.textContent.trim().includes('Conceder') ||
        e.textContent.trim().includes('Obtener')
      ) && e.textContent.trim().length < 100);
      return tokenItems.map(e => ({ t: e.textContent.trim().substring(0, 60), tag: e.tagName }));
    });
    console.log('Token-related elements:');
    btns.forEach(b => console.log(`  ${b.tag}: ${b.t}`));
    b.disconnect();
  } catch (e) { console.error('ERR:', e.message); }
  process.exit(0);
})();