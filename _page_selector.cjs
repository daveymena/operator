const p = require('puppeteer');
(async () => {
  try {
    const b = await p.connect({ browserURL: 'http://127.0.0.1:9222', defaultViewport: null });
    const pages = await b.pages();
    const pg = pages[0];
    
    await pg.goto('https://developers.facebook.com/tools/explorer/', {
      waitUntil: 'load', timeout: 15000
    }).catch(() => {});
    await new Promise(r => setTimeout(r, 3000));
    
    // Close popup blockers
    await pg.evaluate(() => {
      document.querySelectorAll('*').forEach(e => {
        const t = e.textContent.trim();
        if (t.includes('Cerrar las ventanas') || t === 'Cerrar') {
          if (e.offsetParent !== null) e.click();
        }
      });
    });
    await new Promise(r => setTimeout(r, 1000));
    
    // Look for the "Usuario o página" dropdown/selector
    const selectorHTML = await pg.evaluate(() => {
      const all = Array.from(document.querySelectorAll('*'));
      const items = all.filter(e => e.offsetParent !== null).map(e => ({
        tag: e.tagName,
        text: e.textContent.trim().substring(0, 50),
        role: e.getAttribute('role'),
        cls: e.className.substring(0, 30)
      }));
      return items.filter(i => 
        i.text.toLowerCase().includes('usuario') || 
        i.text.toLowerCase().includes('página') || 
        i.text.toLowerCase().includes('page') || 
        i.text.toLowerCase().includes('user')
      );
    });
    console.log('Selector elements:');
    selectorHTML.forEach(i => console.log(`  ${i.tag} "${i.text}" role=${i.role}`));
    
    b.disconnect();
  } catch (e) { console.error('ERR:', e.message); }
  process.exit(0);
})();