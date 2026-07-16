import puppeteer from 'puppeteer';
import fs from 'fs';

const browser = await puppeteer.connect({ browserURL: 'http://127.0.0.1:9222' });
const page = await browser.newPage();
page.setViewport({ width: 1400, height: 900 });

await page.goto('https://adsmanager.facebook.com/adsmanager/manage/campaigns?act=1545022093928422', {
  waitUntil: 'networkidle0', timeout: 30000
});
await new Promise(r => setTimeout(r, 5000));

// Try to find the access token from the page's runtime state
const tokenResult = await page.evaluate(() => {
  const results = {};
  
  // Check all window properties for tokens
  try {
    // Look in common FB locations
    if (window.__access_token) results.__access_token = window.__access_token;
    
    // Check all script tags for data-containing tokens
    const scripts = document.querySelectorAll('script');
    for (const s of scripts) {
      const text = s.textContent || '';
      if (text.includes('accessToken') || text.includes('access_token')) {
        const match = text.match(/access[Tt]oken["': ]+([A-Za-z0-9_%-]{80,})/);
        if (match) {
          results.scriptToken = match[1];
          break;
        }
      }
    }
    
    // Check for __DEV_MODE or other debug info
    if (window.__DEV_MODE) results.dev = true;
    
    // Look for __fb or similar global objects
    const fbGlobals = Object.keys(window).filter(k => k.startsWith('__fb') || k.startsWith('FB_') || k.includes('facebook'));
    if (fbGlobals.length > 0) results.fbGlobals = fbGlobals;
    
  } catch(e) {
    results.error = e.message;
  }
  
  return results;
});

console.log('Token from window:', JSON.stringify(tokenResult, null, 2).substring(0, 500));

// Also try checking sessionStorage more thoroughly
const sessionData = await page.evaluate(() => {
  const data = {};
  try {
    for (let i = 0; i < sessionStorage.length; i++) {
      const key = sessionStorage.key(i);
      const val = sessionStorage.getItem(key);
      if (val && val.includes('EAAB')) {
        data[key] = val.substring(0, 100);
      }
    }
  } catch(e) {}
  return data;
});
console.log('Session storage tokens:', JSON.stringify(sessionData, null, 2).substring(0, 500));

// Check indexedDB for stored tokens
const idbResult = await page.evaluate(async () => {
  const dbs = await indexedDB.databases();
  const results = [];
  for (const db of dbs) {
    results.push(db.name);
  }
  return results;
});
console.log('IndexedDB databases:', idbResult);

await browser.disconnect();
