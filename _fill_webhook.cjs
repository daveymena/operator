const p = require('puppeteer');
(async () => {
  try {
    const b = await p.connect({ browserURL: 'http://127.0.0.1:9222', defaultViewport: null });
    const pages = await b.pages();
    const pg = pages.find(x => x.url().includes('apps')) || pages[0];
    
    // Fill callback URL
    await pg.focus('#js_d1');
    await pg.keyboard.down('Control');
    await pg.keyboard.press('a');
    await pg.keyboard.up('Control');
    await pg.keyboard.press('Delete');
    await new Promise(r => setTimeout(r, 200));
    await pg.keyboard.type('https://tecnoia-bot-agenwhatsapp.2xs2bu.easypanel.host/api/facebook/messenger/webhook', { delay: 10 });
    console.log('Typed callback URL');
    
    // Fill verify token
    await pg.focus('#js_d7');
    await pg.keyboard.down('Control');
    await pg.keyboard.press('a');
    await pg.keyboard.up('Control');
    await pg.keyboard.press('Delete');
    await new Promise(r => setTimeout(r, 200));
    await pg.keyboard.type('salesbot_messenger_2024', { delay: 10 });
    console.log('Typed verify token');
    
    await new Promise(r => setTimeout(r, 2000));
    
    // Verify the values
    const vals = await pg.evaluate(() => {
      const url = document.querySelector('#js_d1')?.value || '';
      const token = document.querySelector('#js_d7')?.value || '';
      return { url, token };
    });
    console.log('Callback URL:', vals.url);
    console.log('Verify token:', vals.token);
    
    b.disconnect();
  } catch (e) { console.error('ERR:', e.message); }
  process.exit(0);
})();