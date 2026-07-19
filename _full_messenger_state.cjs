const p = require('puppeteer');
(async () => {
  try {
    const b = await p.connect({ browserURL: 'http://127.0.0.1:9222', defaultViewport: null });
    const pages = await b.pages();
    const pg = pages[0];
    
    const fullUrl = 'https://developers.facebook.com/apps/4238613976451604/use_cases/customize/messenger_api_settings/' +
      '?product_route=messenger&business_id=4482432028697067&use_case_enum=FACEBOOK_MESSAGING&selected_tab=messenger_api_settings';
    await pg.goto(fullUrl, { waitUntil: 'load', timeout: 15000 }).catch(() => {});
    await new Promise(r => setTimeout(r, 5000));
    
    // Close popups first
    await pg.evaluate(() => {
      document.querySelectorAll('*').forEach(e => {
        if (e.offsetParent !== null && (e.textContent.trim() === 'Cerrar' || e.textContent.includes('Cerrar las ventanas'))) {
          e.click();
        }
      });
    });
    await new Promise(r => setTimeout(r, 2000));
    
    // Click "Ver más" to expand collapsed sections
    await pg.evaluate(() => {
      const all = Array.from(document.querySelectorAll('*'));
      const verMas = all.find(e => e.offsetParent !== null && e.childElementCount === 0 && e.textContent.trim() === 'Ver más');
      if (verMas) verMas.click();
    });
    await new Promise(r => setTimeout(r, 1000));
    
    const text = await pg.evaluate(() => document.body.innerText);
    console.log('=== Full Messenger Settings ===');
    console.log(text.substring(0, 5000));
    b.disconnect();
  } catch (e) { console.error('ERR:', e.message); }
  process.exit(0);
})();