import puppeteer from 'puppeteer';

async function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function findClickable(page, text) {
  const selectors = ['button', '[role="button"]', 'a', 'span[role="button"]'];
  for (const sel of selectors) {
    const els = await page.$$(sel);
    for (const el of els) {
      const t = (await el.evaluate(e => (e.textContent || '').trim())) || '';
      const aria = (await el.evaluate(e => e.getAttribute('aria-label') || '')) || '';
      if (t.includes(text) || aria.includes(text)) return el;
    }
  }
  return null;
}

async function main() {
  console.log('🧠 CREANDO APP EN BUSINESS MANAGER...\n');
  
  const browser = await puppeteer.connect({ browserURL: 'http://127.0.0.1:9222', defaultViewport: null });
  let page = (await browser.pages()).find(p => p.url().includes('business') || p.url().includes('facebook'));
  if (!page) page = await browser.newPage();
  
  console.log('[1] Abriendo Apps en Business Manager...');
  await page.goto(
    'https://business.facebook.com/latest/settings/apps?business_id=4482432028697067',
    { timeout: 30000 }
  ).catch(() => {});
  await sleep(4000);
  
  // Find and click "Añadir" button
  console.log('[2] Click en Añadir...');
  const addBtn = await findClickable(page, 'Añadir');
  if (addBtn) {
    await addBtn.click();
    console.log('  Clicked Añadir');
    await sleep(3000);
  }
  
  await page.screenshot({ path: 'C:\\Users\\ADMIN\\Music\\screenshots\\add_app_dialog.png' });
  
  // Check dialog content
  const dialog = await page.evaluate(() => {
    const body = document.body.innerText || '';
    const btns = Array.from(document.querySelectorAll('button, [role="button"], a'))
      .map(b => ({ text: (b.textContent || '').trim().substring(0, 50), tag: b.tagName }))
      .filter(b => b.text)
      .slice(0, 15);
    return { text: body.substring(0, 600), buttons: btns };
  });
  
  console.log('Dialog:', dialog.text.substring(0, 300));
  console.log('Buttons:', JSON.stringify(dialog.buttons, null, 2));
  
  // Try clicking "Crear una aplicación" or similar
  const createAppBtn = await findClickable(page, 'Crear') || await findClickable(page, 'app');
  if (createAppBtn) {
    await createAppBtn.click();
    console.log('  Clicked Crear app');
    await sleep(3000);
    await page.screenshot({ path: 'C:\\Users\\ADMIN\\Music\\screenshots\\create_app_form.png' });
  }
  
  const formState = await page.evaluate(() => document.body.innerText.substring(0, 600));
  console.log('Form:', formState);
  
  // Look for inputs to fill
  const inputs = await page.evaluate(() => {
    return Array.from(document.querySelectorAll('input')).map(i => ({
      id: i.id,
      placeholder: i.placeholder || '',
      type: i.type,
      ariaLabel: i.getAttribute('aria-label') || '',
    })).slice(0, 10);
  });
  console.log('Inputs:', JSON.stringify(inputs, null, 2));
  
  if (inputs.length > 0) {
    // Fill app name
    const nameInput = inputs.find(i => 
      i.placeholder?.toLowerCase().includes('app') || 
      i.placeholder?.toLowerCase().includes('nombre') ||
      i.ariaLabel?.toLowerCase().includes('app') ||
      i.ariaLabel?.toLowerCase().includes('nombre')
    );
    if (nameInput && nameInput.id) {
      await page.type('#' + nameInput.id, 'VentasPro Bot');
      console.log('  Typed app name');
      await sleep(500);
    }
    
    // Click submit/create
    const submitBtn = await findClickable(page, 'Crear') || await findClickable(page, 'Continuar') || await findClickable(page, 'Siguiente');
    if (submitBtn) {
      await submitBtn.click();
      console.log('  Clicked submit');
      await sleep(3000);
      await page.screenshot({ path: 'C:\\Users\\ADMIN\\Music\\screenshots\\app_created.png' });
    }
  }
  
  const finalState = await page.evaluate(() => ({
    url: window.location.href,
    text: document.body.innerText.substring(0, 500)
  }));
  console.log('\nFinal:', finalState.text.substring(0, 300));
  
  console.log('\n✅ Proceso completado. Revisa las capturas en screenshots/');
  await browser.disconnect();
}

main().catch(e => console.log('ERROR:', e.message));
