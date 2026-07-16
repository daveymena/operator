import puppeteer from 'puppeteer';
import fs from 'fs';

async function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function main() {
  console.log('🧠 SACANDO TOKEN DIRECTO DESDE BUSINESS MANAGER SIN DEVELOPER\n');
  
  const browser = await puppeteer.connect({ browserURL: 'http://127.0.0.1:9222', defaultViewport: null });
  let page = (await browser.pages()).find(p => p.url().includes('facebook') || p.url().includes('business'));
  if (!page) page = await browser.newPage();

  // METHOD 1: Try the classic page access token URL
  console.log('[1/4] Metodo 1 - Token directo desde la pagina...');
  
  // Facebook's old page token endpoint (sometimes still works)
  await page.goto('https://www.facebook.com/1278583508663384/settings/?tab=advanced_messaging', {
    timeout: 20000
  }).catch(() => {});
  await sleep(4000);
  
  let token = await page.evaluate(() => {
    const body = document.body.innerText || '';
    const m = body.match(/(EAAB?[A-Za-z0-9%._\/\-=,]{80,})/);
    if (m) return m[1];
    // Check inputs
    const inputs = document.querySelectorAll('input[type="text"]');
    for (const inp of inputs) {
      if (inp.value?.startsWith('EA')) return inp.value;
    }
    return '';
  });
  
  if (token) { console.log(`🎉 TOKEN: ${token.substring(0, 50)}...`); await validateAndSave(browser, token); return; }
  
  // METHOD 2: Use graph.facebook.com directly from the logged-in session
  console.log('\n[2/4] Metodo 2 - Token via Business Manager API...');
  
  await page.goto('https://business.facebook.com/latest/settings/pages?business_id=4482432028697067', {
    timeout: 20000
  }).catch(() => {});
  await sleep(4000);
  
  // Try to find the page and click it
  const pageLinks = await page.evaluate(() => {
    const links = Array.from(document.querySelectorAll('a'));
    return links.filter(l => l.href).map(l => ({
      text: (l.textContent || '').trim().substring(0, 60),
      href: l.href.substring(0, 150)
    })).filter(l => l.href.includes('facebook.com') && !l.href.includes('business'));
  });
  
  const ventasLink = pageLinks.find(l => l.text.includes('VentasPro') || l.href.includes('1278583508663384') || l.text.includes('Cursos'));
  if (ventasLink) {
    console.log(`  Link encontrado: ${ventasLink.text}`);
    await page.goto(ventasLink.href, { timeout: 20000 }).catch(() => {});
    await sleep(4000);
    
    // Now look for Page Settings → Advanced Messaging
    await page.goto(ventasLink.href.split('?')[0] + '/settings/?tab=advanced_messaging', { timeout: 20000 }).catch(() => {});
    await sleep(3000);
    
    token = await page.evaluate(() => {
      const body = document.body.innerText || '';
      const m = body.match(/(EAAB?[A-Za-z0-9%._\/\-=,]{80,})/);
      if (m) return m[1];
      const inputs = document.querySelectorAll('input[type="text"]');
      for (const inp of inputs) {
        if (inp.value?.startsWith('EA')) return inp.value;
      }
      return '';
    });
    
    if (token) { console.log(`🎉 TOKEN: ${token.substring(0, 50)}...`); await validateAndSave(browser, token); return; }
  }
  
  // METHOD 3: Try the www.facebook.com/pages URL
  console.log('\n[3/4] Metodo 3 - Pagina de paginas de Facebook...');
  await page.goto('https://www.facebook.com/pages', { timeout: 20000 }).catch(() => {});
  await sleep(4000);
  
  // Look for page link
  const fbPageLinks = await page.evaluate(() => {
    const links = Array.from(document.querySelectorAll('a'));
    return links.filter(l => l.href && l.href.includes('facebook.com') && !l.href.includes('business') && !l.href.includes('login') && !l.href.includes('settings'))
      .map(l => ({ text: (l.textContent || '').trim().substring(0, 60), href: l.href.substring(0, 150) }))
      .filter(l => l.text);
  });
  
  fbPageLinks.slice(0, 10).forEach(l => console.log(`  - ${l.text}: ${l.href.substring(0, 80)}`));
  
  // METHOD 4: Use the Facebook Graph API directly with a generated token from the page
  console.log('\n[4/4] Metodo 4 - Token via Facebook Login de la pagina...');
  
  // Try the page's own access token by using the Facebook JS SDK
  const pageTokenResult = await page.evaluate(async () => {
    try {
      // This might work if FB SDK is loaded
      if (typeof FB !== 'undefined') {
        return new Promise(resolve => {
          FB.api('/me/accounts', { fields: 'name,id,access_token' }, response => {
            resolve(JSON.stringify(response));
          });
        });
      }
      return 'FB SDK not loaded';
    } catch(e) {
      return 'Error: ' + e.message;
    }
  });
  console.log('  FB SDK result:', pageTokenResult.substring(0, 200));
  
  console.log('\n⚠️ No se pudo obtener token automaticamente.');
  console.log('Prueba esto manualmente en el Chrome abierto:');
  console.log('1. Ve a https://business.facebook.com/latest/settings/system_users?business_id=4482432028697067');
  console.log('2. Click "Añadir" -> crea usuario "SalesBot"');
  console.log('3. Asigna pagina "VentasPro - Cursos Digitales"');
  console.log('4. Genera token -> copialo y pasamelo');
  
  await browser.disconnect();
}

async function validateAndSave(browser, token) {
  console.log('\n💾 Guardando token...');
  try {
    const me = await fetch(`https://graph.facebook.com/v21.0/me?access_token=${token}&fields=name,id`);
    const json = await me.json();
    const result = { accessToken: token, pageId: '1278583508663384', pageName: json.name || 'VentasPro', adAccountId: '', bmId: '4482432028697067' };
    
    if (json.id) {
      console.log(`Token valido para: ${json.name}`);
      const pages = await fetch(`https://graph.facebook.com/v21.0/me/accounts?access_token=${token}&fields=name,id,access_token`);
      const pJson = await pages.json();
      if (pJson.data?.length > 0) {
        result.pageId = pJson.data[0].id;
        result.pageName = pJson.data[0].name;
        result.pageAccessToken = pJson.data[0].access_token || token;
      }
      const ads = await fetch(`https://graph.facebook.com/v21.0/me/adaccounts?access_token=${token}&fields=id,name,account_id`);
      const aJson = await ads.json();
      if (aJson.data?.length > 0) result.adAccountId = aJson.data[0].account_id;
    } else {
      result.pageAccessToken = token;
    }
    
    fs.writeFileSync('C:\\Users\\ADMIN\\Music\\fb_tokens_output.json', JSON.stringify(result, null, 2));
    console.log('✅ Guardado!');
    
    // Update .env
    const envPath = 'C:\\Users\\ADMIN\\Videos\\Agent-Sales-Bot\\.env';
    let env = fs.readFileSync(envPath, 'utf8');
    const updates = {
      'FB_ACCESS_TOKEN': result.accessToken,
      'FB_PAGE_ID': result.pageId,
      'FB_AD_ACCOUNT_ID': result.adAccountId || '',
      'FB_MESSENGER_PAGE_TOKEN': result.pageAccessToken || result.accessToken,
    };
    for (const [k, v] of Object.entries(updates)) {
      const re = new RegExp(`${k}=.*`, '');
      if (env.match(re)) env = env.replace(re, `${k}=${v}`);
      else env += `\n${k}=${v}`;
    }
    fs.writeFileSync(envPath, env, 'utf8');
    console.log('.env actualizado');
    console.log('\n✅ FACEBOOK LISTO! Abre http://localhost:3002');
  } catch(e) { console.log('Error:', e.message); }
  await browser.disconnect();
}

main().catch(e => console.log('ERROR:', e.message));
