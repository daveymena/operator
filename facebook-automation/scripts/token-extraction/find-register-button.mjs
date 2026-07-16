import puppeteer from 'puppeteer';

async function main() {
  const browser = await puppeteer.connect({ browserURL: 'http://127.0.0.1:9222', defaultViewport: null });
  let page = (await browser.pages()).find(p => p.url().includes('facebook') || p.url().includes('developers'));
  if (!page) page = await browser.newPage();
  
  await page.goto('https://developers.facebook.com/tools/explorer/', { timeout: 30000 }).catch(() => {});
  await new Promise(r => setTimeout(r, 3000));
  
  // Get ALL buttons and links with their exact HTML
  const elements = await page.evaluate(() => {
    const result = [];
    const allElements = document.querySelectorAll('button, a[href], [role="button"]');
    allElements.forEach(el => {
      const text = (el.textContent || '').trim().substring(0, 100);
      const html = el.outerHTML?.substring(0, 200) || '';
      const href = el.getAttribute('href') || '';
      const onclick = el.getAttribute('onclick') || '';
      const id = el.id || '';
      const cls = (el.className || '').substring(0, 60);
      if (text.toLowerCase().includes('register') || text.toLowerCase().includes('registr') || 
          text.toLowerCase().includes('token') || text.toLowerCase().includes('identificador') ||
          href.includes('register') || href.includes('registration')) {
        result.push({ text: text.substring(0, 80), href: href.substring(0, 150), id, class: cls, onclick: onclick.substring(0, 100), html: html });
      }
    });
    return result;
  });
  
  console.log('=== BOTONES DE REGISTRO/TOKEN ENCONTRADOS ===');
  elements.forEach((el, i) => {
    console.log(`\n[${i+1}] Text: "${el.text}"`);
    console.log(`    Href: "${el.href}"`);
    console.log(`    ID: "${el.id}"`);
    console.log(`    Class: "${el.class}"`);
    console.log(`    OnClick: "${el.onclick}"`);
    console.log(`    HTML: ${el.html}`);
  });
  
  if (elements.length === 0) {
    console.log('\nNo se encontraron elementos de registro/token');
    const bodyText = await page.evaluate(() => document.body.innerText.substring(0, 1000));
    console.log('Body text:', bodyText);
  } else {
    // Click the first real register button
    const registerEl = elements.find(e => e.href.includes('register') || e.text.toLowerCase().includes('register'));
    if (registerEl) {
      console.log(`\nClick en: ${registerEl.text}`);
      // Navigate directly to the register URL if there's an href
      if (registerEl.href && registerEl.href.startsWith('http')) {
        await page.goto(registerEl.href, { timeout: 30000 }).catch(() => {});
        await new Promise(r => setTimeout(r, 5000));
        console.log('After navigation:', page.url());
        console.log('Title:', await page.title());
      }
    }
  }
  
  await page.screenshot({ path: 'C:\\Users\\ADMIN\\Music\\screenshots\\register_page.png' });
  console.log('\nScreenshot saved');
  
  await browser.disconnect();
}

main().catch(e => console.log('ERROR:', e.message));
