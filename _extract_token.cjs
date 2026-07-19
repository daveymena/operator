const p = require('puppeteer');
(async () => {
  try {
    const b = await p.connect({ browserURL: 'http://127.0.0.1:9222', defaultViewport: null });
    const pages = await b.pages();
    const pg = pages[0];
    
    // Go to the page profile in admin view
    await pg.goto('https://www.facebook.com/profile.php?id=61591838792522&sk=about', {
      waitUntil: 'load', timeout: 20000
    }).catch(() => {});
    await new Promise(r => setTimeout(r, 5000));
    
    // Try to extract the page access token from various sources
    const tokens = await pg.evaluate(() => {
      const results = [];
      
      // 1. Check all script tags for token patterns
      const scripts = Array.from(document.querySelectorAll('script'));
      for (const s of scripts) {
        const text = s.textContent || '';
        // Look for Page Access Token pattern (EAA...)
        const matches = text.match(/EAA[A-Za-z0-9]{50,200}/g);
        if (matches) results.push(...matches.slice(0, 5));
        
        // Look for accessToken variable patterns
        if (text.includes('accessToken') || text.includes('access_token')) {
          const lines = text.split('\n').filter(l => l.includes('access'));
          results.push(...lines.slice(0, 3));
        }
      }
      
      // 2. Check meta tags
      const metas = Array.from(document.querySelectorAll('meta'));
      for (const m of metas) {
        const content = m.getAttribute('content') || '';
        if (content.includes('EAA')) {
          results.push('META: ' + content.substring(0, 80));
        }
      }
      
      // 3. Check all global variables
      const fbVars = [];
      for (const key of Object.keys(window)) {
        const val = window[key];
        if (typeof val === 'string' && val.length > 50 && val.startsWith('EAA')) {
          fbVars.push(key + ': ' + val.substring(0, 60));
        }
      }
      results.push(...fbVars);
      
      // 4. Check localStorage
      try {
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          const val = localStorage.getItem(key);
          if (typeof val === 'string' && val.length > 50 && val.startsWith('EAA')) {
            results.push('LS: ' + key + '=' + val.substring(0, 60));
          }
        }
      } catch(e) {}
      
      // 5. Check sessionStorage
      try {
        for (let i = 0; i < sessionStorage.length; i++) {
          const key = sessionStorage.key(i);
          const val = sessionStorage.getItem(key);
          if (typeof val === 'string' && val.length > 50 && val.startsWith('EAA')) {
            results.push('SS: ' + key + '=' + val.substring(0, 60));
          }
        }
      } catch(e) {}
      
      return results.slice(0, 20);
    });
    
    console.log('Found tokens/vars:', JSON.stringify(tokens, null, 2));
    b.disconnect();
  } catch (e) { console.error('ERR:', e.message); }
  process.exit(0);
})();