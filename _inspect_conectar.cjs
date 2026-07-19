const p = require('puppeteer');
(async () => {
  try {
    const b = await p.connect({ browserURL: 'http://127.0.0.1:9222', defaultViewport: null });
    const pages = await b.pages();
    const pg = pages[0];
    
    const fullUrl = 'https://developers.facebook.com/apps/4238613976451604/use_cases/customize/messenger_api_settings/' +
      '?product_route=messenger&business_id=4482432028697067&use_case_enum=FACEBOOK_MESSAGING&selected_tab=messenger_api_settings';
    await pg.goto(fullUrl, { waitUntil: 'load', timeout: 15000 }).catch(() => {});
    await new Promise(r => setTimeout(r, 3000));
    
    // Scroll to the Conectar button and inspect its event listeners
    const info = await pg.evaluate(() => {
      // Find the Conectar button
      const all = Array.from(document.querySelectorAll('*'));
      const conectar = all.find(e => e.offsetParent !== null && e.childElementCount === 0 && e.textContent.trim() === 'Conectar');
      if (!conectar) return 'NOT FOUND';
      
      // Get its bounding rect for scrolling
      const r = conectar.getBoundingClientRect();
      
      // Look for its parent anchors/buttons that might have href/onclick
      let walk = conectar;
      let info = { tag: conectar.tagName, id: conectar.id, cls: conectar.className.substring(0, 60), rect: `${Math.round(r.x)},${Math.round(r.y)} ${Math.round(r.w)}x${Math.round(r.h)}` };
      
      // Walk up to find parent with onclick or href
      for (let i = 0; i < 5; i++) {
        if (walk.parentElement && walk.parentElement !== document.body) {
          walk = walk.parentElement;
          const href = walk.getAttribute('href');
          const onclick = walk.getAttribute('onclick');
          if (href || onclick) {
            info.parentHref = href;
            info.parentOnclick = (onclick || '').substring(0, 200);
            info.parentTag = walk.tagName;
            info.parentId = walk.id;
            break;
          }
        }
      }
      
      return JSON.stringify(info);
    });
    console.log('Conectar info:', info);
    
    b.disconnect();
  } catch (e) { console.error('ERR:', e.message); }
  process.exit(0);
})();