const p = require('puppeteer');
(async () => {
  try {
    const b = await p.connect({ browserURL: 'http://127.0.0.1:9222', defaultViewport: null });
    const pages = await b.pages();
    const pg = pages[0];
    
    // Scroll to Step 2
    await pg.evaluate(() => {
      const all = Array.from(document.querySelectorAll('*'));
      const step2 = all.find(e => e.offsetParent !== null && e.textContent.trim().includes('Generar identificadores'));
      if (step2) {
        const r = step2.getBoundingClientRect();
        window.scrollTo(0, window.scrollY + r.y - 100);
        return r.y;
      }
      return -1;
    });
    await new Promise(r => setTimeout(r, 1000));
    
    const text = await pg.evaluate(() => document.body.innerText);
    const idx = text.indexOf('Generar identificadores');
    if (idx >= 0) {
      console.log(text.substring(idx, idx + 2000));
    } else {
      console.log('Step 2 not found in text');
      console.log('Looking for section...');
      // Try to find any page connection related text
      const pageText = text.toLowerCase();
      if (pageText.includes('conectar')) console.log('Found "Conectar"');
      if (pageText.includes('página')) console.log('Found "Página"');
      console.log('Full text tail:', text.substring(text.length - 500));
    }
    
    b.disconnect();
  } catch (e) { console.error('ERR:', e.message); }
  process.exit(0);
})();