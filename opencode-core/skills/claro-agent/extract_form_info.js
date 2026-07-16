const puppeteer = require('puppeteer');
const path = require('path');
(async () => {
  const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox'] });
  const page = await browser.newPage();
  await page.goto('https://docs.google.com/forms/d/e/1FAIpQLSfd9f3bIBYdrMps4YlASFWr2Zsg81eiIsXF8wtq2bZ_xaSsYA/viewform', { waitUntil: 'networkidle0', timeout: 60000 });
  await new Promise(r => setTimeout(r, 3000));

  const info = await page.evaluate(() => {
    const allEntries = [];
    document.querySelectorAll('[name^="entry."]').forEach(el => {
      const name = el.getAttribute('name');
      if (name && !allEntries.includes(name)) allEntries.push(name);
    });
    const fbzxEl = document.querySelector('input[name="fbzx"]');
    const fbzx = fbzxEl ? fbzxEl.value : '';
    const form = document.querySelector('form');
    const action = form ? form.action : '';
    return { entries: allEntries, fbzx, action };
  });

  console.log(JSON.stringify(info, null, 2));
  await browser.close();
})();
