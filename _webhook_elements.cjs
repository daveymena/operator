const p = require('puppeteer');
(async () => {
  try {
    const b = await p.connect({ browserURL: 'http://127.0.0.1:9222', defaultViewport: null });
    const pages = await b.pages();
    const pg = pages.find(x => x.url().includes('apps')) || pages[0];
    
    // Get the full page HTML structure around webhook section
    const webhookSection = await pg.evaluate(() => {
      const all = Array.from(document.querySelectorAll('div, span, label, h3, h4, h5, input, button'));
      // Find the webhook section elements with their coordinates
      const webhookItems = all.filter(e => {
        const t = e.textContent.trim();
        return e.offsetParent !== null && (
          t.includes('URL de devolución') || 
          t.includes('Identificador de verificación') ||
          t.includes('Verificar y guardar') ||
          t.includes('webhook') ||
          t.includes('Webhook') ||
          t.includes('devolución de llamada')
        );
      });
      return webhookItems.map(e => ({
        tag: e.tagName,
        text: e.textContent.trim().substring(0, 60),
        type: e.type || e.getAttribute('type') || '',
        id: e.id,
        className: e.className.substring(0, 40)
      }));
    });
    console.log('Webhook elements:');
    webhookItems.forEach(item => console.log(`  ${item.tag} ${item.id}: ${item.text}`));
    
    // Also get ALL visible input coordinates
    const visibleInputs = await pg.evaluate(() => {
      const inputs = Array.from(document.querySelectorAll('input:not([type=hidden])'));
      return inputs.map(i => {
        const r = i.getBoundingClientRect();
        // Find the closest label or text before it
        let label = '';
        const parent = i.parentElement;
        if (parent) {
          // Look for sibling div with text
          const siblings = Array.from(parent.querySelectorAll('div, span, label'));
          for (const sib of siblings) {
            const t = sib.textContent.trim();
            if (t.length > 5 && t.length < 60) { label = t; break; }
          }
        }
        return { id: i.id, x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), label };
      });
    });
    console.log('\nVisible inputs with labels:');
    visibleInputs.forEach(i => console.log(`  ${i.id} at (${i.x},${i.y}) ${i.w}px - ${i.label}`));
    
    b.disconnect();
  } catch (e) { console.error('ERR:', e.message); }
  process.exit(0);
})();