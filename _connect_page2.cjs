const p = require('puppeteer');
(async () => {
  try {
    const b = await p.connect({ browserURL: 'http://127.0.0.1:9222', defaultViewport: null });
    const pages = await b.pages();
    const pg = pages.find(x => x.url().includes('apps')) || pages[0];
    
    // First close any popups
    await pg.evaluate(() => {
      const all = Array.from(document.querySelectorAll('*'));
      const closeBtn = all.find(e => e.offsetParent !== null && e.childElementCount === 0 && e.textContent.trim() === 'Cerrar');
      if (closeBtn) closeBtn.click();
    });
    await new Promise(r => setTimeout(r, 1000));
    
    // Get current page count
    const initialCount = (await b.pages()).length;
    console.log('Initial pages:', initialCount);
    
    // Click Conectar via evaluate
    await pg.evaluate(() => {
      const all = Array.from(document.querySelectorAll('*'));
      const el = all.find(e => e.offsetParent !== null && e.childElementCount === 0 && e.textContent.trim() === 'Conectar');
      if (el) {
        console.log('CLICKED Conectar');
        el.click();
      }
    });
    console.log('Clicked Conectar');
    await new Promise(r => setTimeout(r, 5000));
    
    // Check for new pages
    const allPages = await b.pages();
    console.log('New page count:', allPages.length);
    for (let i = 0; i < allPages.length; i++) {
      const u = allPages[i].url();
      console.log(`  Page ${i}: ${u.substring(0, 150)}`);
    }
    
    // Try to find the Facebook auth dialog in existing pages
    for (const p of allPages) {
      const u = p.url();
      if (u.includes('facebook.com') && (u.includes('dialog') || u.includes('oauth') || u.includes('login') || u.includes('connect'))) {
        console.log('\nFound auth page!');
        await p.bringToFront();
        await new Promise(r => setTimeout(r, 3000));
        const text = await p.evaluate(() => document.body.innerText).catch(() => '');
        console.log(text.substring(0, 2000));
      }
    }
    
    b.disconnect();
  } catch (e) { console.error('ERR:', e.message); }
  process.exit(0);
})();