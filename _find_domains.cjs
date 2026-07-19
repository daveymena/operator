const p = require('puppeteer');
(async () => {
  try {
    const b = await p.connect({ browserURL: 'http://127.0.0.1:9222', defaultViewport: null });
    const pages = await b.pages();
    const pg = pages.find(x => x.url().includes('apps')) || pages[0];
    
    // Go to settings basic
    await pg.goto('https://developers.facebook.com/apps/4238613976451604/settings/basic/', { 
      waitUntil: 'load', timeout: 15000 
    }).catch(() => {});
    await new Promise(r => setTimeout(r, 4000));
    
    // Scroll to find the domain field
    await pg.evaluate(() => window.scrollTo(0, 100));
    await new Promise(r => setTimeout(r, 1000));
    
    // Find the app domains input field
    const domains = await pg.evaluate(() => {
      const all = Array.from(document.querySelectorAll('div, span, label, input'));
      const domainLabels = all.filter(e => e.offsetParent !== null && e.textContent.trim() === 'Dominios de la aplicación');
      return domainLabels.map(e => ({ tag: e.tagName, text: e.textContent.trim() }));
    });
    console.log('Domain label:', JSON.stringify(domains));
    
    // Get all inputs around "Dominios" area
    const inputs = await pg.evaluate(() => {
      const all = Array.from(document.querySelectorAll('input:not([type=hidden])'));
      return all.filter(i => i.offsetParent !== null).map(i => ({ id: i.id, value: i.value.substring(0, 50), placeholder: i.placeholder }));
    });
    console.log('Visible inputs:');
    inputs.forEach(i => console.log(`  ${i.id}: "${i.value}" (${i.placeholder})`));
    
    b.disconnect();
  } catch (e) { console.error('ERR:', e.message); }
  process.exit(0);
})();