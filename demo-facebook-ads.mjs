#!/usr/bin/env node

/**
 * ╔══════════════════════════════════════════════════════════════════╗
 * ║    DEMO: Operator Pro vs ChatGPT Operator                       ║
 * ║    Crear Campaña en Facebook Ads Manager                        ║
 * ╚══════════════════════════════════════════════════════════════════╝
 * 
 * Este script demuestra las dos formas de crear campañas:
 *   1. VÍA API (como ChatGPT + MCP) — rápido y confiable
 *   2. VÍA UI (como ChatGPT Operator) — navega el Ads Manager como humano
 * 
 * USO:
 *   node demo-facebook-ads.mjs --mode=api       # Vía API (necesita token)
 *   node demo-facebook-ads.mjs --mode=ui        # Vía UI (necesita Chrome abierto)
 *   node demo-facebook-ads.mjs --mode=both      # Ambas
 */

import { FacebookAdsSkill } from './operator/skills/facebook-ads.mjs';
import fs from 'fs';
import path from 'path';

// ─── Config ──────────────────────────────────────────────────────────────────

const campaignConfig = {
  name: '🤖 Operator Pro — Campaña Demo',
  objective: 'OUTCOME_TRAFFIC',
  budget: 5000, // $5,000 COP/día
  
  audience: {
    location: 'Colombia',
    ageMin: 22,
    ageMax: 50,
    interests: []
  },
  
  creative: {
    headline: 'Automatiza tu negocio con IA',
    primaryText: '🤖 Descubre cómo la inteligencia artificial puede transformar tu negocio. Automatiza tareas, genera contenido y aumenta tus ventas.',
    description: 'Soluciones de IA para empresas',
    websiteUrl: 'https://example.com',
    cta: 'LEARN_MORE'
  },
  
  saveAsDraft: true
};

const apiConfig = {
  name: '🤖 Operator Pro — Campaña API Demo',
  objective: 'OUTCOME_TRAFFIC',
  status: 'PAUSED',
  dailyBudget: 5000,
  targeting: {
    geo_locations: { countries: ['CO'] },
    age_min: 22,
    age_max: 50,
    interests: []
  },
  creative: {
    pageId: process.env.FACEBOOK_PAGE_ID || '',
    headline: 'Automatiza tu negocio con IA',
    primaryText: '🤖 Descubre cómo la IA puede transformar tu negocio.',
    websiteUrl: 'https://example.com',
    cta: 'LEARN_MORE'
  }
};

// ─── Parse Args ──────────────────────────────────────────────────────────────

const args = process.argv.slice(2);
const flags = {};
for (const arg of args) {
  if (arg.startsWith('--')) {
    const [k, v] = arg.slice(2).split('=');
    flags[k] = v || true;
  }
}

const mode = flags.mode || 'api';

// ─── Main ────────────────────────────────────────────────────────────────────

async function main() {
  console.log(`
╔══════════════════════════════════════════════════════════════════╗
║                                                                  ║
║    🤖 Operator Pro vs ChatGPT Operator — Facebook Ads Demo      ║
║                                                                  ║
╠══════════════════════════════════════════════════════════════════╣
║                                                                  ║
║  MODO: ${mode.padEnd(54)}║
║                                                                  ║
║  Dos enfoques para crear campañas como un humano:               ║
║                                                                  ║
║  📡 API (como ChatGPT + MCP):                                   ║
║     → Llamadas directas a Meta Graph API                        ║
║     → Rápido, confiable, sin navegador                          ║
║     → Necesita: Access Token                                    ║
║                                                                  ║
║  🖥️  UI (como ChatGPT Operator):                                ║
║     → Ve la pantalla, hace clicks, escribe                      ║
║     → Navega el Ads Manager como humano                         ║
║     → Necesita: Chrome abierto con --remote-debugging-port      ║
║                                                                  ║
╚══════════════════════════════════════════════════════════════════╝
`);

  const skill = new FacebookAdsSkill({
    adAccountId: process.env.FACEBOOK_AD_ACCOUNT || flags.account || '',
    verbose: true
  });

  // ─── API Mode ──────────────────────────────────────────────────────────

  if (mode === 'api' || mode === 'both') {
    console.log('\n' + '═'.repeat(60));
    console.log('📡 MODO API — Creando campaña vía Meta Graph API');
    console.log('═'.repeat(60) + '\n');

    // Check for token
    const tokenFile = path.join('facebook-automation', 'tokens', 'fb_tokens_output.json');
    if (fs.existsSync(tokenFile)) {
      console.log('✅ Token encontrado:', tokenFile);
    } else {
      console.log('⚠️  No se encontró token en:', tokenFile);
      console.log('   Crea uno con: node facebook-automation/scripts/extract-token.mjs');
      console.log('   O establece FACEBOOK_ACCESS_TOKEN en .env');
    }

    const result = await skill.createCampaignViaAPI(apiConfig);
    
    if (result.ok) {
      console.log('\n✅ CAMPAÑA CREADA VÍA API:');
      console.log(`   Campaign ID: ${result.campaignId}`);
      if (result.adSetId) console.log(`   Ad Set ID:   ${result.adSetId}`);
      if (result.adId) console.log(`   Ad ID:       ${result.adId}`);
    } else {
      console.log('\n❌ Error:', result.error);
    }
  }

  // ─── UI Mode ───────────────────────────────────────────────────────────

  if (mode === 'ui' || mode === 'both') {
    console.log('\n' + '═'.repeat(60));
    console.log('🖥️  MODO UI — Navegando Ads Manager como humano');
    console.log('═'.repeat(60) + '\n');
    
    console.log('⚠️  REQUISITOS:');
    console.log('   1. Chrome abierto con: chrome --remote-debugging-port=9222');
    console.log('   2. Sesión de Facebook iniciada en Chrome');
    console.log('   3. Acceso al Ads Manager de tu cuenta');
    console.log('');

    const init = await skill.init();
    if (!init.ok) {
      console.log('❌ No se pudo inicializar:', init.error);
      console.log('\n💡 Para abrir Chrome con debugging:');
      console.log('   Windows: "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe" --remote-debugging-port=9222');
      console.log('   Mac:     /Applications/Google\\ Chrome.app/Contents/MacOS/Google\\ Chrome --remote-debugging-port=9222');
      console.log('   Linux:   google-chrome --remote-debugging-port=9222');
      return;
    }

    console.log(`✅ Browser conectado (${init.backend})`);
    console.log('🚀 Iniciando creación de campaña por UI...\n');

    const result = await skill.createCampaign(campaignConfig);
    
    if (result.ok) {
      console.log('\n✅ CAMPAÑA CREADA VÍA UI:');
      console.log(`   Screenshots: ${result.screenshots?.length || 0}`);
      console.log(`   Steps: ${result.steps}`);
      result.screenshots?.forEach(s => console.log(`   📸 ${s.label}: ${s.file}`));
    } else {
      console.log('\n❌ Error:', result.error);
    }
  }

  // ─── Comparison ────────────────────────────────────────────────────────

  console.log(`
╔══════════════════════════════════════════════════════════════════╗
║                                                                  ║
║    📊 COMPARACIÓN: Operator Pro vs ChatGPT Operator              ║
║                                                                  ║
╠══════════════════════════════════════════════════════════════════╣
║                                                                  ║
║  Capacidad                    Operator Pro    ChatGPT Operator   ║
║  ─────────────────────────────────────────────────────────────   ║
║  Crear campaña (API)          ✅ Sí           ✅ Sí (MCP)       ║
║  Crear campaña (UI)           ✅ Sí           ✅ Sí             ║
║  Ver pantalla + entender      ✅ Sí           ✅ Sí             ║
║  Click/Type/Scroll            ✅ Sí           ✅ Sí             ║
║  Verificar resultados         ✅ Sí           ✅ Sí             ║
║  Multi-paso workflows         ✅ Sí           ✅ Sí             ║
║  Analizar métricas            ✅ Sí           ✅ Sí             ║
║  Ajustar presupuestos         ✅ Sí           ✅ Sí             ║
║  Pausar/activar campañas      ✅ Sí           ✅ Sí             ║
║  Subir creativos              ✅ Sí           ✅ Sí             ║
║  Optimizar audiencias         ✅ Sí           ✅ Sí             ║
║                                                                  ║
║  VENTAJAS de Operator Pro:                                       ║
║  ─────────────────────────────────────────────────────────────   ║
║  • Open source — tú controlas todo                              ║
║  • Sin costo por uso (API keys propias)                         ║
║  • Funciona en tu PC, sin enviar datos a OpenAI                 ║
║  • 20+ proveedores de IA (no solo OpenAI)                       ║
║  • Se puede extender con plugins                                ║
║  • API REST propia para integración                             ║
║                                                                  ║
╚══════════════════════════════════════════════════════════════════╝
`);
}

main().catch(e => {
  console.error('FATAL:', e.message);
  process.exit(1);
});
