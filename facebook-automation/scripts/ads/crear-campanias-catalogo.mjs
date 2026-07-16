import fs from 'fs';
import { setTimeout } from 'timers/promises';

const TOKEN_FILE = 'C:\\Users\\ADMIN\\Music\\proyecto-unificado\\facebook-automation\\tokens\\fb_tokens_output.json';
const CATALOGO_FILE = 'C:\\Users\\ADMIN\\Music\\proyecto-unificado\\facebook-automation\\tokens\\catalogo-completo-importar.json';
const LOG_FILE = 'C:\\Users\\ADMIN\\Music\\proyecto-unificado\\facebook-automation\\logs\\campanias-creadas.json';

const FB_GRAPH = 'https://graph.facebook.com/v21.0';

const token = JSON.parse(fs.readFileSync(TOKEN_FILE, 'utf8'));
const catalogo = JSON.parse(fs.readFileSync(CATALOGO_FILE, 'utf8'));

const AD_ACCOUNT = token.adAccountId || '1545022093928422';
const ACCESS_TOKEN = token.accessToken;
const PAGE_ID = token.pageId || '1278583508663384';

const CATEGORIES = {
  laptops: { name: 'Laptops y Portátiles', budget: 8000, keywords: ['laptop', 'portatil', 'macbook', 'notebook', 'computador'], emoji: '💻' },
  monitores: { name: 'Monitores', budget: 6000, keywords: ['monitor', 'pantalla', 'display'], emoji: '🖥️' },
  perifericos: { name: 'Periféricos y Accesorios', budget: 5000, keywords: ['mouse', 'teclado', 'combo', 'receptor'], emoji: '⌨️' },
  audio: { name: 'Audífonos y Diademas', budget: 6000, keywords: ['diadema', 'audifonos', 'gaming', 'gamer', 'astro', 'logitech'], emoji: '🎧' },
};

function groupByCategory() {
  const grouped = {};
  for (const [key, cat] of Object.entries(CATEGORIES)) {
    grouped[key] = {
      ...cat,
      products: catalogo.filter(p => cat.keywords.some(k => p.name.toLowerCase().includes(k)))
    };
  }
  return grouped;
}

async function createCampaign(name, budget, objective = 'OUTCOME_SALES') {
  const url = `${FB_GRAPH}/act_${AD_ACCOUNT}/campaigns`;
  const params = new URLSearchParams({
    name,
    objective,
    status: 'PAUSED',
    special_ad_categories: '[]',
    daily_budget: Math.round(budget * 100),
    access_token: ACCESS_TOKEN,
  });
  const res = await fetch(url, { method: 'POST', body: params });
  return res.json();
}

async function createAdSet(name, campaignId, budget) {
  const url = `${FB_GRAPH}/act_${AD_ACCOUNT}/adsets`;
  const params = new URLSearchParams({
    name,
    campaign_id: campaignId,
    status: 'PAUSED',
    billing_event: 'IMPRESSIONS',
    optimization_goal: 'REACH',
    bid_amount: Math.round(budget * 100 / 100),
    daily_budget: Math.round(budget * 100),
    targeting: JSON.stringify({
      geo_locations: { countries: ['CO'] },
      ages: { min: 18, max: 65 },
      genders: [1, 2],
    }),
    start_time: new Date(Date.now() + 86400000).toISOString().split('.')[0] + '+0000',
    access_token: ACCESS_TOKEN,
  });
  const res = await fetch(url, { method: 'POST', body: params });
  return res.json();
}

async function createAd(name, adSetId, product) {
  const creativeParams = {
    object_story_spec: {
      page_id: PAGE_ID,
      link_data: {
        link: product.paymentLinkCustom || '#',
        message: `${product.name}\n\n${product.description || ''}\n\n💰 Precio: $${(product.price || 0).toLocaleString('es-CO')} COP`,
        name: product.name.substring(0, 50),
        description: (product.description || '').substring(0, 120),
        call_to_action: { type: 'SHOP_NOW' },
      },
    },
    degrees_of_freedom_spec: {
      creative_features_spec: { standard_enhancements: { enroll_status: 'OPT_IN' } },
    },
  };
  if (product.images && product.images[0] && !product.images[0].includes('data:image')) {
    creativeParams.object_story_spec.link_data.image_url = product.images[0];
  }
  const creativeUrl = `${FB_GRAPH}/act_${AD_ACCOUNT}/adcreatives`;
  const creativeBody = new URLSearchParams({
    name: `Creative: ${product.name.substring(0, 50)}`,
    object_story_spec: JSON.stringify(creativeParams.object_story_spec),
    access_token: ACCESS_TOKEN,
  });
  const creativeRes = await fetch(creativeUrl, { method: 'POST', body: creativeBody });
  const creative = await creativeRes.json();
  if (!creative.id) {
    return { error: creative };
  }
  const adUrl = `${FB_GRAPH}/act_${AD_ACCOUNT}/ads`;
  const adBody = new URLSearchParams({
    name,
    adset_id: adSetId,
    creative: JSON.stringify({ creative_id: creative.id }),
    status: 'PAUSED',
    access_token: ACCESS_TOKEN,
  });
  const adRes = await fetch(adUrl, { method: 'POST', body: adBody });
  return adRes.json();
}

async function main() {
  console.log('\n╔════════════════════════════════════════════════════╗');
  console.log('║   🚀 CREANDO CAMPAÑAS DRAFT DESDE EL CATÁLOGO     ║');
  console.log('╚════════════════════════════════════════════════════╝\n');
  console.log(`Token: ${ACCESS_TOKEN.substring(0, 30)}...`);
  console.log(`Ad Account: ${AD_ACCOUNT}`);
  console.log(`Page ID: ${PAGE_ID}`);
  console.log(`Productos en catálogo: ${catalogo.length}`);
  const grouped = groupByCategory();
  const results = { campaigns: [], adsets: [], ads: [], errors: [] };
  for (const [catKey, catData] of Object.entries(grouped)) {
    if (catData.products.length === 0) {
      console.log(`\n  ⚠️ ${catData.emoji} ${catData.name}: 0 productos (saltando)`);
      continue;
    }
    console.log(`\n  ${catData.emoji} ${catData.name} (${catData.products.length} productos) - $${catData.budget}/día`);
    console.log(`  ${'─'.repeat(50)}`);
    const campaignName = `[DRAFT] ${catData.emoji} ${catData.name} - VentasPro`;
    const campaign = await createCampaign(campaignName, catData.budget);
    if (campaign.id) {
      console.log(`  ✅ Campaña: ${campaignName} (ID: ${campaign.id})`);
      results.campaigns.push({ category: catKey, name: campaignName, id: campaign.id, budget: catData.budget });
      const adSetName = `AdSet: ${catData.name} - ${catData.products.length} productos`;
      const adSet = await createAdSet(adSetName, campaign.id, catData.budget);
      if (adSet.id) {
        console.log(`  ✅ AdSet: ${adSetName} (ID: ${adSet.id})`);
        results.adsets.push({ category: catKey, name: adSetName, id: adSet.id });
        for (let i = 0; i < Math.min(catData.products.length, 5); i++) {
          const product = catData.products[i];
          const adName = `Ad: ${product.name.substring(0, 40)}`;
          console.log(`    📦 Anuncio ${i+1}: ${product.name.substring(0, 50)}...`);
          const ad = await createAd(adName, adSet.id, product);
          if (ad.id) {
            console.log(`      ✅ Ads ID: ${ad.id}`);
            results.ads.push({ category: catKey, product: product.name, id: ad.id });
          } else {
            console.log(`      ❌ Error: ${JSON.stringify(ad.error || ad).substring(0, 100)}`);
            results.errors.push({ category: catKey, product: product.name, error: ad });
          }
          await setTimeout(500);
        }
      } else {
        console.log(`  ❌ Error AdSet: ${JSON.stringify(adSet).substring(0, 100)}`);
        results.errors.push({ category: catKey, action: 'create_adset', error: adSet });
      }
    } else {
      console.log(`  ❌ Error Campaña: ${JSON.stringify(campaign).substring(0, 100)}`);
      results.errors.push({ category: catKey, action: 'create_campaign', error: campaign });
    }
    await setTimeout(1000);
  }
  console.log(`\n${'═'.repeat(55)}`);
  console.log('  📊 RESUMEN');
  console.log(`  Campañas creadas: ${results.campaigns.length}`);
  console.log(`  AdSets creados: ${results.adsets.length}`);
  console.log(`  Anuncios creados: ${results.ads.length}`);
  console.log(`  Errores: ${results.errors.length}`);
  const totalBudget = results.campaigns.reduce((s, c) => s + c.budget, 0);
  console.log(`  Presupuesto total diario: $${totalBudget.toLocaleString()} COP`);
  console.log(`  Estado: PAUSED (borradores listos para activar)`);
  fs.mkdirSync('C:\\Users\\ADMIN\\Music\\proyecto-unificado\\facebook-automation\\logs', { recursive: true });
  fs.writeFileSync(LOG_FILE, JSON.stringify(results, null, 2));
  console.log(`\n  📝 Log guardado en: ${LOG_FILE}`);
  console.log(`\n${'═'.repeat(55)}`);
  console.log('  ✅ Para ACTIVAR las campañas, ve a Ads Manager:');
  console.log('  https://adsmanager.facebook.com/adsmanager/manage/campaigns');
  console.log('  Filtra por PAUSED y activa las que quieras.');
}

main().catch(e => console.log('ERROR FATAL:', e.message));
