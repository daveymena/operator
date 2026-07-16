const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
puppeteer.use(StealthPlugin());

(async () => {
  const browser = await puppeteer.launch({
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    headless: false,
    args: ['--start-maximized', '--no-sandbox'],
    defaultViewport: null,
  });
  const page = (await browser.pages())[0];
  
  await page.setRequestInterception(true);
  page.on('request', (req) => {
    const url = req.url();
    if (url.includes('analytics') || url.includes('doubleclick') || url.includes('googleadservices') || url.includes('pagead2')) req.abort();
    else req.continue();
  });

  await page.goto('https://docs.google.com/forms/d/e/1FAIpQLSfd9f3bIBYdrMps4YlASFWr2Zsg81eiIsXF8wtq2bZ_xaSsYA/viewform', { waitUntil: 'networkidle2' });
  await new Promise(r => setTimeout(r, 5000));

  const info = await page.evaluate(() => {
    const all = document.body.innerText.substring(0, 1000);
    const items = document.querySelectorAll('[role="listitem"]').length;
    const btns = Array.from(document.querySelectorAll('[role="button"], button, input[type="submit"], span')).map(b => (b.innerText || b.value || '').trim()).filter(t => t);
    const iframes = Array.from(document.querySelectorAll('iframe')).map(f => ({ title: f.title, src: (f.src || '').substring(0, 100) }));
    return { all, items, btns, iframes };
  });
  console.log(JSON.stringify(info, null, 2));

  for (let i = 0; i < 20; i++) {
    const sig = await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('[role="button"], button, input[type="submit"], span'));
      const btn = btns.find(b => {
        const txt = (b.innerText || b.value || '').trim().toLowerCase();
        return txt === 'siguiente' || txt === 'next' || txt.includes('siguiente');
      });
      if (btn) { btn.scrollIntoView({ block: 'center' }); btn.click(); return true; }
      return false;
    });
    if (!sig) break;
    await new Promise(r => setTimeout(r, 3000));
    const state = await page.evaluate(() => {
      const all = document.body.innerText.substring(0, 500);
      const items = document.querySelectorAll('[role="listitem"]').length;
      const btns = Array.from(document.querySelectorAll('[role="button"], button, span')).map(b => (b.innerText || '').trim()).filter(t => t);
      const envBtn = btns.some(t => t.toLowerCase().includes('enviar'));
      const sigBtn = btns.some(t => t.toLowerCase().includes('siguiente'));
      return { step: i + 1, all: all.substring(0, 300), items, btns: btns.slice(0, 10), envBtn, sigBtn };
    });
    console.log(`Step ${i+1}: items=${state.items} envBtn=${state.envBtn} sigBtn=${state.sigBtn}`);
    console.log(`  btns: ${JSON.stringify(state.btns)}`);
    console.log(`  text: ${state.all.substring(0, 150)}`);
  }

  await new Promise(r => setTimeout(r, 10000));
  await browser.close();
})();
