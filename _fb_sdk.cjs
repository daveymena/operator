const p = require('puppeteer');
(async () => {
  try {
    const b = await p.connect({ browserURL: 'http://127.0.0.1:9222', defaultViewport: null });
    const pages = await b.pages();
    const pg = pages[0];
    
    // Go to the Explorer
    await pg.goto('https://developers.facebook.com/tools/explorer/', {
      waitUntil: 'load', timeout: 15000
    }).catch(() => {});
    await new Promise(r => setTimeout(r, 3000));
    
    // Try to call FB.login via the browser console
    // First check if FB is available
    const hasFB = await pg.evaluate(() => {
      return typeof FB !== 'undefined';
    });
    console.log('FB SDK available:', hasFB);
    
    if (hasFB) {
      // Use FB.login to request permissions
      const token = await pg.evaluate(() => {
        return new Promise((resolve) => {
          FB.login(function(response) {
            if (response.authResponse) {
              resolve(response.authResponse.accessToken);
            } else {
              resolve('CANCELLED: ' + JSON.stringify(response));
            }
          }, { scope: 'pages_show_list,pages_read_engagement,pages_messaging' });
        });
      });
      console.log('FB.login result:', token ? token.substring(0, 60) : 'null');
    } else {
      console.log('FB SDK not available, trying alternative...');
      
      // Try using window.__FB or __fblogin
      const globalFB = await pg.evaluate(() => {
        const keys = Object.keys(window).filter(k => k.toLowerCase().includes('fb'));
        return keys;
      });
      console.log('FB window keys:', globalFB);
    }
    
    b.disconnect();
  } catch (e) { console.error('ERR:', e.message); }
  process.exit(0);
})();