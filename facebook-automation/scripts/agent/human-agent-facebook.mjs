import puppeteer from 'puppeteer';
import fs from 'fs';

async function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function main() {
  console.log('🧠 AGENTE HUMANO - CONECTANDO A CHROME...');
  const browser = await puppeteer.connect({ browserURL: 'http://127.0.0.1:9222', defaultViewport: null });

  // Get all Facebook pages
  const allPages = await browser.pages();
  let page = allPages.find(p => p.url().includes('facebook.com') || p.url().includes('business.facebook.com'));
  if (!page) page = await browser.newPage();

  console.log(`📄 Pagina actual: ${await page.title()}`);
  
  // Step 1: Navigate to Business Settings using normal navigation (like a human)
  console.log('\n🖱️ [1] Navegando a configuracion de la pagina...');
  await page.goto('https://business.facebook.com/latest/settings/pages?business_id=4482432028697067', { 
    waitUntil: 'networkidle2', timeout: 30000 
  }).catch(() => console.log('  ⚠️ Timeout, continuando...'));
  await sleep(3000);
  
  // Screenshot
  await page.screenshot({ path: 'C:\\Users\\ADMIN\\Music\\fb-step1.png' });
  console.log('  📸 Screenshot guardado: fb-step1.png');

  // Step 2: Click on the page "VentasPro" link
  console.log('\n🖱️ [2] Buscando enlace a VentasPro...');
  try {
    const pageLink = await page.$('a[href*="1278583508663384"], a[href*="VentasPro"]');
    if (pageLink) {
      await pageLink.click();
      await sleep(3000);
      console.log('  ✅ Click en pagina exitoso');
    } else {
      console.log('  ⚠️ No se encontro enlace directo, navegando por URL...');
      await page.goto(`https://www.facebook.com/1278583508663384/settings/?tab=advanced_messaging`, { 
        waitUntil: 'networkidle2', timeout: 30000 
      }).catch(() => {});
      await sleep(3000);
    }
  } catch(e) { console.log(`  ⚠️ Error: ${e.message}`); }
  
  await page.screenshot({ path: 'C:\\Users\\ADMIN\\Music\\fb-step2.png' });
  
  // Step 3: Try to find the Page Access Token from the page settings
  console.log('\n🧐 [3] Analizando pagina con vision IA...');
  
  const pageContent = await page.evaluate(() => ({
    url: window.location.href,
    title: document.title,
    body: document.body.innerText?.substring(0, 2000) || ''
  }));
  console.log(`  URL: ${pageContent.url}`);
  console.log(`  Title: ${pageContent.title}`);
  
  // Step 4: Try to find tokens in the page or via Graph API using cookies
  console.log('\n🔑 [4] Extrayendo token de sesion...');
  
  const cookies = await page.cookies();
  const fbCookie = cookies.find(c => c.name === 'c_user' || c.name === 'xs');
  if (fbCookie) console.log(`  Cookie de sesion encontrada: ${fbCookie.name}=${fbCookie.value?.substring(0, 20)}...`);
  
  // Step 5: Navigate to the Graph API Explorer and get a token
  console.log('\n🌐 [5] Abriendo Graph API Explorer...');
  await page.goto('https://developers.facebook.com/tools/explorer/', { 
    waitUntil: 'networkidle2', timeout: 30000 
  }).catch(() => console.log('  ⚠️ Timeout en Graph Explorer'));
  await sleep(4000);
  
  await page.screenshot({ path: 'C:\\Users\\ADMIN\\Music\\fb-step3.png' });
  console.log('  📸 Screenshot: fb-step3.png');
  
  const explorerStatus = await page.evaluate(() => ({
    url: window.location.href,
    title: document.title,
    isLoggedIn: !document.body.innerText.includes('Iniciar sesión') && !document.body.innerText.includes('Log In'),
    containsExplorer: document.body.innerText.includes('Graph API') || document.body.innerText.includes('Explorer'),
    bodyPreview: document.body.innerText?.substring(0, 300)
  }));
  console.log(`  Logeado en Developers: ${explorerStatus.isLoggedIn}`);
  console.log(`  En Explorer: ${explorerStatus.containsExplorer}`);
  
  if (!explorerStatus.isLoggedIn) {
    console.log('\n⚠️ No estás logeado en Meta Developers.');
    console.log('Voy a intentar logear con tu sesion de Facebook...');
    
    // Click login button if present
    try {
      const loginBtn = await page.$('a[href*="login"], button:has-text("Log In"), button:has-text("Iniciar sesión")');
      if (loginBtn) {
        console.log('  🖱️ Click en boton de login...');
        await loginBtn.click();
        await sleep(4000);
        await page.screenshot({ path: 'C:\\Users\\ADMIN\\Music\\fb-step4-login.png' });
        
        // Check if already logged in via Facebook
        const afterLogin = await page.evaluate(() => window.location.href);
        console.log(`  URL despues: ${afterLogin}`);
      }
    } catch(e) { console.log(`  Error: ${e.message}`); }
  }
  
  // Step 6: Final attempt - create a System User token via Business Manager
  if (!explorerStatus.isLoggedIn || !explorerStatus.containsExplorer) {
    console.log('\n⚠️ No se pudo acceder al Graph API Explorer.');
    console.log('INGRESA MANUALMENTE:');
    console.log('  1. Abre https://developers.facebook.com/');
    console.log('  2. Inicia sesion con tu cuenta de Facebook');
    console.log('  3. Ve a Tools > Graph API Explorer');
    console.log('  4. Selecciona "VentasPro - Cursos Digitales"');
    console.log('  5. Permisos: pages_read_engagement, pages_manage_metadata, business_management, ads_management, pages_messaging');
    console.log('  6. Genera token y pegamelo AQUI');
    console.log('\n  O crea un System User en Business Settings:');
    console.log('  https://business.facebook.com/latest/settings/system_users?business_id=4482432028697067');
  }
  
  await browser.disconnect();
  console.log('\n🏁 FIN - Dejando Chrome abierto para que trabajes');
}

main().catch(e => console.log('ERROR:', e.message));
