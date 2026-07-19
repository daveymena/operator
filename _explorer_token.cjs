const p = require('puppeteer');
(async () => {
  try {
    const b = await p.connect({ browserURL: 'http://127.0.0.1:9222', defaultViewport: null });
    const pages = await b.pages();
    const pg = pages.find(x => x.url().includes('explorer')) || pages[0];
    
    // Close any popups first
    await pg.evaluate(() => {
      const all = Array.from(document.querySelectorAll('*'));
      const closeBtns = all.filter(e => e.offsetParent !== null && e.childElementCount === 0 && e.textContent.trim() === 'Cerrar');
      closeBtns.forEach(b => b.click());
    });
    await new Promise(r => setTimeout(r, 1000));
    
    // Find and click "Generate Access Token"
    const clicked = await pg.evaluate(() => {
      const all = Array.from(document.querySelectorAll('*'));
      const el = all.find(e => e.offsetParent !== null && e.childElementCount === 0 && (
        e.textContent.trim() === 'Generate Access Token' || 
        e.textContent.trim() === 'Obtener identificador de acceso' ||
        e.textContent.trim().includes('Generate') 
      ));
      if (el) {
        el.click();
        return 'CLICKED: ' + el.textContent.trim().substring(0, 40);
      }
      return 'NOT FOUND';
    });
    console.log(clicked);
    await new Promise(r => setTimeout(r, 4000));
    
    // Check for popup
    const allPages = await b.pages();
    console.log('Pages:', allPages.length);
    for (let i = 0; i < allPages.length; i++) {
      const u = allPages[i].url();
      console.log(`  [${i}] ${u.substring(0, 200)}`);
    }
    
    // Get page text
    const text = await pg.evaluate(() => document.body.innerText);
    console.log('=== After click ===');
    console.log(text.substring(0, 2000));
    b.disconnect();
  } catch (e) { console.error('ERR:', e.message); }
  process.exit(0);
})();