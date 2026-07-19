const p = require('puppeteer');
(async () => {
  try {
    const b = await p.connect({ browserURL: 'http://127.0.0.1:9222', defaultViewport: null });
    const pages = await b.pages();
    const pg = pages[0];
    
    // Go to Graph API Explorer  
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
    
    // Click "Añadir un permiso" to open dropdown
    await pg.evaluate(() => {
      const all = Array.from(document.querySelectorAll('*'));
      const btn = all.find(e => e.offsetParent !== null && e.textContent.trim() === 'Añadir un permiso');
      if (btn) btn.click();
    });
    await new Promise(r => setTimeout(r, 1500));
    
    // Find the permission input
    const permInput = await pg.$('input[placeholder="Añadir un permiso"]');
    if (!permInput) {
      console.log('Permission input not found');
      b.disconnect();
      return;
    }
    
    // Type permission
    await permInput.type('pages_show_list', { delay: 30 });
    await new Promise(r => setTimeout(r, 1500));
    
    // Look for the dropdown item and CLICK on it (not just Enter)
    const clicked = await pg.evaluate(() => {
      const all = Array.from(document.querySelectorAll('div, span, li, [role="option"], [role="menuitem"]'));
      const item = all.find(e => e.offsetParent !== null && e.textContent.trim() === 'pages_show_list');
      if (item) {
        item.click();
        return true;
      }
      // Try clicking the "1 resultado" area
      const result = all.find(e => e.offsetParent !== null && e.textContent.trim().includes('Se ha encontrado 1 resultado'));
      if (result) {
        // click the parent which might contain clickable items
        const parent = result.parentElement;
        const child = parent ? parent.querySelector('[role="option"], [role="menuitem"], li, a') : null;
        if (child) { child.click(); return true; }
      }
      return false;
    });
    console.log('Clicked permission item:', clicked);
    await new Promise(r => setTimeout(r, 1000));
    
    // Add pages_read_engagement
    await pg.evaluate(() => {
      const all = Array.from(document.querySelectorAll('*'));
      const btn = all.find(e => e.offsetParent !== null && e.textContent.trim() === 'Añadir un permiso');
      if (btn) btn.click();
    });
    await new Promise(r => setTimeout(r, 1500));
    const input2 = await pg.$('input[placeholder="Añadir un permiso"]');
    if (input2) {
      await input2.type('pages_read_engagement', { delay: 30 });
      await new Promise(r => setTimeout(r, 1500));
      await pg.evaluate(() => {
        const all = Array.from(document.querySelectorAll('*'));
        const item = all.find(e => e.offsetParent !== null && e.textContent.trim() === 'pages_read_engagement');
        if (item) item.click();
      });
      await new Promise(r => setTimeout(r, 1000));
    }
    
    // Add pages_messaging
    await pg.evaluate(() => {
      const all = Array.from(document.querySelectorAll('*'));
      const btn = all.find(e => e.offsetParent !== null && e.textContent.trim() === 'Añadir un permiso');
      if (btn) btn.click();
    });
    await new Promise(r => setTimeout(r, 1500));
    const input3 = await pg.$('input[placeholder="Añadir un permiso"]');
    if (input3) {
      await input3.type('pages_messaging', { delay: 30 });
      await new Promise(r => setTimeout(r, 1500));
      await pg.evaluate(() => {
        const all = Array.from(document.querySelectorAll('*'));
        const item = all.find(e => e.offsetParent !== null && e.textContent.trim() === 'pages_messaging');
        if (item) item.click();
      });
      await new Promise(r => setTimeout(r, 1000));
    }
    
    // Verify permissions were added
    const permText = await pg.evaluate(() => document.body.innerText);
    const hasPerms = permText.includes('pages_show_list');
    console.log('Has pages_show_list permission:', hasPerms);
    console.log('Permissions section:', permText.substring(
      Math.max(0, permText.indexOf('Permisos')), 
      permText.indexOf('Permisos') + 200
    ));
    
    // Now click Generate Access Token
    console.log('\nNow clicking Generate Access Token...');
    await pg.evaluate(() => {
      const all = Array.from(document.querySelectorAll('*'));
      const btn = all.find(e => e.offsetParent !== null && e.textContent.trim() === 'Generate Access Token');
      if (btn) btn.click();
    });
    await new Promise(r => setTimeout(r, 6000));
    
    // Check for popup
    const allPages = await b.pages();
    console.log('Pages after generate:', allPages.length);
    for (let i = 0; i < allPages.length; i++) {
      console.log(`[${i}] ${allPages[i].url().substring(0, 250)}`);
    }
    
    // If a popup appeared, handle it
    if (allPages.length > 1) {
      const popup = allPages[allPages.length - 1];
      if (popup.url().includes('facebook.com') && (popup.url().includes('dialog') || popup.url().includes('oauth'))) {
        console.log('\nOAuth dialog found!');
        await popup.bringToFront();
        await new Promise(r => setTimeout(r, 3000));
        const popupText = await popup.evaluate(() => document.body.innerText).catch(() => '');
        console.log('Dialog:', popupText.substring(0, 2000));
        
        // Look for Continue/Allow button
        await popup.evaluate(() => {
          const all = Array.from(document.querySelectorAll('*'));
          const btn = all.find(e => e.offsetParent !== null && 
            (e.textContent.trim() === 'Continue' || e.textContent.trim() === 'Continuar' || 
             e.textContent.trim() === 'Allow' || e.textContent.trim() === 'Permitir' ||
             e.textContent.includes('Guardar')));
          if (btn) btn.click();
        });
        console.log('Clicked allow');
        await new Promise(r => setTimeout(r, 3000));
        
        // Check result
        const resultText = await popup.evaluate(() => document.body.innerText).catch(() => '');
        console.log('After allow:', resultText.substring(0, 2000));
      }
    }
    
    // Get the token from the main page
    const tokenInput = await pg.$('input[placeholder="Identificador de acceso"]');
    if (tokenInput) {
      const token = await pg.evaluate(el => el.value, tokenInput);
      console.log('\nAccess Token:', token.substring(0, 50) + '...');
    }
    
    b.disconnect();
  } catch (e) { console.error('ERR:', e.message); }
  process.exit(0);
})();