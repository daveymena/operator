const p = require('puppeteer');
(async () => {
  try {
    const b = await p.connect({ browserURL: 'http://127.0.0.1:9222', defaultViewport: null });
    const pages = await b.pages();
    const pg = pages[0];
    
    // Listen for new targets BEFORE clicking
    let popupTarget = null;
    b.on('targetcreated', target => {
      console.log('New target:', target.url().substring(0, 200));
      if (target.url().includes('facebook.com') || target.type() === 'page') {
        popupTarget = target;
      }
    });
    
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
    
    // Click Generate Access Token
    await pg.evaluate(() => {
      const all = Array.from(document.querySelectorAll('*'));
      const btn = all.find(e => e.offsetParent !== null && e.textContent.trim() === 'Generate Access Token');
      if (btn) btn.click();
    });
    console.log('Clicked Generate Access Token');
    await new Promise(r => setTimeout(r, 3000));
    
    // Check if popup was created
    if (popupTarget) {
      console.log('Popup target found!');
      const popupPage = await popupTarget.page();
      await popupPage.bringToFront();
      await new Promise(r => setTimeout(r, 3000));
      const text = await popupPage.evaluate(() => document.body.innerText).catch(() => '');
      console.log('Popup text:', text.substring(0, 2000));
      
      // If it's the OAuth dialog, grant permissions
      if (text.includes('pages_show_list') || text.includes('pages_read_engagement')) {
        // Click Continue/Allow
        await popupPage.evaluate(() => {
          const all = Array.from(document.querySelectorAll('*'));
          const btn = all.find(e => e.offsetParent !== null && 
            (e.textContent.trim() === 'Continue' || e.textContent.trim() === 'Continuar' ||
             e.textContent.trim() === 'Allow' || e.textContent.trim() === 'Permitir' ||
             e.textContent.includes('Guardar')));
          if (btn) btn.click();
        });
        console.log('Clicked allow in popup');
        await new Promise(r => setTimeout(r, 3000));
      }
    } else {
      console.log('No popup target created');
    }
    
    // Check if token was updated
    const tokenInput = await pg.$('input[placeholder="Identificador de acceso"]');
    if (tokenInput) {
      const token = await pg.evaluate(el => el.value, tokenInput);
      console.log('Token:', token.substring(0, 60) + '...');
    }
    
    b.disconnect();
  } catch (e) { console.error('ERR:', e.message); }
  process.exit(0);
})();