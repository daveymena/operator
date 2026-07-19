import fs from 'fs';

const TOKEN_FILE = 'C:\\Users\\ADMIN\\Music\\proyecto-unificado\\facebook-automation\\tokens\\fb_tokens_output.json';
const CATALOGO_FILE = 'C:\\Users\\ADMIN\\Music\\proyecto-unificado\\facebook-automation\\tokens\\megapack-82-productos.json';
const FB_GRAPH = 'https://graph.facebook.com/v21.0';

const token = JSON.parse(fs.readFileSync(TOKEN_FILE, 'utf8'));
const catalogo = JSON.parse(fs.readFileSync(CATALOGO_FILE, 'utf8'));
const ACCESS_TOKEN = token.accessToken;
const AD_ACCOUNT = token.adAccountId || '1545022093928422';
const PAGE_ID = token.pageId || '1278583508663384';
const WHATSAPP_NUMBER = '573206541575';

const productoNarradores = catalogo.find(p =>
  p.name.toLowerCase().includes('locución') ||
  p.name.toLowerCase().includes('narrador') ||
  p.name.toLowerCase().includes('locucion')
);

if (!productoNarradores) {
  console.log('❌ No se encontró el curso de Locución/Narradores en el catálogo');
  process.exit(1);
}

const AD_COPY = `🎙️ CONVIÉRTETE EN LOCUTOR PROFESIONAL

Desarrolla tu voz y técnica de locución para radio, podcast, doblaje y medios digitales.

✅ Técnicas vocales profesionales
✅ Locución para radio y podcast
✅ Doblaje y voice-over
✅ Edición de audio
✅ Acceso de por vida
✅ Soporte personalizado

💰 Solo $20,000 COP

🎁 ¡Empieza hoy!`;

function getWhatsAppLink() {
  const text = encodeURIComponent(`Hola! Me interesa "${productoNarradores.name}" ($20,000 COP)`);
  return `https://wa.me/${WHATSAPP_NUMBER}?text=${text}`;
}

async function createCampaign() {
  const url = `${FB_GRAPH}/act_${AD_ACCOUNT}/campaigns`;
  const params = new URLSearchParams({
    name: '🎙️ Locución Profesional - Narradores',
    objective: 'OUTCOME_SALES',
    status: 'PAUSED',
    special_ad_categories: '[]',
    daily_budget: 800000,
    access_token: ACCESS_TOKEN,
  });
  const res = await fetch(url, { method: 'POST', body: params });
  return res.json();
}

async function createAdSet(campaignId) {
  const url = `${FB_GRAPH}/act_${AD_ACCOUNT}/adsets`;
  const params = new URLSearchParams({
    name: 'AdSet: Locución Profesional - Narradores',
    campaign_id: campaignId,
    status: 'PAUSED',
    billing_event: 'IMPRESSIONS',
    optimization_goal: 'REACH',
    bid_amount: 8000,
    daily_budget: 800000,
    targeting: JSON.stringify({
      geo_locations: { countries: ['CO'] },
      ages: { min: 18, max: 65 },
      genders: [1, 2],
      interests: [
        { id: '6003139266461', name: 'Online Learning' },
        { id: '6003318220663', name: 'Voice Acting' },
      ],
    }),
    start_time: new Date(Date.now() + 86400000).toISOString().split('.')[0] + '+0000',
    access_token: ACCESS_TOKEN,
  });
  const res = await fetch(url, { method: 'POST', body: params });
  return res.json();
}

async function createCreative() {
  const link = getWhatsAppLink();
  const url = `${FB_GRAPH}/act_${AD_ACCOUNT}/adcreatives`;
  const body = new URLSearchParams({
    name: 'Creative: Locución Profesional',
    object_story_spec: JSON.stringify({
      page_id: PAGE_ID,
      link_data: {
        link,
        message: AD_COPY,
        name: '🎙️ Curso Locución Profesional',
        description: 'Aprende locución, doblaje y voice-over desde cero',
        call_to_action: { type: 'LEARN_MORE' },
      },
    }),
    degrees_of_freedom_spec: JSON.stringify({
      creative_features_spec: { standard_enhancements: { enroll_status: 'OPT_IN' } },
    }),
    access_token: ACCESS_TOKEN,
  });
  const res = await fetch(url, { method: 'POST', body });
  return res.json();
}

async function createAd(adSetId, creativeId) {
  const url = `${FB_GRAPH}/act_${AD_ACCOUNT}/ads`;
  const body = new URLSearchParams({
    name: '🎙️ Ad: Locución Profesional - Narradores',
    adset_id: adSetId,
    creative: JSON.stringify({ creative_id: creativeId }),
    status: 'PAUSED',
    access_token: ACCESS_TOKEN,
  });
  const res = await fetch(url, { method: 'POST', body });
  return res.json();
}

async function main() {
  console.log('\n╔══════════════════════════════════════════════════════════╗');
  console.log('║   🎙️  CREANDO CAMPAÑA DE LOCUCIÓN / NARRADORES         ║');
  console.log('╚══════════════════════════════════════════════════════════╝\n');

  console.log(`Producto: ${productoNarradores.name}`);
  console.log(`Token: ${ACCESS_TOKEN.substring(0, 25)}...`);
  console.log(`WhatsApp: ${WHATSAPP_NUMBER}\n`);

  console.log('[1/3] Creando campaña...');
  const campaign = await createCampaign();
  if (!campaign.id) {
    console.log(`  ❌ Error: ${JSON.stringify(campaign).substring(0, 150)}`);
    return;
  }
  console.log(`  ✅ Campaña ID: ${campaign.id}`);

  console.log('[2/3] Creando AdSet...');
  const adSet = await createAdSet(campaign.id);
  if (!adSet.id) {
    console.log(`  ❌ Error: ${JSON.stringify(adSet).substring(0, 150)}`);
    return;
  }
  console.log(`  ✅ AdSet ID: ${adSet.id}`);

  console.log('[3/3] Creando creativo y anuncio...');
  const creative = await createCreative();
  if (!creative.id) {
    console.log(`  ❌ Error creative: ${JSON.stringify(creative).substring(0, 150)}`);
    return;
  }
  console.log(`  ✅ Creative ID: ${creative.id}`);

  const ad = await createAd(adSet.id, creative.id);
  if (ad.id) {
    console.log(`  ✅ ANUNCIO CREADO: ${ad.id}`);
  } else {
    console.log(`  ❌ Error: ${JSON.stringify(ad).substring(0, 150)}`);
  }

  console.log(`\n${'═'.repeat(55)}`);
  console.log('  📊 RESUMEN');
  console.log(`  Campaña: ${campaign.id}`);
  console.log(`  AdSet:   ${adSet.id}`);
  console.log(`  Anuncio: ${ad.id || 'ERROR'}`);
  console.log(`  Estado:  PAUSED (revisar en Ads Manager)`);
  console.log(`  Presupuesto: $8,000 COP/día`);
}

main().catch(e => console.log('FATAL:', e.message));
