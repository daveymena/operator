import puppeteer from 'puppeteer';
const browser = await puppeteer.connect({ browserURL: 'http://127.0.0.1:9222' });
const pages = await browser.pages();
const adsPage = pages[10];
await adsPage.bringToFront();

await new Promise(r => setTimeout(r, 1000));

// Clear and type into the campaign name field
const result = await adsPage.evaluate(() => {
  const inp = document.querySelector('input[placeholder*="nombre de tu campa"]');
  if (!inp) return 'not found';
  
  // React-controlled input - need to use native setter
  const nativeSetter = Object.getOwnPropertyDescriptor(
    window.HTMLInputElement.prototype, 'value'
  ).set;
  
  // Clear existing value
  nativeSetter.call(inp, '');
  inp.dispatchEvent(new Event('input', { bubbles: true }));
  inp.dispatchEvent(new Event('change', { bubbles: true }));
  
  // Set new value
  nativeSetter.call(inp, 'Cursos Digitales - Diseño Gráfico');
  inp.dispatchEvent(new Event('input', { bubbles: true }));
  inp.dispatchEvent(new Event('change', { bubbles: true }));
  
  return 'typed: ' + inp.value;
});

console.log('Result:', result);

// Check for Continue button and click it
await new Promise(r => setTimeout(r, 1500));

const clickResult = await adsPage.evaluate(() => {
  // Find the bottom area buttons
  const all = document.querySelectorAll('div[role=button], button, a, span');
  for (const el of all) {
    if (el.offsetParent === null) continue;
    const t = (el.textContent || '').trim();
    if (t === 'Continuar' || t === 'Siguiente' || t === 'Next') {
      el.click();
      return 'clicked: ' + t;
    }
  }
  return 'no button found';
});
console.log('Continue click:', clickResult);

await new Promise(r => setTimeout(r, 3000));
const text = await adsPage.evaluate(() => document.body.innerText.substring(0, 1500));
console.log('After continue:');
console.log(text.substring(0, 800));

await adsPage.screenshot({ path: 'C:\\Users\\ADMIN\\Music\\proyecto-unificado\\_step4_adset.png' });
await browser.disconnect();
