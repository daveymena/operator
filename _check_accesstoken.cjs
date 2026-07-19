const p = require('puppeteer');
(async () => {
  try {
    const b = await p.connect({ browserURL: 'http://127.0.0.1:9222', defaultViewport: null });
    const pages = await b.pages();
    const pg = pages[0];
    
    // Go to Access Token Tool
    await pg.goto('https://developers.facebook.com/tools/accesstoken/', {
      waitUntil: 'load', timeout: 15000
    }).catch(() => {});
    await new Promise(r => setTimeout(r, 4000));
    
    // Get the existing User Token value
    const info = await pg.evaluate(() => {
      const all = Array.from(document.querySelectorAll('input'));
      const inputs = all.filter(i => i.offsetParent !== null).map(i => ({
        id: i.id,
        val: i.value.substring(0, 60),
        pl: i.placeholder
      }));
      // Also find text that looks like a token
      const textEls = Array.from(document.querySelectorAll('div, span, code'));
      const tokens = textEls.filter(e => {
        const t = e.textContent.trim();
        return e.offsetParent !== null && t.length > 50 && t.startsWith('EAA');
      }).map(e => e.textContent.trim().substring(0, 60));
      return { inputs, tokens };
    });
    console.log('Current state:', JSON.stringify(info));
    
    // Check if there's a "Debes conceder permisos" button or already a token
    const text = await pg.evaluate(() => document.body.innerText);
    const userTokenSection = text.substring(
      Math.max(0, text.indexOf('User Token') - 20),
      text.indexOf('User Token') + 200
    );
    console.log('User Token section:', userTokenSection);
    
    b.disconnect();
  } catch (e) { console.error('ERR:', e.message); }
  process.exit(0);
})();