const puppeteer = require('puppeteer');

(async () => {
  try {
    const b = await puppeteer.connect({ browserURL: 'http://127.0.0.1:9222', defaultViewport: null });
    const pages = await b.pages();
    for (const p of pages) {
      const url = p.url();
      const title = await p.title().catch(() => '');
      console.log(`URL: ${url} | TITLE: ${title}`);
    }
    b.disconnect();
  } catch (e) {
    console.error('Error:', e.message);
  }
})();