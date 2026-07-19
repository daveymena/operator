const p = require('puppeteer');
(async () => {
  try {
    const b = await p.connect({ browserURL: 'http://127.0.0.1:9222', defaultViewport: null });
    const pages = await b.pages();
    const pg = pages[0];
    
    await pg.goto('https://developers.facebook.com/tools/accesstoken/', { 
      waitUntil: 'domcontentloaded', timeout: 15000 
    }).catch(() => {});
    await new Promise(r => setTimeout(r, 4000));
    
    const info = await pg.evaluate(() => {
      const all = Array.from(document.querySelectorAll('div, span, a, button, label'));
      // Find the User Token section
      const userToken = all.filter(e => 
        e.offsetParent !== null && 
        e.textContent.trim().includes('User Token')
      );
      const last = userToken[userToken.length - 1];
      if (!last) return 'NOT FOUND';
      
      const parent = last.closest('div, section');
      if (!parent) return 'NO PARENT';
      
      const children = Array.from(parent.querySelectorAll('div, span, a, button, label, input'));
      const items = children
        .filter(c => c.offsetParent !== null && c.textContent.trim().length > 0)
        .map(c => ({
          tag: c.tagName,
          text: c.textContent.trim().substring(0, 60),
          role: c.getAttribute('role'),
          cls: c.className.substring(0, 30)
        }));
      return JSON.stringify(items, null, 2);
    });
    console.log('User Token section:', info);
    b.disconnect();
  } catch (e) { console.error('ERR:', e.message); }
  process.exit(0);
})();