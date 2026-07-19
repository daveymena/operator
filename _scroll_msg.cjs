const p = require('puppeteer');
(async () => {
  const b = await p.connect({ browserURL: 'http://127.0.0.1:9222', defaultViewport: null });
  const pages = await b.pages();
  const pg = pages.find(x => x.url().includes('creation')) || pages[0];
  
  // Try clicking the Mensajes empresariales filter tab properly
  const filterResult = await pg.evaluate(() => {
    const tabs = Array.from(document.querySelectorAll('[role="tab"], [role="radio"], [role="menuitem"], [role="option"], [data-testid]'));
    const msgTabs = tabs.filter(e => e.textContent.trim().startsWith('Mensajes empresariales'));
    if (msgTabs.length > 0) {
      msgTabs[0].click();
      return 'clicked tab: ' + msgTabs[0].tagName + ' / ' + msgTabs[0].getAttribute('role');
    }
    // Fallback: look for the parent filter container
    const filters = Array.from(document.querySelectorAll('*')).filter(e => 
      e.offsetParent !== null && 
      e.childElementCount === 0 && 
      e.textContent.trim().startsWith('Mensajes empresariales')
    );
    if (filters.length > 0) {
      filters[0].click();
      return 'clicked leaf: ' + filters[0].tagName;
    }
    return 'not found';
  });
  console.log('Filter:', filterResult);
  await new Promise(r => setTimeout(r, 2000));
  
  // Scroll down to find all use case options
  await pg.evaluate(() => window.scrollBy(0, 800));
  await new Promise(r => setTimeout(r, 1000));
  
  const text = await pg.evaluate(() => document.body.innerText);
  console.log('=== Scrolled text ===');
  console.log(text.substring(0, 3000));
  b.disconnect();
});