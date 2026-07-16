import puppeteer from 'puppeteer';
import fs from 'fs';

async function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function main() {
  console.log('🧠 AGENTE HUMANO - Usando sesion de Facebook para obtener token...\n');
  
  const browser = await puppeteer.connect({ browserURL: 'http://127.0.0.1:9222', defaultViewport: null });
  let page = (await browser.pages()).find(p => p.url().includes('facebook.com') || p.url().includes('business.facebook.com'));
  if (!page) page = await browser.newPage();

  // Step 1: Ensure we're on Facebook
  await page.goto('https://www.facebook.com/', { waitUntil: 'networkidle2', timeout: 20000 }).catch(() => {});
  await sleep(2000);
  
  // Step 2: Execute JavaScript to get an access token using Facebook's internal API
  // Since the user is logged in, we can call the FB API from the page context
  console.log('[1/4] Solicitando token via Facebook internal API...');
  
  const tokenResult = await page.evaluate(async () => {
    try {
      // Try to use Facebook's internal API to get a page access token
      const response = await fetch('https://graph.facebook.com/v21.0/me/accounts?fields=name,id,access_token&limit=1', {
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' }
      });
      const data = await response.json();
      return { success: true, data };
    } catch(e) {
      return { success: false, error: e.message };
    }
  });
  
  if (tokenResult.success) {
    console.log('✅ API response:', JSON.stringify(tokenResult.data).substring(0, 300));
    if (tokenResult.data?.data?.length > 0) {
      const page = tokenResult.data.data[0];
      console.log(`\n🎉 PAGINA ENCONTRADA: ${page.name}`);
      console.log(`   ID: ${page.id}`);
      console.log(`   Token: ${page.access_token ? page.access_token.substring(0, 50) + '...' : 'NO DISPONIBLE'}`);
      
      if (page.access_token) {
        const finalData = {
          accessToken: page.access_token,
          userToken: '',
          pageId: page.id,
          pageName: page.name,
          bmId: '4482432028697067',
          adAccountId: '',
          pixelId: ''
        };
        fs.writeFileSync('C:\\Users\\ADMIN\\Music\\fb_tokens_output.json', JSON.stringify(finalData, null, 2));
        console.log('✅ Token guardado en fb_tokens_output.json!');
        
        // Get ad accounts too
        try {
          const adResponse = await fetch(`https://graph.facebook.com/v21.0/me/adaccounts?fields=id,name,account_id&limit=1&access_token=${page.access_token}`);
          const adData = await adResponse.json();
          if (adData.data?.length > 0) {
            finalData.adAccountId = adData.data[0].account_id;
            console.log(`📊 Ad Account: ${adData.data[0].name} (${adData.data[0].account_id})`);
          }
        } catch(e) { console.log('Ad account error:', e.message); }
        
        fs.writeFileSync('C:\\Users\\ADMIN\\Music\\fb_tokens_output.json', JSON.stringify(finalData, null, 2));
        console.log('✅ Configuracion completa guardada!');
        
        // Configurar .env con los tokens
        const envPath = 'C:\\Users\\ADMIN\\Videos\\Agent-Sales-Bot\\.env';
        let env = fs.readFileSync(envPath, 'utf8');
        const fbSection = `
# ========== FACEBOOK (CONFIGURADO AUTOMATICAMENTE) ==========
FB_ACCESS_TOKEN=${finalData.accessToken}
FB_PAGE_ID=${finalData.pageId}
FB_AD_ACCOUNT_ID=${finalData.adAccountId || ''}
FB_WEBHOOK_VERIFY_TOKEN=salesbot_verify_2024
FB_MESSENGER_VERIFY_TOKEN=salesbot_messenger_2024
`;
        
        if (env.includes('FB_ACCESS_TOKEN=')) {
          env = env.replace(/FB_ACCESS_TOKEN=.*\n/, `FB_ACCESS_TOKEN=${finalData.accessToken}\n`);
          env = env.replace(/FB_PAGE_ID=.*\n/, `FB_PAGE_ID=${finalData.pageId}\n`);
          env = env.replace(/FB_AD_ACCOUNT_ID=.*\n/, `FB_AD_ACCOUNT_ID=${finalData.adAccountId || ''}\n`);
        } else {
          env += fbSection;
        }
        
        fs.writeFileSync(envPath, env, 'utf8');
        console.log('✅ .env actualizado con tokens de Facebook!');
        return;
      }
    }
  }
  
  // Fallback: Try to use Facebook's FB API from the page
  console.log('\n[2/4] Metodo alternativo: usando FB SDK desde la pagina...');
  
  const altResult = await page.evaluate(async () => {
    return new Promise((resolve) => {
      // Check if FB is available
      if (typeof FB !== 'undefined') {
        FB.getLoginStatus(function(response) {
          resolve({ fbAvailable: true, authResponse: response.authResponse || null });
        });
      } else {
        resolve({ fbAvailable: false, error: 'FB SDK not loaded' });
      }
    });
  });
  
  console.log('FB SDK result:', JSON.stringify(altResult));
  
  // Fallback: Request the token from Graph API using cookies
  if (!tokenResult.success) {
    console.log('\n[3/4] Metodo final: token via cookies de sesion...');
  }
  
  // Last fallback
  console.log('\n[4/4] Si no se obtuvo token automaticamente:');
  console.log('1. Abre https://developers.facebook.com/tools/explorer/');
  console.log('2. Selecciona "VentasPro - Cursos Digitales" como pagina');
  console.log('3. Permisos: pages_read_engagement, pages_manage_metadata, ads_management, pages_messaging');
  console.log('4. Genera token y pegamelo AQUI');
  
  await browser.disconnect();
}

main().catch(e => console.log('ERROR:', e.message));
