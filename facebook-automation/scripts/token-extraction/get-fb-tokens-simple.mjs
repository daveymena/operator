import http from 'http';
import fs from 'fs';

const CDP = 'http://127.0.0.1:9222';

async function cdpFetch(targetId, method, params = {}) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify({ id: Date.now(), method, params });
    const opts = {
      hostname: '127.0.0.1', port: 9222,
      path: `/devtools/page/${targetId}`,
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    };
    const req = http.request(opts, res => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => { try { resolve(JSON.parse(d)); } catch { resolve(d); } });
    });
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

async function cdpGetTargets() {
  return new Promise((resolve, reject) => {
    http.get(`${CDP}/json`, res => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => { try { resolve(JSON.parse(d)); } catch { resolve([]); } });
    }).on('error', reject);
  });
}

async function main() {
  console.log('[FB] Conectando a Chrome...');
  const targets = await cdpGetTargets();
  const fbTarget = targets.find(t => t.url && t.url.includes('facebook.com') && t.title && !t.title.includes('Service Worker') && !t.title.includes('Omnibox') && !t.title.includes('MAWMain'));
  
  if (!fbTarget) {
    console.log('[FB] No hay pagina de Facebook. Paginas:');
    targets.forEach(t => console.log(`  - ${t.title}: ${(t.url||'').substring(0,80)}`));
    return;
  }
  
  console.log(`[FB] Usando pagina: ${fbTarget.title}`);
  console.log(`[FB] URL: ${fbTarget.url.substring(0, 100)}`);
  
  // Navigate to Business Manager
  console.log('[FB] Navegando a Business Manager...');
  await cdpFetch(fbTarget.id, 'Page.navigate', { url: 'https://business.facebook.com/overview/' });
  await new Promise(r => setTimeout(r, 5000));
  
  // Navigate to Pages section to get page token
  console.log('[FB] Buscando tokens en la pagina...');
  const evalResult = await cdpFetch(fbTarget.id, 'Runtime.evaluate', {
    expression: `(() => {
      const r = { token: '', bmId: '', adAccountId: '', pageId: '', pixelId: '', pageName: '' };
      document.querySelectorAll('script').forEach(s => {
        const t = s.textContent || '';
        let m;
        if ((m = t.match(/EAA[A-Za-z0-9%._\\-=,]+/)) && m[0].length > 30) r.token = m[0];
        if ((m = t.match(/act_(\\d+)/))) r.adAccountId = r.adAccountId || m[1];
        if ((m = t.match(/"page(?:ID|_id)"\\s*:\\s*"(\\d+)"/))) r.pageId = r.pageId || m[1];
        if ((m = t.match(/"pixel(?:Id|_id)"\\s*:\\s*"(\\d+)"/))) r.pixelId = r.pixelId || m[1];
        if ((m = t.match(/"business_id"\\s*:\\s*"(\\d+)"/))) r.bmId = r.bmId || m[1];
        if (!r.pageName) {
          const title = document.title;
          if (title && !title.includes('Facebook')) r.pageName = title;
        }
      });
      return JSON.stringify(r);
    })()`,
    returnByValue: true
  });
  
  if (evalResult.result && evalResult.result.value) {
    const data = JSON.parse(evalResult.result.value);
    console.log('\n=== DATOS DE FACEBOOK ===');
    console.log(`Token: ${data.token ? data.token.substring(0, 40) + '...' : 'VACIO'}`);
    console.log(`PageID: ${data.pageId || 'VACIO'}`);
    console.log(`AdAccountID: ${data.adAccountId || 'VACIO'}`);
    console.log(`PixelID: ${data.pixelId || 'VACIO'}`);
    console.log(`BMID: ${data.bmId || 'VACIO'}`);
    
    // If no token, try to get from Graph API page
    if (!data.token) {
      console.log('\n[FB] Token no encontrado en scripts. Navegando a Developers...');
      await cdpFetch(fbTarget.id, 'Page.navigate', { url: 'https://developers.facebook.com/tools/accesstoken/' });
      await new Promise(r => setTimeout(r, 5000));
      
      const tokenResult = await cdpFetch(fbTarget.id, 'Runtime.evaluate', {
        expression: `(() => {
          const r = { token: '' };
          document.querySelectorAll('tr').forEach(row => {
            const cells = row.querySelectorAll('td');
            if (cells.length >= 2) {
              const txt = cells[0].textContent.trim();
              if (txt.startsWith('EAA') || txt.startsWith('EAAC')) r.token = txt;
            }
          });
          return JSON.stringify(r);
        })()`,
        returnByValue: true
      });
      
      if (tokenResult.result && tokenResult.result.value) {
        const tokenData = JSON.parse(tokenResult.result.value);
        if (tokenData.token) {
          data.token = tokenData.token;
          console.log('\nToken encontrado en Developers page!');
        }
      }
    }
    
    // Save to file
    if (data.token) {
      fs.writeFileSync('C:\\Users\\ADMIN\\Music\\fb_tokens_output.json', JSON.stringify(data, null, 2));
      console.log(`\n[FB] Token guardado en fb_tokens_output.json`);
      console.log(`[FB] Token length: ${data.token.length}`);
      
      // Also validate the token
      try {
        const validateRes = await fetch(`https://graph.facebook.com/v21.0/me?access_token=${data.token}`);
        const validateData = await validateRes.json();
        console.log(`[FB] Token valido para: ${validateData.name || validateData.id || 'desconocido'}`);
        if (validateData.name) data.pageName = validateData.name;
        fs.writeFileSync('C:\\Users\\ADMIN\\Music\\fb_tokens_output.json', JSON.stringify(data, null, 2));
      } catch(e) {
        console.log(`[FB] No se pudo validar token: ${e.message}`);
      }
    } else {
      console.log('\n[FB] No se pudo extraer token. Necesitas:');
      console.log('  1. Ir a https://business.facebook.com/');
      console.log('  2. Ir a Configuracion > Acceso de tokens');
      console.log('  3. Copiar el access token manualmente');
    }
  }
  
  console.log('\n[FB] Listo!');
}

main().catch(e => console.error('ERROR:', e.message));
