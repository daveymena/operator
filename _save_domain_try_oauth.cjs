const p = require('puppeteer');
(async () => {
  try {
    const b = await p.connect({ browserURL: 'http://127.0.0.1:9222', defaultViewport: null });
    const pages = await b.pages();
    const pg = pages[0];
    
    // Go to settings
    await pg.goto('https://developers.facebook.com/apps/4238613976451604/settings/basic/', {
      waitUntil: 'domcontentloaded', timeout: 15000
    }).catch(() => {});
    await new Promise(r => setTimeout(r, 4000));
    
    // Find the domain input (it will have a dynamic ID)
    const domainInfo = await pg.evaluate(() => {
      const all = Array.from(document.querySelectorAll('*'));
      const label = all.find(e => e.offsetParent !== null && e.textContent.trim() === 'Dominios de la aplicación');
      if (!label) return 'no label';
      const parent = label.closest('div, section, label, td');
      if (!parent) return 'no parent';
      const input = parent.querySelector('input');
      if (!input) return 'no input in parent';
      return JSON.stringify({ id: input.id, value: input.value, parentTag: parent.tagName });
    });
    console.log('Domain info:', domainInfo);
    const info = JSON.parse(domainInfo);
    
    // Fill the domain
    await pg.evaluate((id) => {
      const inp = document.querySelector('#' + id);
      if (inp) inp.value = 'developers.facebook.com';
    }, info.id);
    console.log('Filled domain');
    await new Promise(r => setTimeout(r, 500));
    
    // Try to find "Guardar cambios" button
    await pg.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await new Promise(r => setTimeout(r, 500));
    
    const saved = await pg.evaluate(() => {
      const all = Array.from(document.querySelectorAll('*'));
      const btn = all.find(e => e.offsetParent !== null && 
        e.childElementCount === 0 && 
        (e.textContent.trim() === 'Guardar cambios' || e.textContent.trim() === 'Save Changes')
      );
      if (btn) {
        btn.click();
        return 'clicked';
      }
      return 'not found';
    });
    console.log('Save button:', saved);
    await new Promise(r => setTimeout(r, 4000));
    
    // Now try OAuth
    console.log('\nTrying OAuth...');
    const oauthUrl = 'https://www.facebook.com/v21.0/dialog/oauth?' +
      'client_id=4238613976451604' +
      '&redirect_uri=https://developers.facebook.com/tools/explorer/' +
      '&response_type=token,granted_scopes' +
      '&scope=pages_show_list,pages_read_engagement,pages_messaging,pages_manage_metadata';
    await pg.goto(oauthUrl, { waitUntil: 'load', timeout: 20000 }).catch(() => {});
    await new Promise(r => setTimeout(r, 5000));
    
    const url = pg.url();
    const text = await pg.evaluate(() => document.body.innerText);
    console.log('OAuth URL:', url.substring(0, 300));
    console.log('OAuth response:', text.substring(0, 3000));
    b.disconnect();
  } catch (e) { console.error('ERR:', e.message); }
  process.exit(0);
})();