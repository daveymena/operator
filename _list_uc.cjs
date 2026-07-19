const p = require('puppeteer');
(async () => {
  try {
    const b = await p.connect({ browserURL: 'http://127.0.0.1:9222', defaultViewport: null });
    const pages = await b.pages();
    const pg = pages.find(x => x.url().includes('creation')) || pages[0];
    console.log('URL:', pg.url());
    
    // Get all visible use case cards
    const useCases = await pg.evaluate(() => {
      const all = Array.from(document.querySelectorAll('div, span, h3, h4, label'));
      const titles = all.filter(e => e.offsetParent !== null && e.childElementCount === 0 && e.textContent.trim().length > 10);
      return titles.map(e => e.textContent.trim().substring(0, 80));
    });
    console.log('Visible texts:', JSON.stringify(useCases.slice(0, 30)));
    b.disconnect();
  } catch (e) {
    console.error('ERR:', e.message);
  }
  process.exit(0);
})();