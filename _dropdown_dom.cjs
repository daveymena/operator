const p = require('puppeteer');
(async () => {
  try {
    const b = await p.connect({ browserURL: 'http://127.0.0.1:9222', defaultViewport: null });
    const pages = await b.pages();
    const pg = pages[0];
    
    await pg.goto('https://developers.facebook.com/tools/explorer/', {
      waitUntil: 'load', timeout: 15000
    }).catch(() => {});
    await new Promise(r => setTimeout(r, 4000));
    
    // Close popup blockers
    await pg.evaluate(() => {
      document.querySelectorAll('*').forEach(e => {
        if (e.offsetParent !== null && e.textContent.trim().includes('Cerrar las ventanas')) e.click();
      });
    });
    await new Promise(r => setTimeout(r, 1000));
    
    // Click "Añadir un permiso"
    await pg.evaluate(() => {
      const all = Array.from(document.querySelectorAll('*'));
      const btn = all.find(e => e.offsetParent !== null && e.textContent.trim() === 'Añadir un permiso');
      if (btn) btn.click();
    });
    await new Promise(r => setTimeout(r, 1500));
    
    // Type permission
    const permInput = await pg.$('input[placeholder="Añadir un permiso"]');
    if (!permInput) { console.log('NO INPUT'); b.disconnect(); return; }
    await permInput.type('pages_show_list', { delay: 30 });
    await new Promise(r => setTimeout(r, 2000));
    
    // Get the FULL DOM tree of the dropdown area
    const domTree = await pg.evaluate(() => {
      const input = document.querySelector('input[placeholder="Añadir un permiso"]');
      if (!input) return 'input not found';
      
      // Get the parent form/container
      const container = input.closest('div, form, section');
      if (!container) return 'no container';
      
      // Get all elements within the container that are visible
      const all = Array.from(container.querySelectorAll('*'));
      const visible = all.filter(e => {
        const style = window.getComputedStyle(e);
        return e.offsetParent !== null && style.display !== 'none' && style.visibility !== 'hidden';
      });
      
      const result = [];
      for (const el of visible.slice(0, 30)) {
        const rect = el.getBoundingClientRect();
        result.push({
          tag: el.tagName,
          text: el.textContent.trim().substring(0, 50),
          role: el.getAttribute('role'),
          id: el.id,
          cls: el.className.substring(0, 40),
          rect: `${Math.round(rect.x)},${Math.round(rect.y)} ${Math.round(rect.w)}x${Math.round(rect.h)}`,
          childCount: el.children.length
        });
      }
      return result;
    });
    console.log('DOM around permission input:');
    for (const item of domTree) {
      console.log(`  ${item.tag} #${item.id} "${item.text}" role=${item.role} rect=${item.rect} children=${item.childCount}`);
    }
    
    b.disconnect();
  } catch (e) { console.error('ERR:', e.message); }
  process.exit(0);
})();