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
    await permInput.type('pages_show_list', { delay: 20 });
    await new Promise(r => setTimeout(r, 1500));
    
    // Press ArrowDown to select the first dropdown item, then Enter
    await pg.keyboard.press('ArrowDown');
    await new Promise(r => setTimeout(r, 500));
    await pg.keyboard.press('Enter');
    await new Promise(r => setTimeout(r, 1000));
    
    // Verify
    let text = await pg.evaluate(() => document.body.innerText);
    let hasPerm = text.includes('pages_show_list');
    console.log('After select (keyboard): has perm =', hasPerm);
    
    if (!hasPerm) {
      // Try clicking the item directly via mouse click at coordinates
      const itemPos = await pg.evaluate(() => {
        const all = Array.from(document.querySelectorAll('*'));
        const item = all.find(e => e.offsetParent !== null && e.textContent.trim() === 'pages_show_list');
        if (!item) return null;
        const r = item.getBoundingClientRect();
        return { x: r.x + r.width/2, y: r.y + r.height/2, text: item.tagName };
      });
      if (itemPos) {
        console.log('Trying mouse click at', itemPos);
        await pg.mouse.click(itemPos.x, itemPos.y);
        await new Promise(r => setTimeout(r, 1000));
      }
      
      // Try adding via JavaScript keyboard events directly
      await pg.evaluate(() => {
        const all = Array.from(document.querySelectorAll('*'));
        const item = all.find(e => e.offsetParent !== null && e.textContent.trim() === 'pages_show_list');
        if (item) {
          item.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true, view: window }));
          item.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: true, view: window }));
          item.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window }));
        }
      });
      await new Promise(r => setTimeout(r, 1000));
    }
    
    text = await pg.evaluate(() => document.body.innerText);
    hasPerm = text.includes('pages_show_list');
    console.log('Final: has perm =', hasPerm);
    
    // Now add pages_read_engagement
    if (hasPerm) {
      // Add second permission
      await pg.evaluate(() => {
        const all = Array.from(document.querySelectorAll('*'));
        const btn = all.find(e => e.offsetParent !== null && e.textContent.trim() === 'Añadir un permiso');
        if (btn) btn.click();
      });
      await new Promise(r => setTimeout(r, 1500));
      const input2 = await pg.$('input[placeholder="Añadir un permiso"]');
      if (input2) {
        await input2.type('pages_read_engagement', { delay: 20 });
        await new Promise(r => setTimeout(r, 1500));
        await pg.keyboard.press('ArrowDown');
        await new Promise(r => setTimeout(r, 500));
        await pg.keyboard.press('Enter');
        await new Promise(r => setTimeout(r, 1000));
      }
      
      // Now click Generate Access Token
      console.log('Generating token with permissions...');
      await pg.evaluate(() => {
        const all = Array.from(document.querySelectorAll('*'));
        const btn = all.find(e => e.offsetParent !== null && e.textContent.trim() === 'Generate Access Token');
        if (btn) btn.click();
      });
      await new Promise(r => setTimeout(r, 5000));
      
      // Check for the OAuth popup
      const allPages = await b.pages();
      if (allPages.length > 1) {
        const popup = allPages[allPages.length - 1];
        if (popup.url().includes('facebook.com') && (popup.url().includes('dialog') || popup.url().includes('oauth'))) {
          console.log('OAuth popup found!');
          await popup.bringToFront();
          await new Promise(r => setTimeout(r, 3000));
          const popupText = await popup.evaluate(() => document.body.innerText).catch(() => '');
          console.log('Popup:', popupText.substring(0, 1000));
          
          // Click allow
          await popup.evaluate(() => {
            const all = Array.from(document.querySelectorAll('*'));
            const btn = all.find(e => e.offsetParent !== null && 
              (e.textContent.trim() === 'Continue' || e.textContent.trim() === 'Continuar'));
            if (btn) btn.click();
          });
          console.log('Clicked allow');
          await new Promise(r => setTimeout(r, 3000));
        }
      } else {
        console.log('No popup appeared');
      }
      
      // Get the new token
      const tokenInput = await pg.$('input[placeholder="Identificador de acceso"]');
      if (tokenInput) {
        const token = await pg.evaluate(el => el.value, tokenInput);
        console.log('New token:', token.substring(0, 60) + '...');
        
        // Save token to file for later use
        require('fs').writeFileSync('_new_token.txt', token);
        console.log('Token saved to _new_token.txt');
      }
    }
    
    b.disconnect();
  } catch (e) { console.error('ERR:', e.message); }
  process.exit(0);
})();