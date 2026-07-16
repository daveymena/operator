import puppeteer from 'puppeteer';
import fs from 'fs';
import path from 'path';

const ROOT = 'C:\\Users\\ADMIN\\Music\\proyecto-unificado\\facebook-automation';
const ASSETS = path.join(ROOT, 'assets');
const IMAGES = path.join(ASSETS, 'images');
const TOKENS = path.join(ROOT, 'tokens');
const LOGS = path.join(ROOT, 'logs');
const SCREENSHOTS = path.join(ROOT, 'screenshots');

[ASSETS, IMAGES, TOKENS, LOGS, SCREENSHOTS].forEach(d => fs.mkdirSync(d, { recursive: true }));

const CONFIG = {
  bmId: '4482432028697067',
  pageId: '1278583508663384',
  pageName: 'VentasPro',
  adAccountId: '1545022093928422',
  tokenFile: path.join(TOKENS, 'fb_tokens_output.json'),
  catalogFile: path.join(TOKENS, 'megapack-82-productos.json'),
  chromeUrl: 'http://127.0.0.1:9222',
  apiVersion: 'v22.0',
  graphBase: 'https://graph.facebook.com'
};

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function log(msg, data) {
  const ts = new Date().toISOString();
  const line = `[${ts}] ${msg}${data ? ' ' + JSON.stringify(data) : ''}`;
  console.log(line);
  fs.appendFileSync(path.join(LOGS, 'agent.log'), line + '\n');
}

async function withChrome(fn) {
  const browser = await puppeteer.connect({ browserURL: CONFIG.chromeUrl, defaultViewport: null });
  let page = (await browser.pages()).find(p => p.url().includes('facebook.com'));
  if (!page) page = await browser.newPage();
  try { return await fn(browser, page); }
  finally { await browser.disconnect(); }
}

// ==============================
// TOKEN MANAGEMENT
// ==============================
async function getToken() {
  try {
    const saved = JSON.parse(fs.readFileSync(CONFIG.tokenFile, 'utf8'));
    const token = saved.pageAccessToken || saved.accessToken;
    if (token) return token;
  } catch {}
  return null;
}

async function validateToken(token) {
  try {
    const r = await fetch(`${CONFIG.graphBase}/${CONFIG.apiVersion}/me?access_token=${token}&fields=id,name`);
    const d = await r.json();
    return d.id ? { valid: true, name: d.name, id: d.id, data: d } : { valid: false, error: d.error };
  } catch (e) {
    return { valid: false, error: e.message };
  }
}

async function saveToken(token, info = {}) {
  const data = { accessToken: token, pageId: CONFIG.pageId, pageName: CONFIG.pageName, adAccountId: CONFIG.adAccountId, bmId: CONFIG.bmId, ...info };
  fs.writeFileSync(CONFIG.tokenFile, JSON.stringify(data, null, 2));
  log('Token saved');
}

async function extractTokenFromBrowser() {
  return withChrome(async (browser, page) => {
    log('Checking current Facebook session...');
    const cookies = await page.cookies('https://www.facebook.com');
    const hasSession = cookies.some(c => c.name === 'c_user');
    log(`Session active: ${hasSession}`);

    await page.goto('https://developers.facebook.com/tools/explorer/', { waitUntil: 'networkidle0', timeout: 30000 }).catch(() => {});
    await sleep(4000);

    const validation = await page.evaluate(() => {
      const body = document.body.innerText || '';
      const loggedIn = !body.includes('Iniciar sesi') && !body.includes('Log In');
      const inputs = document.querySelectorAll('input[type="text"]');
      for (const inp of inputs) {
        if (inp.value && inp.value.startsWith('EA')) return { source: 'input', token: inp.value };
      }
      const m = body.match(/EAAB[a-zA-Z0-9_-]+ZDZD/);
      if (m) return { source: 'body', token: m[0] };
      return { loggedIn, url: window.location.href };
    });

    return validation;
  });
}

async function setupTokenFromUserInput() {
  log('Token required. Please generate one:');
  console.log('\n══════════════════════════════════════════════');
  console.log('  PARA GENERAR TOKEN:');
  console.log('  1. Abre https://developers.facebook.com/tools/explorer/');
  console.log('  2. Selecciona app → Page Token → VentasPro');
  console.log('  3. Permisos: ads_management, pages_read_engagement,');
  console.log('     pages_manage_metadata, business_management');
  console.log('  4. Genera y copia el token');
  console.log('══════════════════════════════════════════════\n');

  return new Promise(resolve => {
    const rl = require('readline').createInterface({ input: process.stdin, output: process.stdout });
    rl.question('Pega el token aqui: ', async (token) => {
      rl.close();
      token = token.trim();
      const val = await validateToken(token);
      if (val.valid) {
        await saveToken(token, { userName: val.name, userId: val.id });
        log(`Token valid for ${val.name}`);
        resolve(token);
      } else {
        log(`Invalid token: ${val.error?.message || 'unknown'}`);
        resolve(null);
      }
    });
  });
}

// ==============================
// GRAPH API
// ==============================
async function graphApi(endpoint, params = {}) {
  const token = await getToken();
  if (!token) throw new Error('No token available');
  const qs = new URLSearchParams({ access_token: token, ...params }).toString();
  const url = `${CONFIG.graphBase}/${CONFIG.apiVersion}/${endpoint}?${qs}`;
  const r = await fetch(url);
  return r.json();
}

async function getPages() {
  return graphApi('me/accounts', { fields: 'name,id,access_token,picture' });
}

async function getAdAccounts() {
  return graphApi('me/adaccounts', { fields: 'id,name,account_id,currency,account_status,balance' });
}

async function getCampaigns(adAccountId = null) {
  const act = adAccountId || CONFIG.adAccountId;
  return graphApi(`act_${act}/campaigns`, { fields: 'id,name,status,objective,daily_budget,lifetime_budget' });
}

async function getAdSets(adAccountId = null) {
  const act = adAccountId || CONFIG.adAccountId;
  return graphApi(`act_${act}/adsets`, { fields: 'id,name,status,daily_budget,lifetime_budget,targeting,optimization_goal' });
}

async function getAds(adAccountId = null) {
  const act = adAccountId || CONFIG.adAccountId;
  return graphApi(`act_${act}/ads`, { fields: 'id,name,status,creative{id,name,title,body,image_url,object_story_spec}' });
}

// ==============================
// CATALOG MANAGEMENT
// ==============================
function loadCatalog() {
  try { return JSON.parse(fs.readFileSync(CONFIG.catalogFile, 'utf8')); }
  catch { return []; }
}

function saveCatalog(catalog) {
  fs.writeFileSync(CONFIG.catalogFile, JSON.stringify(catalog, null, 2), 'utf8');
  log(`Catalog saved: ${catalog.length} products`);
}

function displayCatalogStats(catalog) {
  const prices = catalog.map(p => p.price);
  const uniquePrices = [...new Set(prices)];
  const byCategory = {};
  catalog.forEach(p => {
    const cat = p.category || 'UNKNOWN';
    byCategory[cat] = (byCategory[cat] || 0) + 1;
  });
  console.log('\n📊 CATALOG STATS:');
  console.log(`  Total products: ${catalog.length}`);
  console.log(`  Prices: ${uniquePrices.map(p => `$${(p/1000).toFixed(0)}K`).join(', ')}`);
  Object.entries(byCategory).forEach(([k, v]) => console.log(`  ${k}: ${v}`));
  const withLinks = catalog.filter(p => p.deliveryLink || p.drive_url).length;
  const withImages = catalog.filter(p => p.images?.length > 0).length;
  console.log(`  With delivery links: ${withLinks}`);
  console.log(`  With images: ${withImages}`);
}

function assignImagesToProducts(catalog) {
  const imgDir = IMAGES;
  const availableImages = fs.readdirSync(imgDir).filter(f => /\.(jpg|jpeg|png|webp)$/i.test(f));
  log(`Available images: ${availableImages.length}`);

  // Map image filenames to categories by direct name matching (prefer jpg)
  const imgMap = {};
  const allImages = availableImages.filter(f => /\.jpg$/i.test(f));
  
  // Direct filename to category mapping
  const directMap = {
    'piano.jpg': 'piano',
    'piano-real.jpg': 'piano',
    'programacion.jpg': 'programacion',
    'programacion-real.jpg': 'programacion',
    'diseno.jpg': 'diseno',
    'diseno-real.jpg': 'diseno',
    'ingles.jpg': 'ingles',
    'ingles-real.jpg': 'ingles',
    'ia.jpg': 'ia',
    'ia-real.jpg': 'ia',
  };

  allImages.forEach(f => {
    const lower = f.toLowerCase();
    if (directMap[lower]) {
      imgMap[directMap[lower]] = f;
    }
  });

  // Fallback for files not in directMap
  availableImages.filter(f => /\.jpg$/i.test(f)).forEach(f => {
    const lower = f.toLowerCase();
    if (lower.includes('piano')) imgMap.piano = f;
    else if (lower.includes('programacion') || lower.includes('programación')) imgMap.programacion = f;
    else if (lower.includes('diseno') || lower.includes('diseño')) imgMap.diseno = f;
    else if (lower.includes('ingles') || lower.includes('inglés')) imgMap.ingles = f;
    else if (lower.match(/(^|_)ia[._-]/) || lower === 'ia.jpg') imgMap.ia = f;
  });

  log(`Image mapping: ${JSON.stringify(imgMap)}`);

  const productKeywords = {
    piano: ['piano', 'guitarra', 'música', 'musical', 'instrumento'],
    programacion: ['programación', 'programacion', 'desarrollo web', 'wordpress', 'código', 'codigo', 'programador'],
    diseno: ['diseño', 'diseno', 'gráfico', 'grafico', 'photoshop', 'ilustración', 'ilustracion', 'logotipo', 'indesign', 'cinema', 'animación', 'animacion', 'canva', 'lettering', 'fotomontaje', 'sublimado', 'premiere', 'filmora', 'infografía', 'infografia', 'cuadro', 'interfaz'],
    ingles: ['inglés', 'ingles', 'idioma', 'oxford'],
    ia: ['hacking', 'ciberseguridad', 'inteligencia artificial'],
  };

  let updated = 0;

  catalog.forEach(p => {
    const text = (p.name + ' ' + (p.description || '')).toLowerCase();
    const currentImg = p.images?.[0] || '';
    const isPlaceholder = !currentImg || currentImg.startsWith('C:') || currentImg.includes('/images') || currentImg === '';

    if (!isPlaceholder) return;

    for (const [kw, terms] of Object.entries(productKeywords)) {
      if (terms.some(t => text.includes(t))) {
        const imgName = imgMap[kw];
        if (imgName) {
          p.images = [path.join(IMAGES, imgName)];
          updated++;
          break;
        }
      }
    }
  });

  log(`Updated ${updated} products with real images`);
  return catalog;
}

// ==============================
// IMAGE MANAGEMENT
// ==============================
async function searchAndDownloadImages(category, query) {
  return withChrome(async (browser, page) => {
    log(`Searching images for: ${category} - ${query}`);
    await page.goto(`https://www.pexels.com/es-es/buscar/${encodeURIComponent(query)}/?orientation=landscape`, { waitUntil: 'networkidle0', timeout: 30000 });
    await sleep(3000);
    await page.evaluate(() => window.scrollBy(0, 500));
    await sleep(2000);

    const links = await page.evaluate(() => {
      return Array.from(document.querySelectorAll('a[href*="/foto/"], a[href*="/photo/"]'))
        .slice(0, 3)
        .map(a => ({ href: a.href, thumb: a.querySelector('img')?.getAttribute('src') || '' }));
    });

    for (const link of links) {
      try {
        await page.goto(link.href, { waitUntil: 'networkidle0', timeout: 30000 });
        await sleep(2000);

        const imgUrl = await page.evaluate(() => {
          const dl = document.querySelector('a[download]');
          if (dl) return dl.href;
          const img = document.querySelector('img[src*="images.pexels.com"]');
          if (img) return (img.src || img.getAttribute('data-src') || '').replace(/auto=compress[^&]*/, 'auto=compress&cs=tinysrgb&w=1260&h=750&fit=crop');
          return null;
        });

        if (imgUrl) {
          const resp = await fetch(imgUrl, { headers: { 'User-Agent': 'Mozilla/5.0' } });
          if (resp.ok) {
            const buf = Buffer.from(await resp.arrayBuffer());
            if (buf.length > 15000) {
              const fileName = `${category}.jpg`;
              fs.writeFileSync(path.join(IMAGES, fileName), buf);
              log(`Downloaded: ${fileName} (${(buf.length/1024).toFixed(0)}KB)`);
              return { success: true, file: fileName, size: buf.length };
            }
          }
        }
      } catch (e) {
        log(`Download error for ${category}: ${e.message.substring(0, 60)}`);
      }
    }
    return { success: false };
  });
}

// ==============================
// AD CREATION
// ==============================
async function createAdCreative(product, imagePath) {
  const token = await getToken();
  if (!token) throw new Error('No token');

  const imageData = fs.readFileSync(imagePath);
  const base64 = imageData.toString('base64');

  const creativeData = {
    name: `Creative_${product.id}_${Date.now()}`,
    object_story_spec: {
      page_id: CONFIG.pageId,
      link_data: {
        link: product.deliveryLink || product.drive_url || 'https://wa.me/573001234567',
        message: `${product.name}\n\n${(product.description || '').substring(0, 125)}...`,
        name: product.name.substring(0, 40),
        description: `Solo $${(product.price/1000).toFixed(0)}.000 COP - Acceso Inmediato`,
        call_to_action: { type: 'LEARN_MORE' }
      }
    },
    object_story_id: null
  };

  // Upload image
  const uploadRes = await graphApi(`act_${CONFIG.adAccountId}/adimages`, {
    bytes: base64
  });
  log(`Image upload: ${uploadRes?.images ? 'OK' : 'FAIL'}`);

  if (uploadRes?.images) {
    const hash = Object.values(uploadRes.images)[0]?.hash;
    if (hash) {
      creativeData.object_story_spec.link_data.image_hash = hash;
    }
  }

  const result = await graphApi(`act_${CONFIG.adAccountId}/adcreatives`, creativeData);
  return result;
}

async function createAdDraft(product, campaignId = null) {
  // Returns a JSON draft that can be used to create the ad
  return {
    productId: product.id,
    productName: product.name,
    price: `$${(product.price/1000).toFixed(0)}.000 COP`,
    image: product.images?.[0] || '',
    deliveryLink: product.deliveryLink || product.drive_url || '',
    adCopy: `${product.name} - Solo $${(product.price/1000).toFixed(0)}.000 COP\n\n${(product.description || '').substring(0, 80)}...\n\n Acceso Inmediato vía Google Drive`,
    headline: product.name.substring(0, 40),
    description: `Desde $${(product.price/1000).toFixed(0)}.000 COP - Envio Inmediato`,
    cta: 'Más Información',
    campaignId: campaignId || 'default',
    status: 'DRAFT',
    callToAction: 'LEARN_MORE'
  };
}

async function generateAllAdDrafts() {
  const catalog = loadCatalog();
  const drafts = [];

  for (const product of catalog) {
    const draft = await createAdDraft(product);
    drafts.push(draft);
  }

  const outPath = path.join(TOKENS, 'ad-drafts.json');
  fs.writeFileSync(outPath, JSON.stringify(drafts, null, 2));
  log(`Generated ${drafts.length} ad drafts -> ${outPath}`);
  return drafts;
}

// ==============================
// STATUS AND REPORTING
// ==============================
async function showStatus() {
  console.log('\n══════════════════════════════════════════════');
  console.log('  FACEBOOK ADS MANAGER AGENT - STATUS');
  console.log('══════════════════════════════════════════════');

  const token = await getToken();
  if (token) {
    const val = await validateToken(token);
    console.log(`\n🔑 Token: ${val.valid ? '✅ VALID' : '❌ EXPIRED'} ${val.valid ? `(${val.name})` : ''}`);
  } else {
    console.log('\n🔑 Token: ⚠️ NOT CONFIGURED');
  }

  const catalog = loadCatalog();
  displayCatalogStats(catalog);

  const images = fs.readdirSync(IMAGES).filter(f => /\.(jpg|jpeg|png)$/i.test(f));
  console.log(`\n📸 Images in assets: ${images.length}`);

  const draftsPath = path.join(TOKENS, 'ad-drafts.json');
  const hasDrafts = fs.existsSync(draftsPath);
  if (hasDrafts) {
    const drafts = JSON.parse(fs.readFileSync(draftsPath, 'utf8'));
    console.log(`📝 Ad drafts: ${drafts.length}`);
  }

  console.log('\nChrome Debug: http://127.0.0.1:9222');
  console.log('══════════════════════════════════════════════\n');
}

// ==============================
// BROWSER-BASED AD MANAGER NAVIGATION
// ==============================
async function navigateToAdsManager() {
  return withChrome(async (browser, page) => {
    log('Navigating to Ads Manager...');
    await page.goto(`https://adsmanager.facebook.com/adsmanager/manage/campaigns?act=${CONFIG.adAccountId}&business_id=${CONFIG.bmId}`, { waitUntil: 'networkidle0', timeout: 30000 });
    await sleep(3000);
    await page.screenshot({ path: path.join(SCREENSHOTS, 'ads-manager.png') });
    log('Ads Manager loaded');
    return { url: page.url(), title: await page.title() };
  });
}

async function navigateToBusinessSettings() {
  return withChrome(async (browser, page) => {
    log('Navigating to Business Settings...');
    await page.goto(`https://business.facebook.com/latest/settings/pages?business_id=${CONFIG.bmId}`, { waitUntil: 'networkidle0', timeout: 30000 });
    await sleep(4000);
    await page.screenshot({ path: path.join(SCREENSHOTS, 'business-settings.png') });
    return { url: page.url(), title: await page.title() };
  });
}

// ==============================
// COMPETITIVE RESEARCH
// ==============================
async function searchFacebookAdsLibrary(keyword) {
  return withChrome(async (browser, page) => {
    log(`Searching Ads Library for: ${keyword}`);
    await page.goto(`https://www.facebook.com/ads/library/?active_status=all&ad_type=all&country=CO&q=${encodeURIComponent(keyword)}&sort_data=no&search_type=keyword_unordered`, { waitUntil: 'networkidle0', timeout: 30000 });
    await sleep(3000);
    await page.evaluate(() => window.scrollBy(0, 800));
    await sleep(2000);

    const ads = await page.evaluate(() => {
      const results = [];
      document.querySelectorAll('[data-pagelet="AdsLibraryAd"]').forEach(el => {
        const text = el.innerText || '';
        const imgs = Array.from(el.querySelectorAll('img')).map(i => i.src).filter(s => s);
        results.push({ text: text.substring(0, 300), images: imgs });
      });
      return results.slice(0, 5);
    });

    const outDir = path.join(ROOT, '_ad_references');
    fs.mkdirSync(outDir, { recursive: true });
    await page.screenshot({ path: path.join(outDir, `${keyword.replace(/\s+/g, '_')}.png`) });
    log(`Found ${ads.length} ads for "${keyword}"`);
    return ads;
  });
}

// ==============================
// MAIN COMMAND HANDLER
// ==============================
async function main() {
  const cmd = process.argv[2] || 'status';

  switch (cmd) {
    case 'status':
      await showStatus();
      break;

    case 'token':
      const manual = process.argv[3];
      if (manual) {
        const val = await validateToken(manual);
        if (val.valid) {
          await saveToken(manual, { userName: val.name, userId: val.id });
          console.log(`✅ Token valid for ${val.name}`);
        } else {
          console.log(`❌ Invalid token: ${val.error?.message}`);
        }
      } else {
        const result = await extractTokenFromBrowser();
        if (result?.token) {
          console.log(`✅ Token found: ${result.token.substring(0, 40)}...`);
          await saveToken(result.token);
        } else {
          console.log('⚠️ Could not extract token from browser');
          await setupTokenFromUserInput();
        }
      }
      break;

    case 'catalog':
      const sub = process.argv[3];
      if (sub === 'stats') {
        displayCatalogStats(loadCatalog());
      } else if (sub === 'images') {
        const catalog = loadCatalog();
        const updated = assignImagesToProducts(catalog);
        saveCatalog(updated);
      } else if (sub === 'export') {
        const format = process.argv[4] || 'json';
        const catalog = loadCatalog();
        if (format === 'csv') {
          const csv = ['id,name,price,deliveryLink,image'];
          catalog.forEach(p => csv.push(`"${p.id}","${p.name}",${p.price},"${p.deliveryLink || ''}","${p.images?.[0] || ''}"`));
          fs.writeFileSync(path.join(TOKENS, 'catalog-export.csv'), csv.join('\n'), 'utf8');
          console.log(`Exported ${catalog.length} products to catalog-export.csv`);
        } else {
          console.log(`Catalog: ${catalog.length} products`);
        }
      } else {
        console.log('Usage: agent catalog [stats|images|export]');
      }
      break;

    case 'images':
      const cat = process.argv[3];
      const query = process.argv[4] || cat;
      if (cat) {
        await searchAndDownloadImages(cat, query);
      } else {
        const searches = [
          ['piano', 'persona tocando piano adulto'],
          ['programacion', 'programador frente a computador codigo'],
          ['diseno', 'diseñador gráfico tableta digital creativo'],
          ['ingles', 'persona estudiando inglés libro idiomas'],
          ['ia', 'inteligencia artificial robot tecnología futuro'],
        ];
        for (const [category, q] of searches) {
          await searchAndDownloadImages(category, q);
        }
      }
      break;

    case 'ads':
      if (process.argv[3] === 'drafts') {
        await generateAllAdDrafts();
        console.log('✅ Ad drafts generated');
      } else if (process.argv[3] === 'manager') {
        await navigateToAdsManager();
      } else if (process.argv[3] === 'status') {
        const token = await getToken();
        if (token) {
          try {
            const campaigns = await getCampaigns();
            const adsets = await getAdSets();
            const ads = await getAds();
            console.log(`Campaigns: ${campaigns.data?.length || 0}`);
            console.log(`Ad Sets: ${adsets.data?.length || 0}`);
            console.log(`Ads: ${ads.data?.length || 0}`);
            if (campaigns.data) campaigns.data.forEach(c => console.log(`  - ${c.name} [${c.status}] ${c.objective} $${c.daily_budget || 0}/day`));
          } catch(e) { console.log(`Error: ${e.message}`); }
        } else {
          console.log('No token - cannot fetch ad status');
        }
      } else {
        console.log('Usage: agent ads [drafts|manager|status]');
      }
      break;

    case 'research':
      const keyword = process.argv[3] || 'cursos digitales';
      await searchFacebookAdsLibrary(keyword);
      break;

    case 'bm':
      await navigateToBusinessSettings();
      break;

    case 'help':
    default:
      console.log(`
FACEBOOK ADS MANAGER AGENT v1.0
USAGE: node facebook-agent.mjs <command> [args]

COMMANDS:
  status                    Show full system status
  token [token_string]      Validate and set Facebook access token
  catalog stats             Show catalog statistics
  catalog images            Auto-assign images from assets to products
  catalog export [csv|json] Export catalog
  images [cat] [query]      Download real product images from Pexels
  ads drafts                Generate ad drafts for all products
  ads manager               Open Ads Manager in browser
  ads status                Show current campaigns/adsets/ads
  research [keyword]        Search Facebook Ads Library for competitor ads
  bm                        Open Business Manager settings
  help                      Show this help

EXAMPLES:
  node facebook-agent.mjs token EAAB...your_token_here
  node facebook-agent.mjs catalog images
  node facebook-agent.mjs images piano "persona tocando piano"
  node facebook-agent.mjs ads drafts
  node facebook-agent.mjs research "cursos de ingles"
`);
      break;
  }
}

main().catch(e => { console.error('FATAL:', e.message); process.exit(1); });
