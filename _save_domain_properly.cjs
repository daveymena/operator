const p = require('puppeteer');
(async () => {
  try {
    const b = await p.connect({ browserURL: 'http://127.0.0.1:9222', defaultViewport: null });
    const pages = await b.pages();
    const pg = pages[0];
    
    await pg.goto('https://developers.facebook.com/apps/4238613976451604/settings/basic/', {
      waitUntil: 'domcontentloaded', timeout: 15000
    }).catch(() => {});
    await new Promise(r => setTimeout(r, 4000));
    
    // Find the domain input
    const domainId = await pg.evaluate(() => {
      const all = Array.from(document.querySelectorAll('*'));
      const label = all.find(e => e.offsetParent !== null && e.textContent.trim() === 'Dominios de la aplicación');
      if (!label) return null;
      const parent = label.closest('div');
      const input = parent ? parent.querySelector('input') : null;
      return input ? input.id : null;
    });
    
    if (domainId) {
      console.log('Domain input ID:', domainId);
      await pg.click('#' + domainId, { clickCount: 3 });
      await pg.keyboard.press('Delete');
      await new Promise(r => setTimeout(r, 300));
      await pg.keyboard.type('developers.facebook.com', { delay: 20 });
      console.log('Typed domain');
      await new Promise(r => setTimeout(r, 500));
      
      // Scroll to bottom
      await pg.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
      await new Promise(r => setTimeout(r, 500));
      
      // Find and click "Guardar cambios" button by text
      const btnPos = await pg.evaluate(() => {
        const all = Array.from(document.querySelectorAll('div[role="button"], button'));
        const btn = all.find(e => e.offsetParent !== null && (e.textContent.trim() === 'Guardar cambios' || e.textContent.trim() === 'Save Changes'));
        if (!btn) return null;
        const r = btn.getBoundingClientRect();
        return { x: r.x + r.width/2, y: r.y + r.height/2 };
      });
      
      if (btnPos) {
        await pg.mouse.click(btnPos.x, btnPos.y);
        console.log('Clicked save at', btnPos);
      } else {
        console.log('Save button not found');
      }
      await new Promise(r => setTimeout(r, 4000));
      
      // Verify save by reading domain value
      const savedVal = await pg.evaluate((id) => {
        const inp = document.querySelector('#' + id);
        return inp ? inp.value : 'no input';
      }, domainId);
      console.log('Saved domain value:', savedVal);
      
      // Try OAuth
      const oauthUrl = 'https://www.facebook.com/v21.0/dialog/oauth?' +
        'client_id=4238613976451604' +
        '&redirect_uri=https://developers.facebook.com/tools/explorer/' +
        '&response_type=token,granted_scopes' +
        '&scope=pages_show_list,pages_read_engagement,pages_messaging,pages_manage_metadata' +
        '&auth_type=rerequest';
      await pg.goto(oauthUrl, { waitUntil: 'load', timeout: 20000 }).catch(() => {});
      await new Promise(r => setTimeout(r, 5000));
      
      const text = await pg.evaluate(() => document.body.innerText);
      const url = pg.url();
      console.log('OAuth URL:', url.substring(0, 300));
      console.log('OAuth:', text.substring(0, 3000));
    } else {
      console.log('Domain input not found');
    }
    b.disconnect();
  } catch (e) { console.error('ERR:', e.message); }
  process.exit(0);
})();