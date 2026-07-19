const p = require('puppeteer');
(async () => {
  try {
    const b = await p.connect({ browserURL: 'http://127.0.0.1:9222', defaultViewport: null, acceptInsecureCerts: true });
    const pages = await b.pages();
    
    const pg = pages.find(x => x.url().includes('explorer')) || pages[0];
    
    // Close popup blocker messages
    await pg.evaluate(() => {
      const all = Array.from(document.querySelectorAll('*'));
      const closeBtns = all.filter(e => e.offsetParent !== null && e.textContent.trim().includes('Cerrar las ventanas emergentes'));
      closeBtns.forEach(b => b.click());
    });
    await new Promise(r => setTimeout(r, 1000));
    
    // Now click "Generate Access Token"
    await pg.evaluate(() => {
      const all = Array.from(document.querySelectorAll('[role="button"], button, span'));
      const btns = all.filter(e => e.offsetParent !== null && e.textContent.trim() === 'Generate Access Token');
      if (btns.length > 0) btns[0].click();
    });
    console.log('Clicked Generate Access Token');
    await new Promise(r => setTimeout(r, 4000));
    
    // Check for popup or dialog
    const allPages = await b.pages();
    console.log('Pages open:', allPages.length);
    for (let i = 0; i < allPages.length; i++) {
      const u = allPages[i].url();
      console.log(`  [${i}] ${u.substring(0, 200)}`);
    }
    
    // If a new popup appeared, switch to it
    if (allPages.length > 1) {
      const authPage = allPages.find(p => p.url().includes('dialog') || p.url().includes('oauth') || p.url().includes('login'));
      if (authPage) {
        console.log('\n=== Auth dialog found! ===');
        await authPage.bringToFront();
        await new Promise(r => setTimeout(r, 3000));
        const t = await authPage.evaluate(() => document.body.innerText).catch(() => '');
        console.log(t.substring(0, 3000));
      }
    }
    
    b.disconnect();
  } catch (e) { console.error('ERR:', e.message); }
  process.exit(0);
})();