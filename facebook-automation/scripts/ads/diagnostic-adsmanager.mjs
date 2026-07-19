import puppeteer from 'puppeteer';

const SS = 'C:\\Users\\ADMIN\\Music\\ss_ads';
async function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
async function shot(page, name) {
  const p = `${SS}\\diag_${name}.png`;
  await page.screenshot({ path: p, fullPage: true });
  console.log(`  📸 ${p}`);
}

async function main() {
  console.log('🔍 Diagnosticando Ads Manager UI...\n');
  
  const browser = await puppeteer.connect({ browserURL: 'http://127.0.0.1:9222', defaultViewport: null });
  const page = await browser.newPage();
  
  // Navegar al Ads Manager
  console.log('[1] Navegando a Ads Manager...');
  await page.goto('https://adsmanager.facebook.com/adsmanager/manage/campaigns?act=1545022093928422&business_id=4482432028697067', {
    waitUntil: 'networkidle2',
    timeout: 30000
  }).catch(() => {});
  await sleep(5000);
  await shot(page, 'adsmanager');
  
  // Extraer estructura completa del DOM para entender la UI
  console.log('\n[2] Analizando estructura del DOM...');
  const domInfo = await page.evaluate(() => {
    function getSelector(el, depth = 0) {
      if (!el || depth > 5) return '';
      let sel = el.tagName.toLowerCase();
      if (el.id) sel += `#${el.id}`;
      if (el.className && typeof el.className === 'string') {
        sel += '.' + el.className.split(' ').filter(c => c).slice(0, 2).join('.');
      }
      return sel;
    }
    
    // Buscar botones "Crear" o "Create"
    const allButtons = document.querySelectorAll('button, [role="button"], a[role="button"]');
    const buttons = [];
    allButtons.forEach(b => {
      const text = (b.textContent || '').trim();
      if (text && text.length < 50) {
        buttons.push({
          text: text.substring(0, 40),
          tag: b.tagName,
          attrs: {
            id: b.id || '',
            class: (b.className && typeof b.className === 'string') ? b.className.substring(0, 80) : '',
            href: b.href || '',
            'aria-label': b.getAttribute('aria-label') || '',
            'data-testid': b.getAttribute('data-testid') || '',
            role: b.getAttribute('role') || ''
          },
          selector: getSelector(b),
          rect: b.getBoundingClientRect()
        });
      }
    });
    
    // Buscar por data-testid relevante
    const testIds = [];
    document.querySelectorAll('[data-testid]').forEach(el => {
      const tid = el.getAttribute('data-testid');
      if (tid && (tid.includes('create') || tid.includes('Crear') || tid.includes('campaign') || tid.includes('ad'))) {
        testIds.push({
          testid: tid,
          tag: el.tagName,
          text: (el.textContent || '').substring(0, 40)
        });
      }
    });
    
    // Buscar iframes
    const iframes = [];
    document.querySelectorAll('iframe').forEach(f => {
      iframes.push({
        id: f.id,
        src: (f.src || '').substring(0, 100),
        title: f.title
      });
    });
    
    return {
      url: window.location.href,
      title: document.title,
      buttons,
      testIds,
      iframes,
      pageText: document.body.innerText.substring(0, 1000)
    };
  });
  
  console.log(`\nURL: ${domInfo.url}`);
  console.log(`Title: ${domInfo.title}`);
  console.log(`\nIframes encontrados: ${domInfo.iframes.length}`);
  domInfo.iframes.forEach(f => console.log(`  iframe: id="${f.id}" src="${f.src}"`));
  
  console.log(`\nBotones encontrados:`);
  domInfo.buttons.forEach(b => {
    if (b.text) console.log(`  "${b.text}" | testid="${b.attrs['data-testid']}" | ${b.selector}`);
  });
  
  console.log(`\ndata-testid relevantes:`);
  domInfo.testIds.forEach(t => console.log(`  ${t.testid} | ${t.text}`));
  
  console.log(`\n--- Texto pagina (primeros 600) ---`);
  console.log(domInfo.pageText.substring(0, 600));
  
  // Intentar hacer click en "Crear"
  console.log('\n[3] Intentando click en Crear...');
  
  // Metodo 1: por texto
  const clickByText = async (text) => {
    const els = await page.$$('button, [role="button"], a');
    for (const el of els) {
      try {
        const t = await el.evaluate(e => (e.textContent || '').trim());
        if (t.includes(text)) {
          await el.click();
          return true;
        }
      } catch(e) {}
    }
    return false;
  };
  
  const clicked = await clickByText('Crear') || await clickByText('Create');
  console.log(`  Click por texto "Crear": ${clicked}`);
  
  if (clicked) {
    await sleep(4000);
    await shot(page, 'despues_crear');
    
    const afterText = await page.evaluate(() => document.body.innerText.substring(0, 500));
    console.log(`  Texto despues: ${afterText.substring(0, 300)}`);
  } else {
    console.log('  No se encontro el boton Crear');
  }
  
  await page.close();
  await browser.disconnect();
  console.log('\n✅ Diagnostico completado');
}

main().catch(e => console.log('ERROR:', e));
