const p = require('puppeteer');
(async () => {
  try {
    const b = await p.connect({ browserURL: 'http://127.0.0.1:9222', defaultViewport: null });
    const pages = await b.pages();
    const pg = pages.find(x => x.url().includes('apps')) || pages[0];
    
    // Click "Mostrar" to reveal App Secret
    await pg.evaluate(() => {
      const all = Array.from(document.querySelectorAll('*'));
      const el = all.find(e => e.offsetParent !== null && e.childElementCount === 0 && e.textContent.trim() === 'Mostrar');
      if (el) { el.click(); return 'clicked'; }
      return 'not found';
    });
    await new Promise(r => setTimeout(r, 2000));
    
    // Read App ID and App Secret values
    const vals = await pg.evaluate(() => {
      // Find all input fields and their values
      const inputs = Array.from(document.querySelectorAll('input'));
      return inputs.map(i => {
        const lbl = i.parentElement ? i.parentElement.textContent.trim().substring(0, 80) : '';
        return { id: i.id, name: i.name, value: i.value, type: i.type, placeholder: i.placeholder, label: lbl };
      });
    });
    console.log('Inputs:');
    for (const v of vals) {
      if (v.value) console.log(`  ${v.id || v.name}: ${v.value.substring(0, 60)}`);
    }
    
    // Also look for displayed app id and secret
    const displayed = await pg.evaluate(() => {
      const all = Array.from(document.querySelectorAll('div, span, code, input, strong'));
      const texts = all.filter(e => e.offsetParent !== null && e.childElementCount === 0);
      return texts.map(e => ({ t: e.textContent.trim().substring(0, 80), tag: e.tagName }));
    });
    console.log('\nDisplayed items with App ID/key:');
    for (const d of displayed) {
      if (d.t.length > 10 && /^\d|^[A-Z]/.test(d.t) && !d.t.includes(' ') && d.t.length < 60) {
        console.log(`  [${d.tag}] ${d.t}`);
      }
    }
    
    b.disconnect();
  } catch (e) { console.error('ERR:', e.message); }
  process.exit(0);
})();