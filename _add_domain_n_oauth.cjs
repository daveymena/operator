const p = require('puppeteer');
(async () => {
  try {
    const b = await p.connect({ browserURL: 'http://127.0.0.1:9222', defaultViewport: null });
    const pages = await b.pages();
    const pg = pages.find(x => x.url().includes('settings')) || pages[0];
    
    // Fill in the domain field
    await pg.focus('#js_ck');
    await pg.keyboard.down('Control');
    await pg.keyboard.press('a');
    await pg.keyboard.up('Control');
    await pg.keyboard.press('Delete');
    await new Promise(r => setTimeout(r, 200));
    await pg.keyboard.type('developers.facebook.com', { delay: 10 });
    console.log('Typed domain');
    await new Promise(r => setTimeout(r, 1000));
    
    // Now fill in the Privacy Policy URL (needed for OAuth)
    // js_d0 is the privacy policy URL for login dialog
    await pg.focus('#js_d0');
    await pg.keyboard.down('Control');
    await pg.keyboard.press('a');
    await pg.keyboard.up('Control');
    await pg.keyboard.press('Delete');
    await new Promise(r => setTimeout(r, 200));
    await pg.keyboard.type('https://tecnovariedades.easypanel.host/privacy', { delay: 10 });
    console.log('Typed privacy URL');
    
    // Scroll down to find "Guardar cambios" button
    await pg.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await new Promise(r => setTimeout(r, 1000));
    
    // Click "Guardar cambios"
    await pg.evaluate(() => {
      const all = Array.from(document.querySelectorAll('*'));
      // Look for button by text
      const saveBtn = all.find(e => e.offsetParent !== null && e.childElementCount === 0 && (e.textContent.trim() === 'Guardar cambios' || e.textContent.trim() === 'Save Changes'));
      if (saveBtn) {
        saveBtn.click();
        return true;
      }
      return false;
    });
    await new Promise(r => setTimeout(r, 3000));
    
    console.log('Saved changes');
    
    // Now try the OAuth dialog again
    const oauthUrl = 'https://www.facebook.com/v21.0/dialog/oauth?' +
      'client_id=4238613976451604' +
      '&redirect_uri=https://developers.facebook.com/tools/explorer/' +
      '&response_type=token,granted_scopes' +
      '&scope=pages_show_list,pages_read_engagement,pages_messaging,pages_manage_metadata' +
      '&auth_type=rerequest';
    
    await pg.goto(oauthUrl, { waitUntil: 'load', timeout: 20000 }).catch(() => {});
    await new Promise(r => setTimeout(r, 5000));
    
    const url = pg.url();
    const text = await pg.evaluate(() => document.body.innerText);
    console.log('URL:', url.substring(0, 300));
    console.log('OAuth response:', text.substring(0, 3000));
    
    b.disconnect();
  } catch (e) { console.error('ERR:', e.message); }
  process.exit(0);
})();