import puppeteer from 'puppeteer';
import fs from 'fs';

async function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function main() {
  console.log('[FB] Conectando a Chrome...');
  const browser = await puppeteer.connect({ browserURL: 'http://127.0.0.1:9222', defaultViewport: null });
  const pages = await browser.pages();
  
  // Find Facebook Business Manager page
  let fbPage = pages.find(p => p.url().includes('business.facebook.com') || p.url().includes('facebook.com'));
  
  if (!fbPage) {
    console.log('[FB] No hay pagina de Facebook. Creando nueva...');
    fbPage = await browser.newPage();
  }
  
  const url = fbPage.url();
  console.log(`[FB] Pagina actual: ${url.substring(0, 100)}`);
  
  // Method 1: Try to get token from Graph API directly (if logged into developers)
  console.log('\n[FB] Metodo 1: Buscando token via Graph API (business.facebook.com)...');
  await fbPage.goto('https://business.facebook.com/latest/settings/business_users/', { waitUntil: 'networkidle2', timeout: 30000 }).catch(() => {});
  await sleep(3000);
  
  // Extract from the page source
  const data1 = await fbPage.evaluate(() => {
    const scripts = document.querySelectorAll('script');
    const tokens = new Set();
    for (const s of scripts) {
      const t = s.textContent || '';
      const matches = t.matchAll(/EAAB?[A-Za-z0-9%._\-\/=,]{50,}/g);
      for (const m of matches) {
        if (m[0].length > 60) tokens.add(m[0]);
      }
    }
    return { tokens: [...tokens].slice(0, 5), pageTitle: document.title, url: window.location.href };
  });
  
  console.log(`[FB] Titulo: ${data1.pageTitle}`);
  console.log(`[FB] Tokens encontrados en pagina: ${data1.tokens.length}`);
  if (data1.tokens.length > 0) {
    data1.tokens.forEach((t, i) => console.log(`  ${i+1}. ${t.substring(0, 40)}...`));
  }
  
  // Method 2: Navigate to Facebook Page to get page token
  console.log('\n[FB] Metodo 2: Extrayendo token directamente...');
  
  // Try to get from business settings page info endpoint
  const pageId = '1278583508663384'; // from existing credentials
  
  const data2 = await fbPage.evaluate((pid) => {
    // Look for page access token in various places
    const result = { token: '', pageAccessToken: '', adAccountId: '', pixelId: '' };
    
    // Check localStorage
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key) {
        const val = localStorage.getItem(key);
        if (val && val.length > 50 && (val.startsWith('EA') || val.includes('accessToken'))) {
          if (!result.token) result.token = val;
        }
      }
    }
    
    // Check sessionStorage
    for (let i = 0; i < sessionStorage.length; i++) {
      const key = sessionStorage.key(i);
      if (key) {
        const val = sessionStorage.getItem(key);
        if (val && val.length > 80 && val.startsWith('EA')) {
          result.token = val;
        }
      }
    }
    
    // Check cookies
    document.cookie.split(';').forEach(c => {
      const [k, v] = c.trim().split('=');
      if (k === 'xs' && v) result.token = result.token || v;
    });
    
    // Check all scripts for tokens
    document.querySelectorAll('script').forEach(s => {
      const t = s.textContent || '';
      const m = t.match(/["']access_token["']\s*:\s*["'](EAAB?[A-Za-z0-9%._\-\/=,]+)["']/);
      if (m && m[1].length > 60) result.pageAccessToken = m[1];
      const m2 = t.match(/act_(\d+)/);
      if (m2) result.adAccountId = m2[1];
      const m3 = t.match(/["']pixel_id["']\s*:\s*["'](\d+)["']/);
      if (m3) result.pixelId = m3[1];
    });
    
    return result;
  }, pageId);
  
  console.log(`\n[FB] Token encontrado en storage: ${data2.token ? data2.token.substring(0, 30) + '...' : 'NO'}`);
  console.log(`[FB] Page Access Token: ${data2.pageAccessToken ? data2.pageAccessToken.substring(0, 30) + '...' : 'NO'}`);
  console.log(`[FB] Ad Account: ${data2.adAccountId || 'NO'}`);
  console.log(`[FB] Pixel: ${data2.pixelId || 'NO'}`);
  
  // Use whichever token we found
  const token = data2.pageAccessToken || data2.token || (data1.tokens.length > 0 ? data1.tokens[0] : '');
  
  if (token) {
    console.log('\n[FB] Validando token con Graph API...');
    try {
      const res = await fetch(`https://graph.facebook.com/v21.0/me?access_token=${token}&fields=name,id`);
      const json = await res.json();
      if (json.id) {
        console.log(`[FB] ✅ Token VALIDO! Conectado como: ${json.name || json.id}`);
        
        // Get page info
        const pagesRes = await fetch(`https://graph.facebook.com/v21.0/${json.id}/accounts?access_token=${token}&fields=name,id,access_token,picture`);
        const pagesJson = await pagesRes.json();
        if (pagesJson.data && pagesJson.data.length > 0) {
          const page = pagesJson.data[0];
          console.log(`[FB] Pagina: ${page.name} (${page.id})`);
          
          const finalData = {
            accessToken: token,
            pageId: page.id,
            pageAccessToken: page.access_token || '',
            pageName: page.name,
            bmId: data1.tokens.length > 0 ? 'from_token' : '',
            adAccountId: data2.adAccountId || '',
            pixelId: data2.pixelId || ''
          };
          
          fs.writeFileSync('C:\\Users\\ADMIN\\Music\\fb_tokens_output.json', JSON.stringify(finalData, null, 2));
          console.log('\n✅ TOKENS GUARDADOS EN fb_tokens_output.json');
          console.log(JSON.stringify(finalData, null, 2));
        } else {
          console.log('[FB] No hay paginas asociadas a este token');
        }
      } else {
        console.log(`[FB] Token invalido: ${JSON.stringify(json)}`);
      }
    } catch(e) {
      console.log(`[FB] Error: ${e.message}`);
    }
  } else {
    console.log('\n[FB] No se pudo extraer token. Metodos alternativos:');
    console.log('  1. Abre https://developers.facebook.com/tools/explorer/');
    console.log('  2. Selecciona "TecnoVariedades" o tu app');
    console.log('  3. Genera token con permisos: pages_read_engagement, pages_manage_metadata, ads_management, business_management');
    console.log('  4. Copia el token y ejecuta:');
    console.log('     $env:FB_ACCESS_TOKEN="TU_TOKEN_AQUI"');
  }
  
  await browser.disconnect();
  console.log('\n[FB] Proceso completado!');
}

main().catch(e => console.log('ERROR:', e.message));
