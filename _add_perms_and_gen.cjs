const p = require('puppeteer');
(async () => {
  try {
    const b = await p.connect({ browserURL: 'http://127.0.0.1:9222', defaultViewport: null });
    const pages = await b.pages();
    const pg = pages.find(x => x.url().includes('explorer')) || pages[0];
    
    // Find the permission input by placeholder
    const permInput = await pg.$('input[placeholder="Añadir un permiso"]');
    if (permInput) {
      console.log('Found permission input');
      await permInput.click();
      await permInput.type('pages_show_list', { delay: 30 });
      console.log('Typed pages_show_list');
      await new Promise(r => setTimeout(r, 2000));
      
      // Check dropdown suggestions
      const text = await pg.evaluate(() => document.body.innerText);
      const permSection = text.indexOf('pages_show_list');
      if (permSection >= 0) {
        console.log('Permission section:', text.substring(Math.max(0, permSection - 50), permSection + 200));
      }
      
      // Try pressing Enter to select
      await pg.keyboard.press('Enter');
      await new Promise(r => setTimeout(r, 1000));
      console.log('Pressed Enter');
    } else {
      console.log('Permission input not found');
      const text = await pg.evaluate(() => document.body.innerText);
      console.log(text.substring(0, 2000));
    }
    
    // Check if permission was added
    const text2 = await pg.evaluate(() => document.body.innerText);
    if (text2.includes('pages_show_list')) {
      console.log('SUCCESS: Permission pages_show_list added!');
    }
    
    // Now add pages_read_engagement
    const permInput2 = await pg.$('input[placeholder="Añadir un permiso"]');
    if (permInput2) {
      await permInput2.click();
      await permInput2.type('pages_read_engagement', { delay: 30 });
      await new Promise(r => setTimeout(r, 2000));
      await pg.keyboard.press('Enter');
      await new Promise(r => setTimeout(r, 1000));
      console.log('Added pages_read_engagement');
    }
    
    // Add pages_messaging
    const permInput3 = await pg.$('input[placeholder="Añadir un permiso"]');
    if (permInput3) {
      await permInput3.click();
      await permInput3.type('pages_messaging', { delay: 30 });
      await new Promise(r => setTimeout(r, 2000));
      await pg.keyboard.press('Enter');
      await new Promise(r => setTimeout(r, 1000));
      console.log('Added pages_messaging');
    }
    
    await new Promise(r => setTimeout(r, 1000));
    
    // Now click Generate Access Token with new permissions
    console.log('\nClicking Generate Access Token...');
    await pg.evaluate(() => {
      const all = Array.from(document.querySelectorAll('*'));
      const btn = all.find(e => e.offsetParent !== null && e.textContent.trim() === 'Generate Access Token');
      if (btn) btn.click();
    });
    await new Promise(r => setTimeout(r, 5000));
    
    // Check result
    const text3 = await pg.evaluate(() => document.body.innerText);
    console.log('After Generate:', text3.substring(0, 2000));
    
    // Check for new pages (popup)
    const allPages = await b.pages();
    if (allPages.length > 1) {
      console.log('New page appeared!');
      for (let i = 0; i < allPages.length; i++) {
        console.log(`[${i}] ${allPages[i].url().substring(0, 200)}`);
      }
    }
    
    b.disconnect();
  } catch (e) { console.error('ERR:', e.message); }
  process.exit(0);
})();