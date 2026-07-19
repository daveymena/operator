const p = require('puppeteer');
(async () => {
  try {
    const b = await p.connect({ browserURL: 'http://127.0.0.1:9222', defaultViewport: null });
    const pages = await b.pages();
    const pg = pages.find(x => x.url().includes('accesstoken')) || pages[0];
    
    // Click the "Debes conceder permisos" button
    const result = await pg.evaluate(() => {
      const all = Array.from(document.querySelectorAll('*'));
      const btn = all.find(e => e.offsetParent !== null && e.textContent.trim() === 'Debes conceder permisos');
      if (btn) { btn.click(); return 'CLICKED'; }
      return 'NOT FOUND';
    });
    console.log('Click result:', result);
    await new Promise(r => setTimeout(r, 5000));
    
    const allPages = await b.pages();
    console.log('Pages:', allPages.length);
    for (let i = 0; i < allPages.length; i++) {
      console.log('[' + i + '] ' + allPages[i].url().substring(0, 200));
    }
    
    // Check if a popup appeared
    if (allPages.length > 1) {
      const authPage = allPages[allPages.length - 1];
      await authPage.bringToFront();
      await new Promise(r => setTimeout(r, 3000));
      const text = await authPage.evaluate(() => document.body.innerText).catch(() => '');
      console.log('Auth page text:', text.substring(0, 2000));
    } else {
      // Check current page for changes
      const text = await pg.evaluate(() => document.body.innerText);
      console.log('Current page:', text.substring(0, 2000));
    }
    b.disconnect();
  } catch (e) { console.error('ERR:', e.message); }
  process.exit(0);
})();