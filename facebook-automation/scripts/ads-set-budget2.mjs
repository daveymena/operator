import puppeteer from 'puppeteer';

const browser = await puppeteer.connect({ browserURL: 'http://127.0.0.1:9222' });
const pages = await browser.pages();
const adsPage = pages[10];
await adsPage.bringToFront();

// Set budget to 10000
const budgetResult = await adsPage.evaluate(() => {
  const inputs = document.querySelectorAll('input');
  for (const inp of inputs) {
    if (inp.offsetParent === null) continue;
    if ((inp.placeholder || '').includes('Introduce una cantidad')) {
      const s = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
      s.call(inp, '10000');
      inp.dispatchEvent(new Event('input', { bubbles: true }));
      inp.dispatchEvent(new Event('change', { bubbles: true }));
      inp.dispatchEvent(new Event('blur', { bubbles: true }));
      return 'budget set: ' + inp.value;
    }
  }
  return 'input not found';
});
console.log(budgetResult);

await new Promise(r => setTimeout(r, 2000));

// Also fix campaign name
const nameResult = await adsPage.evaluate(() => {
  const placeholder = 'nombre de tu campa';
  const inputs = document.querySelectorAll('input');
  for (const inp of inputs) {
    if (inp.offsetParent === null) continue;
    if ((inp.placeholder || '').includes(placeholder)) {
      const s = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
      s.call(inp, 'Cursos Digitales - Catalogo General');
      inp.dispatchEvent(new Event('input', { bubbles: true }));
      inp.dispatchEvent(new Event('change', { bubbles: true }));
      return 'name set: ' + inp.value;
    }
  }
  return 'name input not found';
});
console.log(nameResult);

await new Promise(r => setTimeout(r, 1500));

// Click Siguiente
const nextResult = await adsPage.evaluate(() => {
  const all = document.querySelectorAll('div[role=button], button, a, span');
  for (const el of all) {
    if (el.offsetParent === null) continue;
    const t = (el.textContent || '').trim();
    if (t === 'Siguiente') {
      el.click();
      return 'Siguiente';
    }
  }
  return 'not found';
});
console.log('Next:', nextResult);

await new Promise(r => setTimeout(r, 5000));

// Check where we are
const text = await adsPage.evaluate(() => document.body.innerText.substring(0, 2000));
console.log('\nAfter Siguiente:');
console.log(text.substring(0, 1000));

await adsPage.screenshot({ path: 'C:\\Users\\ADMIN\\Music\\proyecto-unificado\\_adset_level.png' });
await browser.disconnect();
