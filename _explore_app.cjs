const p = require('puppeteer');
(async () => {
  try {
    const b = await p.connect({ browserURL: 'http://127.0.0.1:9222', defaultViewport: null });
    const pages = await b.pages();
    const pg = pages.find(x => x.url().includes('apps')) || pages[0];
    
    // Look for Messenger-related links or sections
    const links = await pg.evaluate(() => {
      const all = Array.from(document.querySelectorAll('a, [role="link"], [role="button"], div, span'));
      const texts = all.filter(e => e.offsetParent !== null && e.textContent.trim().length > 0);
      return [...new Set(texts.map(e => e.textContent.trim()).filter(t => t.toLowerCase().includes('messenger') || t.toLowerCase().includes('producto') || t.toLowerCase().includes('añadir') || t.toLowerCase().includes('configuración')))].slice(0, 30);
    });
    console.log('Links:', JSON.stringify(links, null, 2));
    
    // Get the current app ID from URL
    const url = pg.url();
    console.log('URL:', url);
    
    b.disconnect();
  } catch (e) { console.error('ERR:', e.message); }
  process.exit(0);
})();