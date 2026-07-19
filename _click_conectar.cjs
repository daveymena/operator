const p = require('puppeteer');
(async () => {
  try {
    const b = await p.connect({ browserURL: 'http://127.0.0.1:9222', defaultViewport: null });
    const pages = await b.pages();
    const pg = pages[0];
    
    // First find the Conectar button coordinates
    const conectarPos = await pg.evaluate(() => {
      const all = Array.from(document.querySelectorAll('*'));
      // Find the Conectar button - it's a leaf element with text "Conectar"
      const btn = all.find(e => e.offsetParent !== null && e.childElementCount === 0 && e.textContent.trim() === 'Conectar');
      if (!btn) return null;
      const r = btn.getBoundingClientRect();
      return { x: r.x + r.width/2, y: r.y + r.height/2, w: r.width, h: r.height, tag: btn.tagName };
    });
    console.log('Conectar button:', JSON.stringify(conectarPos));
    
    if (!conectarPos) {
      console.log('Conectar button not found');
      b.disconnect();
      return;
    }
    
    // Try clicking with mouse at the center of the button
    await pg.mouse.click(conectarPos.x, conectarPos.y);
    console.log('Clicked at', conectarPos.x, conectarPos.y);
    await new Promise(r => setTimeout(r, 3000));
    
    // Check for popups
    const allPages = await b.pages();
    console.log('Pages:', allPages.length);
    for (let i = 0; i < allPages.length; i++) {
      console.log(`[${i}] ${allPages[i].url().substring(0, 250)}`);
    }
    
    // Check page text for any changes
    const text = await pg.evaluate(() => document.body.innerText);
    const idx = text.indexOf('Generar identificadores');
    console.log('\nAfter click:', text.substring(idx, idx + 500));
    
    // Also try right-click or double-click
    if (allPages.length === 1) {
      console.log('\nNo popup appeared. Trying native click event...');
      await pg.evaluate((pos) => {
        const el = document.elementFromPoint(pos.x, pos.y);
        if (el) {
          el.dispatchEvent(new MouseEvent('click', {
            bubbles: true,
            cancelable: true,
            view: window,
            clientX: pos.x,
            clientY: pos.y
          }));
        }
      }, conectarPos);
      await new Promise(r => setTimeout(r, 3000));
      
      const allPages2 = await b.pages();
      console.log('Pages after native click:', allPages2.length);
      for (let i = 0; i < allPages2.length; i++) {
        console.log(`[${i}] ${allPages2[i].url().substring(0, 250)}`);
      }
    }
    
    b.disconnect();
  } catch (e) { console.error('ERR:', e.message); }
  process.exit(0);
})();