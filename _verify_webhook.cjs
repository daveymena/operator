const p = require('puppeteer');
(async () => {
  try {
    const b = await p.connect({ browserURL: 'http://127.0.0.1:9222', defaultViewport: null });
    const pages = await b.pages();
    const pg = pages.find(x => x.url().includes('apps')) || pages[0];
    
    // Click "Verificar y guardar"
    const clicked = await pg.evaluate(() => {
      const all = Array.from(document.querySelectorAll('*'));
      const el = all.find(e => e.offsetParent !== null && e.childElementCount === 0 && (e.textContent.trim() === 'Verificar y guardar' || e.textContent.trim() === 'Verify and save'));
      if (el) { el.click(); return 'CLICKED'; }
      return 'NOT FOUND: Verificar y guardar';
    });
    console.log('Click result:', clicked);
    await new Promise(r => setTimeout(r, 4000));
    
    const text = await pg.evaluate(() => document.body.innerText);
    if (text.includes('Error') || text.includes('error')) {
      console.log('=== Error section ===');
      const lines = text.split('\n').filter(l => l.toLowerCase().includes('error'));
      console.log(lines.join('\n'));
    }
    console.log('=== Section after webhook save ===');
    console.log(text.substring(text.indexOf('Configuración de Messenger API'), text.indexOf('Configuración de Messenger API') + 2000));
    b.disconnect();
  } catch (e) { console.error('ERR:', e.message); }
  process.exit(0);
})();