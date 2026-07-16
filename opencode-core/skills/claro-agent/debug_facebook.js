const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
puppeteer.use(StealthPlugin());

async function main() {
  console.log('Conectando...');
  const browser = await puppeteer.connect({ browserURL: 'http://127.0.0.1:9222', defaultViewport: null });
  const pages = await browser.pages();
  let p = pages.find(x => x.url().includes('facebook.com'));
  if (!p) { console.log('No Facebook page!'); return; }
  console.log('URL:', p.url());
  const info = await p.evaluate(() => {
    const inputs = document.querySelectorAll('input');
    const buttons = document.querySelectorAll('button');
    return {
      inputs: Array.from(inputs).map(el => ({
        type: el.type, name: el.name, id: el.id,
        placeholder: el.placeholder, autocomplete: el.autocomplete,
        visible: el.offsetParent !== null
      })),
      buttons: Array.from(buttons).map(el => ({
        type: el.type, name: el.name,
        text: el.innerText ? el.innerText.substring(0, 50) : ''
      }))
    };
  });
  console.log('Inputs:', JSON.stringify(info.inputs, null, 2));
  console.log('Buttons:', JSON.stringify(info.buttons, null, 2));
  await browser.disconnect();
  console.log('Done.');
}
main().catch(e => { console.error('Error:', e.message); process.exit(1); });
