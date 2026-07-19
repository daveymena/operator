const p = require('puppeteer');
(async () => {
  try {
    const b = await p.connect({ browserURL: 'http://127.0.0.1:9222', defaultViewport: null });
    const pages = await b.pages();
    const pg = pages.find(x => x.url().includes('apps')) || pages[0];
    
    // Find the webhook callback URL input and verify token input
    const inputs = await pg.evaluate(() => {
      const all = Array.from(document.querySelectorAll('input'));
      return all.map(i => ({ id: i.id, name: i.name, placeholder: i.placeholder, value: i.value.substring(0, 20), type: i.type }));
    });
    console.log('All inputs:');
    inputs.forEach(i => console.log(`  ${i.id || '(no id)'}: placeholder="${i.placeholder}", value="${i.value}"`));
    
    b.disconnect();
  } catch (e) { console.error('ERR:', e.message); }
  process.exit(0);
})();