const puppeteer = require('puppeteer');
const fs = require('fs');

const SCREENSHOT_DIR = 'C:/Users/ADMIN/Music/proyecto-unificado/operator/screenshots';
fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });

async function getTab() {
  const b = await puppeteer.connect({ browserURL: 'http://127.0.0.1:9222', defaultViewport: null });
  const pages = await b.pages();
  // buscar la pestaña con facebook o developers
  let page = pages.find(p => p.url().includes('facebook') || p.url().includes('developers'));
  if (!page) page = pages[0];
  return { b, page };
}

async function snap(name) {
  const { page } = await getTab();
  if (!page) return;
  const file = `${SCREENSHOT_DIR}/${name}.png`;
  await page.screenshot({ path: file, fullPage: false }).catch(() => {});
  const text = await page.evaluate(() => document.body.innerText).catch(() => 'N/A');
  console.log(`=== ${name} ===`);
  console.log('URL:', page.url());
  console.log(text.substring(0, 1500));
  console.log('---');
}

(async () => {
  const cmd = process.argv[2] || 'status';
  
  if (cmd === 'status') {
    const b = await puppeteer.connect({ browserURL: 'http://127.0.0.1:9222', defaultViewport: null });
    const pages = await b.pages();
    for (const p of pages) {
      console.log(`URL: ${p.url()} | TITLE: ${await p.title().catch(() => '')}`);
    }
    b.disconnect();
  } else if (cmd === 'snap') {
    await snap(process.argv[3] || 'current');
  } else if (cmd === 'goto') {
    const { page } = await getTab();
    await page.goto(process.argv[3], { waitUntil: 'networkidle2', timeout: 30000 }).catch(() => {});
    await new Promise(r => setTimeout(r, 3000));
    await snap('after_goto');
  } else if (cmd === 'click') {
    const { page } = await getTab();
    const text = process.argv[3];
    const els = await page.$$('button, [role="button"], a, span, label, div[role="option"], li, input[type="submit"]');
    let clicked = false;
    for (const el of els) {
      const t = await el.evaluate(e => (e.textContent || '').trim().toLowerCase()).catch(() => '');
      if (t.includes(text.toLowerCase())) {
        await el.click();
        clicked = true;
        console.log(`Clicked: ${t.substring(0, 50)}`);
        break;
      }
    }
    if (!clicked) console.log(`NOT FOUND: ${text}`);
    await new Promise(r => setTimeout(r, 2000));
    await snap('after_click');
  } else if (cmd === 'type') {
    const { page } = await getTab();
    await page.keyboard.type(process.argv[3], { delay: 30 });
    console.log(`Typed: ${process.argv[3].substring(0, 30)}`);
  } else if (cmd === 'press') {
    const { page } = await getTab();
    const key = process.argv[3];
    const map = { enter: 'Enter', tab: 'Tab', escape: 'Escape', space: ' ' };
    await page.keyboard.press(map[key.toLowerCase()] || key);
    console.log(`Pressed: ${key}`);
    await new Promise(r => setTimeout(r, 1000));
  } else if (cmd === 'fill') {
    const { page } = await getTab();
    const selector = process.argv[3];
    const text = process.argv[4];
    await page.waitForSelector(selector, { timeout: 5000 }).catch(() => {});
    await page.click(selector, { clickCount: 3 }).catch(() => {});
    await page.type(selector, text, { delay: 20 });
    console.log(`Filled ${selector} with ${text.substring(0, 30)}`);
  } else if (cmd === 'eval') {
    const { page } = await getTab();
    const code = process.argv[3];
    const result = await page.evaluate(new Function(code));
    console.log('Result:', typeof result === 'object' ? JSON.stringify(result).substring(0, 1000) : String(result).substring(0, 1000));
  } else if (cmd === 'text') {
    const { page } = await getTab();
    const text = await page.evaluate(() => document.body.innerText).catch(() => 'N/A');
    console.log(text.substring(0, 3000));
  }
  
  process.exit(0);
})().catch(e => { console.error('Error:', e.message); process.exit(1); });