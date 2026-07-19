import puppeteer from 'puppeteer';
const SS = 'C:\\Users\\ADMIN\\Music\\ss_ads';
async function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function main() {
  console.log('🔍 Explorando Crear en Ads Manager\n');
  
  const browser = await puppeteer.connect({ browserURL: 'http://127.0.0.1:9222', defaultViewport: null });
  const page = await browser.newPage();
  
  await page.goto('https://adsmanager.facebook.com/adsmanager/manage/campaigns?act=1545022093928422&business_id=4482432028697067', {
    waitUntil: 'networkidle2', timeout: 30000
  }).catch(() => {});
  await sleep(6000);
  await page.screenshot({ path: `${SS}\\z01_antes.png` });
  console.log('Screenshot: z01_antes.png');
  
  // Click en Crear
  const els = await page.$$('[role="button"], button, div[role="button"], a');
  let clicked = false;
  for (const el of els) {
    try {
      const t = await el.evaluate(e => (e.textContent || '').trim());
      if (t === 'Crear' || t.startsWith('Crear')) {
        await el.click();
        clicked = true;
        console.log('Click en Crear: OK');
        break;
      }
    } catch(e) {}
  }
  
  if (!clicked) {
    // Intentar con XPath
    const crears = await page.$x("//*[text()='Crear']");
    if (crears.length > 0) {
      await crears[0].click();
      clicked = true;
      console.log('Click en Crear (XPath): OK');
    }
  }
  
  await sleep(5000);
  await page.screenshot({ path: `${SS}\\z02_despues.png` });
  console.log('Screenshot: z02_despues.png');
  
  // Esperar un poco mas y capturar de nuevo
  await sleep(5000);
  await page.screenshot({ path: `${SS}\\z03_despues2.png` });
  console.log('Screenshot: z03_despues2.png');
  
  // Obtener texto de la pagina
  const text = await page.evaluate(() => document.body.innerText);
  console.log('\n--- TEXTO PAGINA ---');
  console.log(text.substring(0, 1500));
  
  // Contar inputs
  const inputCount = await page.evaluate(() => {
    return document.querySelectorAll('input:not([type="hidden"])').length;
  });
  console.log(`\nInputs visibles: ${inputCount}`);
  
  // Buscar botones visibles
  const btns = await page.evaluate(() => {
    const btns = [];
    document.querySelectorAll('button, [role="button"], [role="menuitem"], [role="option"], [role="tab"]').forEach(el => {
      const text = (el.textContent || '').trim();
      if (text && text.length < 60) btns.push(text);
    });
    return [...new Set(btns)].slice(0, 40);
  });
  console.log('\nBotones disponibles:');
  btns.forEach(b => console.log(`  "${b}"`));
  
  // Buscar campos de entrada
  const inputs = await page.evaluate(() => {
    const fields = [];
    document.querySelectorAll('input:not([type="hidden"]), textarea, [contenteditable="true"]').forEach(el => {
      const p = el.getAttribute('placeholder') || '';
      const al = el.getAttribute('aria-label') || '';
      const n = el.getAttribute('name') || '';
      const rect = el.getBoundingClientRect();
      if (rect.width > 30 && rect.height > 15) {
        fields.push({ ph: p, label: al, name: n, type: el.type || el.tagName });
      }
    });
    return fields.slice(0, 30);
  });
  console.log('\nCampos visibles:');
  inputs.forEach(f => console.log(`  placeholder="${f.ph || '-'}" aria-label="${f.label || '-'}" name="${f.name}" type=${f.type}`));
  
  await page.close();
  await browser.disconnect();
  console.log('\n✅ Done');
}

main().catch(e => console.log('ERROR:', e.message));
