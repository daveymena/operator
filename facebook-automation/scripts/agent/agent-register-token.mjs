import puppeteer from 'puppeteer';
import fs from 'fs';

async function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function main() {
  console.log('🧠 AGENTE CON VISION - REGISTRO + TOKEN EN 1 SOLO PASO\n');
  
  const browser = await puppeteer.connect({ browserURL: 'http://127.0.0.1:9222', defaultViewport: null });
  let page = (await browser.pages()).find(p => p.url().includes('facebook') || p.url().includes('developers'));
  if (!page) page = await browser.newPage();
  
  // Go to Graph API Explorer
  console.log('[1/6] Abriendo Graph API Explorer...');
  await page.goto('https://developers.facebook.com/tools/explorer/', { timeout: 30000 }).catch(() => {});
  await sleep(3000);
  
  const initialState = await page.evaluate(() => ({
    url: window.location.href,
    needsRegister: document.body.innerText.includes('Register') || document.body.innerText.includes('register'),
    hasToken: document.body.innerText.includes('EA'),
  }));
  console.log(`  URL: ${initialState.url}`);
  console.log(`  Needs register: ${initialState.needsRegister}`);
  
  // CLICK REGISTER if needed
  if (initialState.needsRegister) {
    console.log('\n[2/6] Click en Register...');
    const clicked = await page.evaluate(() => {
      const btns = document.querySelectorAll('a, button, [role="button"]');
      for (const b of btns) {
        const t = (b.textContent || '').trim().toLowerCase();
        if (t === 'register' || t.includes('register as') || t.includes('registrarme')) {
          b.click();
          return t;
        }
      }
      return null;
    });
    console.log(`  Clicked: ${clicked}`);
    await sleep(5000);
    
    const afterRegister = await page.evaluate(() => ({
      url: window.location.href,
      title: document.title,
      text: document.body.innerText.substring(0, 500)
    }));
    console.log(`  URL: ${afterRegister.url}`);
    console.log(`  Title: ${afterRegister.title}`);
  }
  
  // Check if we're now on the explorer page or need to go back
  await page.goto('https://developers.facebook.com/tools/explorer/', { timeout: 20000 }).catch(() => {});
  await sleep(3000);
  
  const explorerState = await page.evaluate(() => ({
    url: window.location.href,
    title: document.title,
    onExplorer: window.location.href.includes('explorer'),
    text: document.body.innerText.substring(0, 400)
  }));
  console.log(`\n[3/6] Explorer state: ${explorerState.onExplorer}`);
  console.log(`  ${explorerState.text.substring(0, 200)}`);
  
  // Try to find and click "Get Access Token" button
  if (explorerState.onExplorer) {
    console.log('\n[4/6] Click en "Obtener identificador de acceso"...');
    
    // Find the button by text
    const tokenBtnClicked = await page.evaluate(() => {
      const allElements = document.querySelectorAll('*');
      for (const el of allElements) {
        if (el.textContent?.trim().includes('Obtener identificador') || 
            el.textContent?.trim().includes('Get Access') ||
            el.textContent?.trim().includes('identificador de acceso')) {
          if (el.tagName === 'BUTTON' || el.tagName === 'A' || el.getAttribute('role') === 'button' || el.closest('button') || el.closest('a')) {
            const target = el.closest('button') || el.closest('a') || el;
            target.click();
            return true;
          }
        }
      }
      return false;
    });
    console.log(`  Token button clicked: ${tokenBtnClicked}`);
    await sleep(3000);
    
    // Screenshot
    await page.screenshot({ path: 'C:\\Users\\ADMIN\\Music\\screenshots\\token_dialog.png' });
    
    // Check what appeared
    const dialogState = await page.evaluate(() => {
      const allText = document.body.innerText;
      return {
        hasDialog: allText.includes('Seleccionar') || allText.includes('Select'),
        hasLoginAgain: allText.includes('Iniciar sesión') || allText.includes('Log In'),
        text: allText.substring(0, 600)
      };
    });
    console.log(`\n[5/6] Dialog state:`);
    console.log(`  Has dialog: ${dialogState.hasDialog}`);
    console.log(`  Has login: ${dialogState.hasLoginAgain}`);
    
    // If a dialog popped up, it might be asking for app selection or permissions
    // Let's take a screenshot for analysis
  }
  
  // Final check for token
  console.log('\n[6/6] Buscando token en la pagina...');
  const finalTokens = await page.evaluate(() => {
    const result = [];
    document.querySelectorAll('input').forEach(inp => {
      if (inp.value && inp.value.startsWith('EA')) result.push(inp.value);
    });
    document.querySelectorAll('code, pre, .token-value, [class*="token"]').forEach(el => {
      const t = el.textContent || '';
      if (t.startsWith('EA')) result.push(t);
    });
    return result;
  });
  
  if (finalTokens.length > 0) {
    const token = finalTokens.sort((a, b) => b.length - a.length)[0];
    console.log(`\n🎉 TOKEN ENCONTRADO: ${token.substring(0, 50)}...`);
    
    // Save and configure
    const result = {
      accessToken: token,
      pageId: '1278583508663384',
      pageName: 'VentasPro - Cursos Digitales',
      adAccountId: '',
      bmId: '4482432028697067'
    };
    
    try {
      const me = await fetch(`https://graph.facebook.com/v21.0/me?access_token=${token}&fields=name,id`);
      const meJson = await me.json();
      if (meJson.id) {
        console.log(`  Token valido! User: ${meJson.name}`);
        const pages = await fetch(`https://graph.facebook.com/v21.0/me/accounts?access_token=${token}&fields=name,id,access_token`);
        const pJson = await pages.json();
        if (pJson.data?.length > 0) {
          result.pageAccessToken = pJson.data[0].access_token || token;
          result.pageName = pJson.data[0].name;
          console.log(`  Page: ${pJson.data[0].name}`);
        }
        const ads = await fetch(`https://graph.facebook.com/v21.0/me/adaccounts?access_token=${token}&fields=id,name,account_id`);
        const aJson = await ads.json();
        if (aJson.data?.length > 0) {
          result.adAccountId = aJson.data[0].account_id;
          console.log(`  Ad Account: ${aJson.data[0].account_id}`);
        }
      }
    } catch(e) { console.log(`  Val: ${e.message}`); }
    
    fs.writeFileSync('C:\\Users\\ADMIN\\Music\\fb_tokens_output.json', JSON.stringify(result, null, 2));
    console.log('\n✅ TODO CONFIGURADO! Revisa fb_tokens_output.json');
  } else {
    console.log('\n⚠️ Token no disponible aun. Revisa las capturas en screenshots/');
    console.log('Alli deberia aparecer el dialogo para registrarte como Developer.');
    console.log('Cuando completes el registro, ejecuta: node agent-register-token.mjs');
  }
  
  await page.screenshot({ path: 'C:\\Users\\ADMIN\\Music\\screenshots\\estado_final.png' });
  console.log('\nCaptura final guardada.');
  await browser.disconnect();
}

main().catch(e => console.log('ERROR:', e.message));
