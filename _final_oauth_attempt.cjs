const p = require('puppeteer');
(async () => {
  try {
    const b = await p.connect({ browserURL: 'http://127.0.0.1:9222', defaultViewport: null });
    const pages = await b.pages();
    const pg = pages[0];
    
    // Step 1: Add domain to app settings and SAVE properly
    console.log('=== Step 1: Add domain ===');
    await pg.goto('https://developers.facebook.com/apps/4238613976451604/settings/basic/', {
      waitUntil: 'domcontentloaded', timeout: 15000
    }).catch(() => {});
    await new Promise(r => setTimeout(r, 4000));
    
    // Find domain input
    const domainId = await pg.evaluate(() => {
      const all = Array.from(document.querySelectorAll('*'));
      const label = all.find(e => e.offsetParent !== null && e.textContent.trim() === 'Dominios de la aplicación');
      if (!label) return null;
      const parent = label.closest('div,section');
      const input = parent ? parent.querySelector('input') : null;
      return input ? input.id : null;
    });
    
    if (domainId) {
      console.log('Domain input ID:', domainId);
      await pg.focus('#' + domainId);
      await pg.keyboard.down('Control');
      await pg.keyboard.press('a');
      await pg.keyboard.up('Control');
      await pg.keyboard.press('Delete');
      await new Promise(r => setTimeout(r, 200));
      await pg.keyboard.type('www.facebook.com, developers.facebook.com', { delay: 10 });
      console.log('Typed domains');
      await new Promise(r => setTimeout(r, 500));
      
      // Try to submit by pressing Enter in the field
      await pg.keyboard.press('Tab');
      await new Promise(r => setTimeout(r, 500));
      await pg.keyboard.press('Enter');
      await new Promise(r => setTimeout(r, 3000));
      
      // Verify save
      const saved = await pg.evaluate((id) => {
        const inp = document.querySelector('#' + id);
        return inp ? inp.value : 'no input';
      }, domainId);
      console.log('After save, value:', saved);
      
      if (saved.includes('facebook.com')) {
        console.log('Domain saved successfully!');
      }
    }
    
    // Step 2: Now try OAuth with www.facebook.com/connect/login_success.html
    console.log('\n=== Step 2: OAuth with login_success.html ===');
    const oauthUrl1 = 'https://www.facebook.com/v21.0/dialog/oauth?' +
      'client_id=4238613976451604' +
      '&redirect_uri=https://www.facebook.com/connect/login_success.html' +
      '&response_type=token' +
      '&scope=pages_show_list,pages_read_engagement,pages_messaging' +
      '&auth_type=rerequest';
    await pg.goto(oauthUrl1, { waitUntil: 'load', timeout: 20000 }).catch(() => {});
    await new Promise(r => setTimeout(r, 5000));
    
    const url1 = pg.url();
    console.log('OAuth URL 1:', url1.substring(0, 400));
    const text1 = await pg.evaluate(() => document.body.innerText);
    console.log('Response:', text1.substring(0, 2000));
    
    // Check if succeeded (access_token in URL)
    const tokenMatch1 = url1.match(/access_token=([^&]+)/);
    if (tokenMatch1) {
      console.log('\nSUCCESS! Token:', tokenMatch1[1].substring(0, 60));
      require('fs').writeFileSync('_page_token.txt', tokenMatch1[1]);
      console.log('Token saved!');
    } else {
      console.log('\nOAuth failed, trying alternative redirect...');
      
      // Try alternative: use the app's own redirect
      const oauthUrl2 = 'https://www.facebook.com/v21.0/dialog/oauth?' +
        'client_id=4238613976451604' +
        '&redirect_uri=https://developers.facebook.com/tools/accesstoken/' +
        '&response_type=token' +
        '&scope=pages_show_list,pages_read_engagement,pages_messaging' +
        '&auth_type=rerequest';
      await pg.goto(oauthUrl2, { waitUntil: 'load', timeout: 20000 }).catch(() => {});
      await new Promise(r => setTimeout(r, 5000));
      
      const url2 = pg.url();
      console.log('OAuth URL 2:', url2.substring(0, 400));
      const text2 = await pg.evaluate(() => document.body.innerText);
      console.log('Response:', text2.substring(0, 2000));
      
      const tokenMatch2 = url2.match(/access_token=([^&]+)/);
      if (tokenMatch2) {
        console.log('\nSUCCESS! Token:', tokenMatch2[1].substring(0, 60));
        require('fs').writeFileSync('_page_token.txt', tokenMatch2[1]);
      }
    }
    
    b.disconnect();
  } catch (e) { console.error('ERR:', e.message); }
  process.exit(0);
})();