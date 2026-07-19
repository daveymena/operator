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
    
    // Get the HTML around the dropdown
    const dropdownHtml = await pg.evaluate(() => {
      const all = Array.from(document.querySelectorAll('*'));
      // Find the element that contains "Se ha encontrado"
      const resultDiv = all.find(e => e.offsetParent !== null && e.textContent.trim().includes('Se ha encontrado'));
      if (!resultDiv) return 'no result div';
      const parent = resultDiv.closest('div[role="listbox"], div[role="menu"], ul, .dropdown, [class*="menu"]');
      if (!parent) {
        // Get all nearby elements
        const siblings = Array.from(resultDiv.parentElement.querySelectorAll('*'));
        return siblings.filter(e => e.offsetParent !== null).map(e => ({
          tag: e.tagName,
          text: e.textContent.trim().substring(0, 40),
          role: e.getAttribute('role'),
          cls: e.className.substring(0, 50)
        })).filter(e => e.text).slice(0, 10);
      }
      const items = Array.from(parent.querySelectorAll('*'));
      return items.filter(e => e.offsetParent !== null).map(e => ({
        tag: e.tagName,
        text: e.textContent.trim().substring(0, 40),
        role: e.getAttribute('role'),
        cls: e.className.substring(0, 50)
      }));
    });
    console.log('Dropdown HTML:');
    console.log(JSON.stringify(dropdownHtml, null, 2));
    
    // Try to find the actual clickable permission item
    const itemClicked = await pg.evaluate(() => {
      // Approach 1: Find by role
      const items = Array.from(document.querySelectorAll('[role="option"], [role="menuitem"], [role="listbox"] > *'));
      for (const item of items) {
        const t = item.textContent.trim();
        if (t === 'pages_show_list' || t.startsWith('pages_show_list')) {
          item.click();
          return 'clicked by role: ' + t;
        }
      }
      // Approach 2: Find the exact label/div
      const all = Array.from(document.querySelectorAll('*'));
      for (const el of all) {
        if (el.offsetParent === null) continue;
        const t = el.textContent.trim();
        if (t === 'pages_show_list' && el.childElementCount === 0) {
          el.click();
          return 'clicked by exact match: ' + t;
        }
      }
      // Approach 3: Find the container and click it
      const result = all.find(e => e.offsetParent !== null && e.textContent.trim().includes('Se ha encontrado 1 resultado'));
      if (result) {
        const container = result.parentElement || result;
        const clickable = container.querySelector('[role="button"], [role="option"], button, a');
        if (clickable) {
          clickable.click();
          return 'clicked container child';
        }
        // Click the container itself
        container.click();
        return 'clicked container';
      }
      return 'NOT FOUND';
    });
    console.log('\nItem clicked:', itemClicked);
    await new Promise(r => setTimeout(r, 2000));
    
    // Check if permission was added
    const text = await pg.evaluate(() => document.body.innerText);
    console.log('\nAfter adding perm:');
    const permIdx = text.indexOf('Permisos');
    if (permIdx >= 0) console.log(text.substring(permIdx, permIdx + 300));
    
    b.disconnect();
  } catch (e) { console.error('ERR:', e.message); }
  process.exit(0);
})();