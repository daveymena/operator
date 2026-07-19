const p = require('puppeteer');
(async () => {
  try {
    const b = await p.connect({ browserURL: 'http://127.0.0.1:9222', defaultViewport: null });
    const pages = await b.pages();
    const pg = pages.find(x => x.url().includes('explorer')) || pages[0];
    
    // Close popup blockers
    await pg.evaluate(() => {
      const all = Array.from(document.querySelectorAll('*'));
      const btns = all.filter(e => e.offsetParent !== null && e.textContent.trim().includes('Cerrar las ventanas'));
      btns.forEach(b => b.click());
    });
    await new Promise(r => setTimeout(r, 1000));
    
    // Click "Añadir un permiso" to open the permission dropdown
    const addPerm = await pg.evaluate(() => {
      const all = Array.from(document.querySelectorAll('*'));
      const el = all.find(e => e.offsetParent !== null && e.childElementCount === 0 && e.textContent.trim() === 'Añadir un permiso');
      if (el) { el.click(); return 'CLICKED ADD PERM'; }
      return 'NOT FOUND ADD PERM';
    });
    console.log('Add perm:', addPerm);
    await new Promise(r => setTimeout(r, 2000));
    
    // Look for what appeared - likely a dropdown or input
    const text = await pg.evaluate(() => document.body.innerText);
    console.log('After add perm:', text.substring(text.indexOf('Permisos'), text.indexOf('Permisos') + 400));
    
    // Check for inputs that appear for permission search
    const newInputs = await pg.evaluate(() => {
      const all = Array.from(document.querySelectorAll('input'));
      return all.filter(i => i.offsetParent !== null).map(i => ({ id: i.id, pl: i.placeholder, val: i.value.substring(0, 20) }));
    });
    console.log('Inputs:', JSON.stringify(newInputs));
    
    b.disconnect();
  } catch (e) { console.error('ERR:', e.message); }
  process.exit(0);
})();