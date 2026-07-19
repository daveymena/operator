import fs from 'fs';
import { setTimeout } from 'timers/promises';
import { generateAd } from '../../ads/ad-creatives.mjs';

const TOKEN_FILE = 'C:\\Users\\ADMIN\\Music\\proyecto-unificado\\facebook-automation\\tokens\\fb_tokens_output.json';
const CATALOGO_FILE = 'C:\\Users\\ADMIN\\Music\\proyecto-unificado\\facebook-automation\\tokens\\megapack-82-productos.json';
const LOG_FILE = 'C:\\Users\\ADMIN\\Music\\proyecto-unificado\\facebook-automation\\logs\\campanias-creadas.json';

const FB_GRAPH = 'https://graph.facebook.com/v21.0';
const token = JSON.parse(fs.readFileSync(TOKEN_FILE, 'utf8'));
const catalogo = JSON.parse(fs.readFileSync(CATALOGO_FILE, 'utf8'));

const AD_ACCOUNT = token.adAccountId || '1545022093928422';
const ACCESS_TOKEN = token.accessToken;
const PAGE_ID = token.pageId || '1278583508663384';
const WHATSAPP_NUMBER = '573206541575';

// === CATEGORÍAS actualizadas con presupuestos realistas y cobertura total ===
const CATEGORIES = [
  { key: 'diseno',       name: 'Diseño Gráfico y Multimedia',   budget: 10000, emoji: '🎨', match: p => p.price === 20000 && ['Diseño','Gráfico','Photoshop','Ilustración','Logotipos','Lettering','Animación','Canva','Filmora','Premiere','Portadas','Infografías','Sublimados','InDesign','Fotomontaje','Fotografía','Álbumes','Comics','Condorito','Album'].some(k => p.name.toLowerCase().includes(k.toLowerCase())) },
  { key: 'programacion', name: 'Programación y Tecnología',      budget: 10000, emoji: '💻', match: p => p.price === 20000 && ['Programación','Desarrollo','Web','Videojuegos','Animación 3D','Cinema','WordPress','Interfaces','App','Código','Consola','Reparación','Celulares','Play Station','Car Audio','Ensamblaje','Computadora','DJ','Producción Musical','Musical'].some(k => p.name.toLowerCase().includes(k.toLowerCase())) },
  { key: 'marketing',    name: 'Marketing y Negocios',           budget: 8000,  emoji: '📈', match: p => p.price === 20000 && ['Marketing','SEO','Ecommerce','Marca','Negocios','Libros'].some(k => p.name.toLowerCase().includes(k.toLowerCase())) },
  { key: 'idiomas',      name: 'Idiomas, Locución y Desarrollo', budget: 6000,  emoji: '🌎', match: p => p.price === 20000 && ['Inglés','Idiomas','Locución','Narrador','Psicología','Memoria','Preuniversitario','Pilates','Fitness','Fuerza','Terapia','Lenguaje','Autismo','Perro'].some(k => p.name.toLowerCase().includes(k.toLowerCase())) },
  { key: 'ofimatica',    name: 'Oficina y Productividad',        budget: 5000,  emoji: '📊', match: p => p.price === 20000 && ['Excel','Office','Instaladores','WordPress','Contabilidad'].some(k => p.name.toLowerCase().includes(k.toLowerCase())) },
  { key: 'ingenieria',   name: 'Ingeniería y Arquitectura',      budget: 7000,  emoji: '🏗️', match: p => p.price === 20000 && ['Arquitectura','Ingeniería','Revit','Metrados','Planos','Expedientes','Drywall','Proyectos','Mecánica','Motos'].some(k => p.name.toLowerCase().includes(k.toLowerCase())) },
  { key: 'musica',       name: 'Música y Audio',                 budget: 6000,  emoji: '🎵', match: p => p.price === 20000 && ['Guitarra','Piano','Música','Musical','DJ','Producción Musical','Audio'].some(k => p.name.toLowerCase().includes(k.toLowerCase())) },
  { key: 'hacking',      name: 'Ciberseguridad',                 budget: 5000,  emoji: '🛡️', match: p => p.price === 20000 && ['Hacking'].some(k => p.name.toLowerCase().includes(k.toLowerCase())) },
  { key: 'gastronomia',  name: 'Cocina y Gastronomía',           budget: 5000,  emoji: '🍳', match: p => p.price === 20000 && ['Gastronomía','Cocina'].some(k => p.name.toLowerCase().includes(k.toLowerCase())) },
  { key: 'infantil',     name: 'Infantil y Educativo',           budget: 4000,  emoji: '🧸', match: p => p.price === 20000 && ['Kid','Imprimible','Infantil','Educativo'].some(k => p.name.toLowerCase().includes(k.toLowerCase())) },
  { key: 'fotografia',   name: 'Fotografía y Video',             budget: 6000,  emoji: '📷', match: p => p.price === 20000 && ['Fotografía','Video','Cámara','Edición Video'].some(k => p.name.toLowerCase().includes(k.toLowerCase())) },
  { key: 'bundle',       name: '🔥 MegaPack Completo',           budget: 15000, emoji: '🚀', match: p => p.name === 'MegaPack Completo' },
  { key: 'piano',        name: '🎹 Curso de Piano',              budget: 5000,  emoji: '🎵', match: p => p.name === 'MegaPack Completo de Piano' },
  { key: 'general',      name: '📦 Otros Productos',             budget: 5000,  emoji: '📦', match: p => p.price === 20000 },
];

function getWhatsAppLink(product) {
  const text = encodeURIComponent(`Hola! Me interesa "${product.name}" ($${(product.price||0).toLocaleString('es-CO')} COP)`);
  return `https://wa.me/${WHATSAPP_NUMBER}?text=${text}`;
}

async function createCampaign(name, budget) {
  const url = `${FB_GRAPH}/act_${AD_ACCOUNT}/campaigns`;
  const params = new URLSearchParams({
    name,
    objective: 'OUTCOME_SALES',
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
      interests: [{ id: '6003139266461', name: 'Online Learning' }],
    }),
    start_time: new Date(Date.now() + 86400000).toISOString().split('.')[0] + '+0000',
    access_token: ACCESS_TOKEN,
  });
  const res = await fetch(url, { method: 'POST', body: params });
  return res.json();
}

async function createAd(name, adSetId, product) {
  const ad = generateAd(product);
  const link = getWhatsAppLink(product);

  const creativeParams = {
    object_story_spec: {
      page_id: PAGE_ID,
      link_data: {
        link,
        message: ad.primaryText,
        name: ad.headline.substring(0, 40),
        description: ad.description,
        call_to_action: { type: 'LEARN_MORE' },
      },
    },
    degrees_of_freedom_spec: {
      creative_features_spec: { standard_enhancements: { enroll_status: 'OPT_IN' } },
    },
  };

  const creativeUrl = `${FB_GRAPH}/act_${AD_ACCOUNT}/adcreatives`;
  const creativeBody = new URLSearchParams({
    name: `Creative: ${product.name.substring(0, 50)}`,
    object_story_spec: JSON.stringify(creativeParams.object_story_spec),
    access_token: ACCESS_TOKEN,
  });
  const creativeRes = await fetch(creativeUrl, { method: 'POST', body: creativeBody });
  const creative = await creativeRes.json();
  if (!creative.id) return { error: creative };

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
  console.log('\n╔══════════════════════════════════════════════════════════╗');
  console.log('║   🚀 CREANDO CAMPAÑAS DRAFT — CATÁLOGO DIGITAL 20K      ║');
  console.log('╚══════════════════════════════════════════════════════════╝\n');

  console.log(`Productos: ${catalogo.length}`);
  console.log(`  20.000 COP: ${catalogo.filter(p => p.price === 20000).length}`);
  console.log(`  60.000 COP: ${catalogo.filter(p => p.price === 60000).length}`);
  console.log(`Token: ${(ACCESS_TOKEN||'').substring(0, 20)}...`);

  // Asignar cada producto a la PRIMERA categoría que coincida (prioridad)
  const assigned = new Set();
  const grouped = CATEGORIES.map(cat => ({
    ...cat,
    products: catalogo.filter(p => {
      if (assigned.has(p.id || p.name)) return false;
      if (cat.match(p)) {
        assigned.add(p.id || p.name);
        return true;
      }
      return false;
    })
  }));

  const results = { campaigns: [], adsets: [], ads: [], errors: [] };

  for (const cat of grouped) {
    if (cat.products.length === 0) {
      console.log(`\n  ⚠️  ${cat.emoji} ${cat.name}: 0 productos`);
      continue;
    }

    const maxAds = cat.key === 'general' ? 1 : Math.min(cat.products.length, 5);
    console.log(`\n  ${cat.emoji} ${cat.name} (${cat.products.length} prod, ${maxAds} ads) — $${cat.budget.toLocaleString()}/día`);
    console.log(`  ${'─'.repeat(55)}`);

    const campaignName = `[VENTAS] ${cat.emoji} ${cat.name} - 20K`;
    const campaign = await createCampaign(campaignName, cat.budget);
    if (!campaign.id) {
      console.log(`  ❌ Error campaña: ${JSON.stringify(campaign).substring(0, 100)}`);
      results.errors.push({ category: cat.name, action: 'create_campaign', error: campaign });
      continue;
    }
    console.log(`  ✅ Campaña: ${campaign.id}`);
    results.campaigns.push({ category: cat.name, id: campaign.id, budget: cat.budget });

    const adSetName = `AdSet: ${cat.name} - ${cat.products.length} productos`;
    const adSet = await createAdSet(adSetName, campaign.id, cat.budget);
    if (!adSet.id) {
      console.log(`  ❌ Error adset: ${JSON.stringify(adSet).substring(0, 100)}`);
      results.errors.push({ category: cat.name, action: 'create_adset', error: adSet });
      continue;
    }
    console.log(`  ✅ AdSet: ${adSet.id}`);
    results.adsets.push({ category: cat.name, id: adSet.id });

    for (let i = 0; i < maxAds; i++) {
      const product = cat.products[i];
      if (!product) break;
      const adName = `Ad: ${product.name.substring(0, 35)}`;
      console.log(`    📦 ${i+1}. ${product.name.substring(0, 45)}`);
      const ad = await createAd(adName, adSet.id, product);
      if (ad.id) {
        console.log(`      ✅ ID: ${ad.id}`);
        results.ads.push({ category: cat.name, product: product.name, id: ad.id });
      } else {
        console.log(`      ❌ Error: ${JSON.stringify(ad.error || ad).substring(0, 80)}`);
        results.errors.push({ category: cat.name, product: product.name, error: ad });
      }
      await setTimeout(500);
    }
    await setTimeout(1000);
  }

  console.log(`\n${'═'.repeat(55)}`);
  console.log('  📊 RESUMEN');
  console.log(`  Campañas: ${results.campaigns.length}`);
  console.log(`  AdSets:    ${results.adsets.length}`);
  console.log(`  Anuncios:  ${results.ads.length}`);
  console.log(`  Errores:   ${results.errors.length}`);
  const totalBudget = results.campaigns.reduce((s, c) => s + c.budget, 0);
  console.log(`  Presupuesto diario total: $${totalBudget.toLocaleString()} COP`);
  console.log(`  Estado: PAUSED`);

  fs.mkdirSync('C:\\Users\\ADMIN\\Music\\proyecto-unificado\\facebook-automation\\logs', { recursive: true });
  fs.writeFileSync(LOG_FILE, JSON.stringify(results, null, 2));
  console.log(`\n  📝 Log: ${LOG_FILE}`);
}

main().catch(e => console.log('FATAL:', e.message));
