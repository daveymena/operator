const p = require('puppeteer');
(async () => {
  try {
    const b = await p.connect({ browserURL: 'http://127.0.0.1:9222', defaultViewport: null });
    const pages = await b.pages();
    const pg = pages.find(x => x.url().includes('creation')) || pages[0];
    
    // Get bounding box of "Mensajes empresariales (3)" filter
    const filterBox = await pg.evaluate(() => {
      const all = Array.from(document.querySelectorAll('*'));
      const el = all.find(e => e.offsetParent !== null && e.childElementCount === 0 && e.textContent.trim() === 'Mensajes empresariales (3)');
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return { x: r.x, y: r.y, w: r.width, h: r.height, text: el.textContent.trim(), tag: el.tagName };
    });
    console.log('Filter box:', JSON.stringify(filterBox));
    
    if (filterBox) {
      // Click via mouse at center of filter
      await pg.mouse.click(filterBox.x + filterBox.w/2, filterBox.y + filterBox.h/2);
      await new Promise(r => setTimeout(r, 2000));
    }
    
    // Now get all use case titles visible
    const useCases = await pg.evaluate(() => {
      const all = Array.from(document.querySelectorAll('div, span, h3, h4, label, a'));
      const titles = all.filter(e => e.offsetParent !== null && e.childElementCount === 0 && e.textContent.trim().length > 15 && e.textContent.trim().length < 120);
      return titles.map(e => {
        const r = e.getBoundingClientRect();
        return { text: e.textContent.trim().substring(0, 80), x: Math.round(r.x), y: Math.round(r.y) };
      });
    });
    console.log('Use cases after filter:', JSON.stringify(useCases, null, 2));
    b.disconnect();
  } catch (e) { console.error('ERR:', e.message); }
  process.exit(0);
})();