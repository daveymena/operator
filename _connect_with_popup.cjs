const p = require('puppeteer');
(async () => {
  try {
    const b = await p.connect({ browserURL: 'http://127.0.0.1:9222', defaultViewport: null });
    const pages = await b.pages();
    const pg = pages.find(x => x.url().includes('apps')) || pages[0];
    
    // Set up a listener for new pages/targets
    b.on('targetcreated', async (target) => {
      const newPage = await target.page();
      if (newPage) {
        console.log('NEW PAGE:', await newPage.url().catch(() => ''));
        await newPage.bringToFront().catch(() => {});
      }
    });
    
    // Click "Conectar" via JS
    await pg.evaluate(() => {
      const all = Array.from(document.querySelectorAll('span, div, a, button'));
      const el = all.find(e => e.offsetParent !== null && e.childElementCount === 0 && e.textContent.trim() === 'Conectar');
      if (el) {
        el.click();
        console.log('Clicked Conectar');
      }
    });
    await new Promise(r => setTimeout(r, 5000));
    
    // Check all pages
    const allPages = await b.pages();
    console.log('Total pages:', allPages.length);
    for (const p of allPages) {
      console.log('  Page:', p.url().substring(0, 150));
    }
    
    b.disconnect();
  } catch (e) { console.error('ERR:', e.message); }
  process.exit(0);
})();