import puppeteer from 'puppeteer';
import fs from 'fs';

async function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function main() {
  console.log('🧠 INTERACTUANDO CON GRAPH API EXPLORER...\n');
  
  const browser = await puppeteer.connect({ browserURL: 'http://127.0.0.1:9222', defaultViewport: null });
  let page = (await browser.pages()).find(p => p.url().includes('developers') || p.url().includes('facebook'));
  if (!page) page = await browser.newPage();
  
  // Navigate to Graph API Explorer
  console.log('[1] Abriendo Graph API Explorer...');
  await page.goto('https://developers.facebook.com/tools/explorer/', { timeout: 30000 }).catch(() => {});
  await sleep(5000);
  
  console.log('URL:', page.url());
  await page.screenshot({ path: 'C:\\Users\\ADMIN\\Music\\screenshots\\explorer.png' });
  
  // Get page content for analysis
  const explorerHTML = await page.evaluate(() => ({
    buttons: Array.from(document.querySelectorAll('button, [role="button"]')).map(b => ({
      text: (b.textContent || '').trim().substring(0, 80),
      type: b.getAttribute('type') || '',
      ariaLabel: b.getAttribute('aria-label') || '',
    })),
    selects: Array.from(document.querySelectorAll('select')).map(s => ({
      id: s.id,
      name: s.name,
      ariaLabel: s.getAttribute('aria-label') || '',
      options: Array.from(s.options).map(o => ({ text: o.text, value: o.value })),
    })),
    inputs: Array.from(document.querySelectorAll('input[type="text"], input:not([type="hidden"])')).map(i => ({
      id: i.id,
      placeholder: i.placeholder,
      value: (i.value || '').substring(0, 100),
      ariaLabel: i.getAttribute('aria-label') || '',
    })),
    links: Array.from(document.querySelectorAll('a')).map(a => ({
      text: (a.textContent || '').trim().substring(0, 60),
      href: (a.href || '').substring(0, 120),
    })).filter(a => a.text || a.href),
    tokenInputs: [],
  }));
  
  // Find inputs that might contain tokens
  const allInputs = await page.evaluate(() => {
    const result = [];
    document.querySelectorAll('input').forEach(inp => {
      if (inp.value && inp.value.startsWith('EA')) {
        result.push({ id: inp.id, name: inp.name, value: inp.value.substring(0, 50) });
      }
    });
    return result;
  });
  explorerHTML.tokenInputs = allInputs;
  
  console.log('\n=== INTERFAZ DEL EXPLORER ===');
  console.log('\nBotones:', JSON.stringify(explorerHTML.buttons.slice(0, 15), null, 2));
  console.log('\nSelects:', JSON.stringify(explorerHTML.selects.slice(0, 5), null, 2));
  console.log('\nInputs:', JSON.stringify(explorerHTML.inputs.slice(0, 10), null, 2));
  console.log('\nToken inputs:', JSON.stringify(explorerHTML.tokenInputs, null, 2));
  
  // If there's a token already displayed, save it
  if (explorerHTML.tokenInputs.length > 0) {
    const token = explorerHTML.tokenInputs[0].value;
    console.log('\n🎉 TOKEN ENCONTRADO EN EL EXPLORER!');
    await saveAndConfigure(token);
    await browser.disconnect();
    return;
  }
  
  // Try to click the "Get Token" button
  console.log('\n[2] Buscando boton para generar token...');
  
  const tokenBtn = explorerHTML.buttons.find(b => 
    b.text.toLowerCase().includes('token') || 
    b.text.toLowerCase().includes('get') || 
    b.ariaLabel?.toLowerCase().includes('token')
  );
  
  if (tokenBtn) {
    console.log(`Click en: ${tokenBtn.text}`);
    try {
      const btns = await page.$$('button, [role="button"]');
      for (const btn of btns) {
        const text = await btn.evaluate(el => el.textContent?.trim() || '');
        if (text === tokenBtn.text) {
          await btn.click();
          await sleep(2000);
          break;
        }
      }
    } catch(e) { console.log('Error clicking:', e.message); }
  }
  
  await page.screenshot({ path: 'C:\\Users\\ADMIN\\Music\\screenshots\\explorer2.png' });
  
  // Check for dropdown/select that lets you choose User Token vs Page Token
  console.log('\n[3] Buscando selector de tipo de token...');
  
  // Look for the token type selector
  let selectedPage = false;
  for (const select of explorerHTML.selects) {
    const pageOption = select.options.find(o => 
      o.text.toLowerCase().includes('page') || 
      o.text.toLowerCase().includes('página') ||
      o.text.toLowerCase().includes('ventas') ||
      o.text.includes('1278583508663384')
    );
    
    if (pageOption) {
      console.log(`Found page option: ${pageOption.text} in select ${select.id || select.name}`);
      try {
        await page.select(select.id || select.name, pageOption.value);
        await sleep(1000);
        selectedPage = true;
      } catch {}
    }
  }
  
  // If no select found, try clicking dropdown
  if (!selectedPage) {
    console.log('Buscando dropdown de seleccion de pagina...');
    const clickables = explorerHTML.buttons.filter(b => 
      b.text.toLowerCase().includes('user') || 
      b.text.toLowerCase().includes('usuario') ||
      b.text.toLowerCase().includes('page') ||
      b.text.toLowerCase().includes('página')
    );
    if (clickables.length > 0) {
      console.log(`Click en: ${clickables[0].text}`);
    }
  }
  
  // Final check for token
  await sleep(2000);
  const finalCheck = await page.evaluate(() => {
    const result = [];
    document.querySelectorAll('input').forEach(inp => {
      if (inp.value && inp.value.startsWith('EA')) {
        result.push(inp.value);
      }
    });
    return result;
  });
  
  if (finalCheck.length > 0) {
    console.log(`\n🎉 TOKEN GENERADO: ${finalCheck[0].substring(0, 50)}...`);
    await saveAndConfigure(finalCheck[0]);
  } else {
    console.log('\n⚠️ No se pudo generar token automaticamente.');
    console.log('En el explorador que se abrio:');
    console.log('1. Arriba a la derecha selecciona "Page Token" o "Token de Pagina"');
    console.log('2. Selecciona "VentasPro - Cursos Digitales"');
    console.log('3. En permisos agrega: pages_read_engagement, pages_manage_metadata, ads_management, pages_messaging');
    console.log('4. Click "Generate Token"');
    console.log('5. Copia el token y ejecuta:');
    console.log('   node C:\\Users\\ADMIN\\Music\\final-setup.mjs TU_TOKEN');
  }
  
  await browser.disconnect();
}

async function saveAndConfigure(token) {
  console.log('\n💾 Configurando sistema...');
  
  const result = {
    accessToken: token,
    pageId: '1278583508663384',
    pageName: 'VentasPro - Cursos Digitales',
    adAccountId: '',
    bmId: '4482432028697067',
    pixelId: ''
  };
  
  // Get page access token and ad account
  try {
    const meRes = await fetch(`https://graph.facebook.com/v21.0/me?access_token=${token}&fields=name,id`);
    const meJson = await meRes.json();
    if (meJson.id) {
      console.log(`User: ${meJson.name || meJson.id}`);
      const pRes = await fetch(`https://graph.facebook.com/v21.0/me/accounts?access_token=${token}&fields=name,id,access_token`);
      const pJson = await pRes.json();
      if (pJson.data?.length > 0) {
        const p = pJson.data[0];
        result.pageId = p.id;
        result.pageName = p.name;
        result.pageAccessToken = p.access_token || token;
        console.log(`Page: ${p.name}`);
      }
      const aRes = await fetch(`https://graph.facebook.com/v21.0/me/adaccounts?access_token=${token}&fields=id,name,account_id`);
      const aJson = await aRes.json();
      if (aJson.data?.length > 0) {
        result.adAccountId = aJson.data[0].account_id;
        console.log(`Ad Account: ${aJson.data[0].account_id}`);
      }
    }
  } catch {}
  
  // Save files
  fs.writeFileSync('C:\\Users\\ADMIN\\Music\\fb_tokens_output.json', JSON.stringify(result, null, 2));
  console.log('Tokens guardados');
  
  const envPath = 'C:\\Users\\ADMIN\\Videos\\Agent-Sales-Bot\\.env';
  let env = fs.readFileSync(envPath, 'utf8');
  const updates = {
    'FB_ACCESS_TOKEN': token,
    'FB_PAGE_ID': result.pageId,
    'FB_AD_ACCOUNT_ID': result.adAccountId,
    'FB_MESSENGER_PAGE_TOKEN': result.pageAccessToken || token,
  };
  for (const [k, v] of Object.entries(updates)) {
    const re = new RegExp(`${k}=.*`, '');
    if (env.match(re)) env = env.replace(re, `${k}=${v}`);
    else env += `\n${k}=${v}`;
  }
  fs.writeFileSync(envPath, env, 'utf8');
  console.log('.env actualizado');
  
  console.log('\n✅ FACEBOOK CONFIGURADO!');
  console.log(`Token: ${token.substring(0, 30)}...`);
  console.log(`Ad Account: ${result.adAccountId || 'No encontrado'}`);
  console.log('\nAbre http://localhost:3002 → Facebook → Canales');
}

main().catch(e => console.log('ERROR:', e.message));
