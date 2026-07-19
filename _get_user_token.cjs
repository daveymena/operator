const p = require('puppeteer');
(async () => {
  try {
    const b = await p.connect({ browserURL: 'http://127.0.0.1:9222', defaultViewport: null });
    const pages = await b.pages();
    const pg = pages.find(x => x.url().includes('accesstoken')) || pages[0];
    
    // Click "Continue"
    await pg.evaluate(() => {
      const all = Array.from(document.querySelectorAll('*'));
      const btn = all.find(e => e.offsetParent !== null && e.childElementCount === 0 && e.textContent.trim() === 'Continue');
      if (btn) { btn.click(); return true; }
      return false;
    });
    console.log('Clicked Continue');
    await new Promise(r => setTimeout(r, 3000));
    
    // Read the page to find the token
    const text = await pg.evaluate(() => document.body.innerText);
    const url = pg.url();
    console.log('URL:', url.substring(0, 200));
    console.log('After Continue:', text.substring(0, 3000));
    
    // Check all input values for token
    const tokens = await pg.evaluate(() => {
      const all = Array.from(document.querySelectorAll('input, div, span, code'));
      const items = all.filter(e => {
        const t = e.textContent.trim();
        return e.offsetParent !== null && t.length > 50 && t.startsWith('EAA') && !t.includes(' ');
      });
      return items.map(e => e.textContent.trim());
    });
    console.log('Potential tokens from page:', tokens);
    
    // Also check the user token input
    const userTokenVal = await pg.evaluate(() => {
      const all = Array.from(document.querySelectorAll('input'));
      const inputs = all.filter(i => i.offsetParent !== null && i.value && i.value.length > 30 && i.value.startsWith('EAA'));
      return inputs.map(i => ({ id: i.id, val: i.value.substring(0, 50) }));
    });
    console.log('Token inputs:', userTokenVal);
    
    b.disconnect();
  } catch (e) { console.error('ERR:', e.message); }
  process.exit(0);
})();