const p = require('puppeteer');
(async () => {
  try {
    const b = await p.connect({ browserURL: 'http://127.0.0.1:9222', defaultViewport: null });
    const pages = await b.pages();
    const pg = pages.find(x => x.url().includes('apps')) || pages[0];
    
    // Click "Mostrar" by finding the actual button element
    const clickResult = await pg.evaluate(() => {
      const all = Array.from(document.querySelectorAll('div[role="button"], button, span, a, label'));
      const btn = all.find(e => e.offsetParent !== null && e.textContent.trim() === 'Mostrar');
      if (!btn) return 'NOT FOUND';
      btn.click();
      return 'CLICKED: ' + btn.tagName + ' role=' + btn.getAttribute('role');
    });
    console.log('Click:', clickResult);
    await new Promise(r => setTimeout(r, 3000));
    
    // Now look for any text that looks like a secret (alphanumeric, 32+ chars)
    const text = await pg.evaluate(() => document.body.innerText);
    const lines = text.split('\n').filter(l => l.length > 30 && /^[A-Za-z0-9_-]{20,}$/.test(l.trim()));
    console.log('Potential secrets:', lines);
    
    // Also scan all elements for long text that appeared
    const newTexts = await pg.evaluate(() => {
      const all = Array.from(document.querySelectorAll('div, span, code'));
      const long = all.filter(e => e.offsetParent !== null && e.childElementCount === 0 && e.textContent.trim().length > 30 && /^[A-Za-z0-9_-]{20,}$/.test(e.textContent.trim()));
      return long.map(e => e.textContent.trim());
    });
    console.log('Potential secrets from DOM:', newTexts);
    
    // Try reading the input value again after clicking
    const valAfter = await pg.evaluate(() => {
      const inp = document.querySelector('#js_bv');
      if (!inp) return 'no input';
      inp.type = 'text';
      // Also try to get from react fiber
      const key = Object.keys(inp).find(k => k.startsWith('__react'));
      return 'value=' + inp.value + ' type=' + inp.type + ' reactKey=' + key;
    });
    console.log('After click state:', valAfter);
    
    b.disconnect();
  } catch (e) { console.error('ERR:', e.message); }
  process.exit(0);
})();