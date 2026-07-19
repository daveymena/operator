const p = require('puppeteer');
(async () => {
  const b = await p.connect({ browserURL: 'http://127.0.0.1:9222', defaultViewport: null });
  const pages = await b.pages();
  const pg = pages.find(x => x.url().includes('creation')) || pages[0];
  await pg.focus('#js_1d');
  await pg.keyboard.down('Control');
  await pg.keyboard.press('a');
  await pg.keyboard.up('Control');
  await pg.keyboard.press('Delete');
  await new Promise(r => setTimeout(r, 300));
  await pg.keyboard.type('daveymena16@gmail.com', { delay: 40 });
  await new Promise(r => setTimeout(r, 1000));
  const val = await pg.evaluate(() => document.querySelector('#js_1d').value);
  console.log('Final email value:', val);
  // Now click Siguiente
  await pg.evaluate(() => {
    const btn = Array.from(document.querySelectorAll('[role="button"]')).find(e => e.textContent.trim() === 'Siguiente');
    if (btn) btn.click();
  });
  await new Promise(r => setTimeout(r, 3000));
  const text = await pg.evaluate(() => document.body.innerText);
  console.log('=== After Siguiente ===');
  console.log(text.substring(0, 2000));
  b.disconnect();
})();