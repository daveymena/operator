const p = require('puppeteer');
(async () => {
  try {
    const b = await p.connect({ browserURL: 'http://127.0.0.1:9222', defaultViewport: null });
    const pages = await b.pages();
    const pg = pages[0];
    
    // Navigate to Messenger API settings
    await pg.goto('https://developers.facebook.com/apps/4238613976451604/use_cases/customize/messenger_api_settings/', {
      waitUntil: 'load', timeout: 15000
    }).catch(() => {});
    await new Promise(r => setTimeout(r, 4000));
    
    // Close any popups
    await pg.evaluate(() => {
      document.querySelectorAll('*').forEach(e => {
        if (e.offsetParent !== null && e.textContent.trim().includes('Cerrar')) e.click();
      });
    });
    await new Promise(r => setTimeout(r, 1000));
    
    // Look for any existing page token or connected page info
    const text = await pg.evaluate(() => document.body.innerText);
    console.log('Messenger settings:', text.substring(0, 4000));
    
    // Check for page token input or connected pages
    const inputs = await pg.evaluate(() => {
      return Array.from(document.querySelectorAll('input')).filter(i => i.offsetParent !== null).map(i => ({
        id: i.id, val: i.value.substring(0, 30), pl: i.placeholder
      }));
    });
    console.log('\nInputs:', JSON.stringify(inputs));
    
    b.disconnect();
  } catch (e) { console.error('ERR:', e.message); }
  process.exit(0);
})();