const puppeteer = require('puppeteer');
(async () => {
  const browser = await puppeteer.launch({ headless: false, args: ['--no-sandbox', '--disable-setuid-sandbox'] });
  const page = await browser.newPage();
  await page.goto('https://docs.google.com/forms/d/e/1FAIpQLSfd9f3bIBYdrMps4YlASFWr2Zsg81eiIsXF8wtq2bZ_xaSsYA/viewform', { waitUntil: 'networkidle0', timeout: 60000 });
  await new Promise(r => setTimeout(r, 5000));

  // Click through a few pages to see what happens with fetch submit
  const result = await page.evaluate(async () => {
    const form = document.querySelector('form');
    if (!form) return { error: 'no form' };
    const fd = new FormData(form);
    fd.delete('g-recaptcha-response');
    fd.delete('g-recaptcha-response');
    // Log all entries
    const entries = [];
    for (const [k, v] of fd.entries()) {
      entries.push({ name: k, value: typeof v === 'string' ? v.substring(0, 100) : '(blob)' });
    }
    return { entries, formAction: form.action };
  });

  console.log('Form entries:', JSON.stringify(result, null, 2));
  await browser.close();
})();
