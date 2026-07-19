const p = require('puppeteer');
(async () => {
  try {
    const b = await p.connect({ browserURL: 'http://127.0.0.1:9222', defaultViewport: null });
    const pages = await b.pages();
    console.log('Page count:', pages.length);
    const pg = pages.find(x => x.url().includes('apps')) || pages[0];
    console.log('Current URL:', pg.url().substring(0, 150));
    
    // Click Conectar
    await pg.evaluate(() => {
      const all = Array.from(document.querySelectorAll('span, div, a, button'));
      const el = all.find(e => e.offsetParent !== null && e.textContent.trim() === 'Conectar');
      if (el) el.click();
    });
    console.log('Clicked');
    await new Promise(r => setTimeout(r, 3000));
    
    const newPages = await b.pages();
    console.log('After click - page count:', newPages.length);
    for (let i = 0; i < newPages.length; i++) {
      console.log(`  [${i}] ${newPages[i].url().substring(0, 200)}`);
    }
    
    b.disconnect();
    process.exit(0);
  } catch (e) {
    console.error('ERR:', e.message);
    process.exit(1);
  }
  setTimeout(() => process.exit(1), 30000);
})();