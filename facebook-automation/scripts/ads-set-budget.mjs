import puppeteer from 'puppeteer';
const CAMPAIGN_NAME = 'Cursos Digitales - Catálogo General';
const DAILY_BUDGET = '10000';

const browser = await puppeteer.connect({ browserURL: 'http://127.0.0.1:9222' });
const pages = await browser.pages();
const adsPage = pages[10];
await adsPage.bringToFront();

// First, set campaign name
await adsPage.evaluate((name) => {
  const inp = document.querySelector('input');
  if (!inp || inp.type !== 'text') {
    const allInputs = document.querySelectorAll('input');
    for (const i of allInputs) {
      if (i.placeholder && i.placeholder.includes('nombre')) {
        const s = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
        s.call(i, name);
        i.dispatchEvent(new Event('input', { bubbles: true }));
        i.dispatchEvent(new Event('change', { bubbles: true }));
        return 'name set';
      }
    }
    return 'no text input';
  }
  return 'first input is not text: ' + inp.type;
}, CAMPAIGN_NAME);

console.log('Campaign name set');
await new Promise(r => setTimeout(r, 1500));

// Now find and set budget
const budgetResult = await adsPage.evaluate((budget) => {
  // Find the budget input - look for currency-related inputs
  const allInputs = document.querySelectorAll('input');
  for (const inp of allInputs) {
    if (inp.offsetParent === null) continue;
    // Budget inputs typically have numeric values
    if (inp.type === 'text' || inp.type === 'number' || inp.type === 'tel') {
      const s = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
      s.call(inp, budget);
      inp.dispatchEvent(new Event('input', { bubbles: true }));
      inp.dispatchEvent(new Event('change', { bubbles: true }));
      return 'budget set on input: ' + (inp.placeholder || 'no placeholder');
    }
  }
  return 'no input found';
}, DAILY_BUDGET);

console.log('Budget:', budgetResult);

await new Promise(r => setTimeout(r, 2000));

// Click Siguiente
const nextResult = await adsPage.evaluate(() => {
  const all = document.querySelectorAll('div[role=button], button, a, span');
  for (const el of all) {
    if (el.offsetParent === null) continue;
    const t = (el.textContent || '').trim();
    if (t === 'Siguiente') {
      el.click();
      return 'Siguiente clicked';
    }
  }
  return 'Siguiente not found';
});
console.log('Next:', nextResult);

await new Promise(r => setTimeout(r, 4000));

// Check where we are now
const text = await adsPage.evaluate(() => document.body.innerText.substring(0, 2000));
console.log('\\nCurrent screen:');
console.log(text.substring(0, 1000));

await adsPage.screenshot({ path: 'C:\\Users\\ADMIN\\Music\\proyecto-unificado\\_step_adset_level.png' });
await browser.disconnect();
