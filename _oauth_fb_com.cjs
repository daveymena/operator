const p = require('puppeteer');
(async () => {
  try {
    const b = await p.connect({ browserURL: 'http://127.0.0.1:9222', defaultViewport: null });
    const pages = await b.pages();
    const pg = pages[0];
    
    // Step 1: Go to settings and add domain www.facebook.com
    await pg.goto('https://developers.facebook.com/apps/4238613976451604/settings/basic/', {
      waitUntil: 'domcontentloaded', timeout: 15000
    }).catch(() => {});
    await new Promise(r => setTimeout(r, 4000));
    
    // Find the domain input
    const domainInfo = await pg.evaluate(() => {
      const all = Array.from(document.querySelectorAll('*'));
      const label = all.find(e => e.offsetParent !== null && e.textContent.trim() === 'Dominios de la aplicación');
      if (!label) return null;
      const parent = label.closest('div');
      const input = parent ? parent.querySelector('input') : null;
      if (!input) return null;
      return { id: input.id, y: Math.round(input.getBoundingClientRect().y) };
    });
    
    if (domainInfo) {
      console.log('Domain input:', JSON.stringify(domainInfo));
      
      // Scroll to the domain field
      await pg.evaluate((y) => window.scrollTo(0, Math.max(0, y - 100)), domainInfo.y);
      await new Promise(r => setTimeout(r, 500));
      
      // Type the domain
      await pg.click('#' + domainInfo.id, { clickCount: 3 });
      await pg.keyboard.press('Delete');
      await new Promise(r => setTimeout(r, 200));
      await pg.keyboard.type('www.facebook.com', { delay: 20 });
      console.log('Typed domain: www.facebook.com');
      await new Promise(r => setTimeout(r, 500));
    }
    
    // Scroll to bottom to find save button
    await pg.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await new Promise(r => setTimeout(r, 500));
    
    // Click Guardar cambios via mouse at its coordinates
    const savePos = await pg.evaluate(() => {
      const all = Array.from(document.querySelectorAll('div, span, button, a'));
      const btn = all.find(e => e.offsetParent !== null && 
        e.childElementCount === 0 && 
        (e.textContent.trim() === 'Guardar cambios' || e.textContent.trim() === 'Save Changes')
      );
      if (!btn) return null;
      const r = btn.getBoundingClientRect();
      return { x: r.x + r.width/2, y: r.y + r.height/2 };
    });
    
    if (savePos) {
      await pg.mouse.click(savePos.x, savePos.y);
      console.log('Clicked save at', savePos);
      await new Promise(r => setTimeout(r, 3000));
    }
    
    // Verify save by checking domain value after page reload
    const valAfter = await pg.evaluate((id) => {
      const inp = document.querySelector('#' + id);
      return inp ? inp.value : 'no input';
    }, domainInfo.id);
    console.log('After save, domain value:', valAfter);
    
    // Step 2: Try OAuth with www.facebook.com redirect
    console.log('\n--- Trying OAuth with www.facebook.com redirect ---');
    const oauthUrl = 'https://www.facebook.com/v21.0/dialog/oauth?' +
      'client_id=4238613976451604' +
      '&redirect_uri=https://www.facebook.com/' +
      '&response_type=token' +
      '&scope=pages_show_list,pages_read_engagement,pages_messaging,pages_manage_metadata' +
      '&auth_type=rerequest';
    await pg.goto(oauthUrl, { waitUntil: 'load', timeout: 20000 }).catch(() => {});
    await new Promise(r => setTimeout(r, 5000));
    
    const url = pg.url();
    const text = await pg.evaluate(() => document.body.innerText);
    console.log('OAuth URL:', url.substring(0, 400));
    console.log('OAuth:', text.substring(0, 2000));
    
    // Check if URL has access_token (successful redirect)
    if (url.includes('access_token=')) {
      const tokenMatch = url.match(/access_token=([^&]+)/);
      if (tokenMatch) {
        console.log('\nSUCCESS! TOKEN:', tokenMatch[1].substring(0, 60));
      }
    }
    
    b.disconnect();
  } catch (e) { console.error('ERR:', e.message); }
  process.exit(0);
})();