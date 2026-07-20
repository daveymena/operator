#!/usr/bin/env node

/**
 * ╔══════════════════════════════════════════════════════════════╗
 * ║     Operator Pro — Test con OpenCode Zen (Modelos Free)     ║
 * ╚══════════════════════════════════════════════════════════════╝
 * 
 * Este script prueba la integración de Operator Pro con OpenCode Zen
 * usando los modelos gratuitos más potentes disponibles.
 * 
 * MODELOS GRATUITOS DISPONIBLES:
 * - big-pickle (modelo stealth grande, muy potente)
 * - nemotron-3-ultra-free (NVIDIA, 120B params)
 * - minimax-m3-free (MiniMax, excelente para contenido largo)
 * - deepseek-v4-flash-free (DeepSeek, rápido y eficiente)
 * - mimo-v2.5-free (Xiaomi MiMo, bueno para código)
 * - qwen3.6-plus-free (Alibaba Qwen, multilingüe)
 * 
 * CÓMO OBTENER API KEY GRATIS:
 * 1. Ve a https://opencode.ai/auth
 * 2. Regístrate (no requiere tarjeta de crédito)
 * 3. Copia tu API key del dashboard
 * 4. Pégala en config/.env como OPENCODE_ZEN_API_KEY=tu_key
 * 
 * USO:
 *   node test-opencode-zen.mjs
 *   OPENCODE_ZEN_API_KEY=sk-xxx node test-opencode-zen.mjs
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import axios from 'axios';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Cargar .env
const envPath = path.join(__dirname, 'config', '.env');
if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath });
  console.log(`✅ .env cargado desde ${envPath}`);
}

const API_KEY = process.env.OPENCODE_ZEN_API_KEY;
const ZEN_URL = 'https://opencode.ai/zen/v1';

// Modelos gratuitos ordenados por potencia
const FREE_MODELS = [
  { id: 'big-pickle', name: 'Big Pickle', desc: 'Modelo stealth grande (más potente)' },
  { id: 'nemotron-3-ultra-free', name: 'Nemotron 3 Ultra', desc: 'NVIDIA 120B params' },
  { id: 'minimax-m3-free', name: 'MiniMax M3', desc: 'Excelente para contenido largo' },
  { id: 'deepseek-v4-flash-free', name: 'DeepSeek V4 Flash', desc: 'Rápido y eficiente' },
  { id: 'mimo-v2.5-free', name: 'MiMo V2.5', desc: 'Optimizado para código' },
  { id: 'qwen3.6-plus-free', name: 'Qwen 3.6 Plus', desc: 'Multilingüe potente' }
];

// ─── Test Functions ──────────────────────────────────────────────────────────

async function testModel(model, testPrompt) {
  console.log(`\n${'─'.repeat(60)}`);
  console.log(`🧪 Probando: ${model.name} (${model.id})`);
  console.log(`   ${model.desc}`);
  console.log(`${'─'.repeat(60)}`);

  const startTime = Date.now();

  try {
    const response = await axios.post(
      `${ZEN_URL}/chat/completions`,
      {
        model: model.id,
        messages: [
          { role: 'system', content: 'Eres Operator Pro, un asistente autónomo de IA. Responde de forma concisa y útil.' },
          { role: 'user', content: testPrompt }
        ],
        temperature: 0.7,
        max_tokens: 500
      },
      {
        headers: {
          'Authorization': `Bearer ${API_KEY}`,
          'Content-Type': 'application/json'
        },
        timeout: 30000
      }
    );

    const duration = Date.now() - startTime;
    const content = response.data.choices?.[0]?.message?.content;
    const tokens = response.data.usage;

    console.log(`✅ ÉXITO (${duration}ms)`);
    console.log(`\n📝 Respuesta:`);
    console.log(content);
    
    if (tokens) {
      console.log(`\n📊 Tokens: ${tokens.prompt_tokens} prompt + ${tokens.completion_tokens} completion = ${tokens.total_tokens} total`);
    }

    return { ok: true, model: model.id, duration, content, tokens };

  } catch (error) {
    const duration = Date.now() - startTime;
    console.log(`❌ ERROR (${duration}ms)`);
    
    if (error.response) {
      console.log(`   Status: ${error.response.status}`);
      console.log(`   Error: ${JSON.stringify(error.response.data, null, 2)}`);
    } else {
      console.log(`   Error: ${error.message}`);
    }

    return { ok: false, model: model.id, duration, error: error.message };
  }
}

async function testOperatorIntegration() {
  console.log(`\n${'═'.repeat(60)}`);
  console.log(`🤖 Probando Integración con Operator Pro`);
  console.log(`${'═'.repeat(60)}`);

  // Importar el Brain de Operator
  const { Brain } = await import('./operator/brain.mjs');

  const brain = new Brain({
    groqKey: '', // No usamos Groq
    backend: 'opencodeZen',
    verbose: true
  });

  console.log('\n📋 Creando plan con OpenCode Zen...');
  const task = 'Busca información sobre frameworks de IA modernos y dame un resumen de los 3 principales';
  
  try {
    const plan = await brain.createPlan(task, 'Operator Pro puede navegar la web, ejecutar comandos y analizar información');
    
    if (plan && plan.goal) {
      console.log(`\n✅ Plan creado exitosamente:`);
      console.log(`   Objetivo: ${plan.goal}`);
      console.log(`   Pasos: ${plan.total_steps || plan.steps?.length}`);
      plan.steps?.forEach(s => {
        console.log(`   ${s.step}. ${s.goal}`);
      });
      return { ok: true, plan };
    } else {
      console.log('❌ No se pudo crear el plan');
      return { ok: false };
    }
  } catch (error) {
    console.log(`❌ Error: ${error.message}`);
    return { ok: false, error: error.message };
  }
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function main() {
  console.log(`
╔══════════════════════════════════════════════════════════════╗
║     🤖 Operator Pro — Test OpenCode Zen (Modelos Free)      ║
╚══════════════════════════════════════════════════════════════╝
`);

  if (!API_KEY) {
    console.log(`
⚠️  NO SE ENCONTRÓ API KEY

Para probar OpenCode Zen necesitas una API key gratuita:

1. Ve a: https://opencode.ai/auth
2. Regístrate (no requiere tarjeta de crédito)
3. Copia tu API key del dashboard
4. Crea el archivo config/.env con:
   OPENCODE_ZEN_API_KEY=tu_api_key_aqui

O ejecuta este script con la variable de entorno:
   OPENCODE_ZEN_API_KEY=sk-xxx node test-opencode-zen.mjs

`);
    
    console.log('\n📋 Modelos gratuitos disponibles en OpenCode Zen:\n');
    FREE_MODELS.forEach((m, i) => {
      console.log(`   ${i + 1}. ${m.name} (${m.id})`);
      console.log(`      ${m.desc}`);
    });

    console.log(`
💡 Una vez que tengas tu API key, este script probará:
   - Cada modelo gratuito con un prompt de prueba
   - La integración completa con Operator Pro
   - La capacidad de planificación autónoma

¡OpenCode Zen ofrece 100 requests/día gratis en todos los modelos!
`);
    process.exit(0);
  }

  console.log(`✅ API Key encontrada: ${API_KEY.substring(0, 10)}...${API_KEY.substring(API_KEY.length - 4)}`);
  console.log(`🔗 Endpoint: ${ZEN_URL}`);

  // Test 1: Probar cada modelo gratuito
  console.log(`\n${'═'.repeat(60)}`);
  console.log(`📊 FASE 1: Probando Modelos Gratuitos`);
  console.log(`${'═'.repeat(60)}`);

  const testPrompt = 'Explica en 3 frases qué es un agente autónomo de IA y cómo puede automatizar tareas en la web.';
  const results = [];

  for (const model of FREE_MODELS) {
    const result = await testModel(model, testPrompt);
    results.push(result);
    
    // Pausa entre requests para no saturar rate limits
    await new Promise(r => setTimeout(r, 1000));
  }

  // Resumen de Fase 1
  console.log(`\n${'═'.repeat(60)}`);
  console.log(`📊 RESUMEN FASE 1`);
  console.log(`${'═'.repeat(60)}`);
  
  const successful = results.filter(r => r.ok);
  const failed = results.filter(r => !r.ok);
  
  console.log(`✅ Exitosos: ${successful.length}/${results.length}`);
  console.log(`❌ Fallidos: ${failed.length}/${results.length}`);
  
  if (successful.length > 0) {
    console.log(`\n🏆 Modelos que funcionaron:`);
    successful.sort((a, b) => a.duration - b.duration);
    successful.forEach(r => {
      console.log(`   ${r.model}: ${r.duration}ms`);
    });
  }

  // Test 2: Integración con Operator Pro
  console.log(`\n${'═'.repeat(60)}`);
  console.log(`🤖 FASE 2: Integración con Operator Pro`);
  console.log(`${'═'.repeat(60)}`);

  const integrationResult = await testOperatorIntegration();

  // Resumen Final
  console.log(`\n${'═'.repeat(60)}`);
  console.log(`🎯 RESUMEN FINAL`);
  console.log(`${'═'.repeat(60)}`);
  
  if (successful.length > 0 && integrationResult.ok) {
    console.log(`
✅ ¡TODO FUNCIONA!

Operator Pro está listo para usar con OpenCode Zen.

Puedes ahora:
1. Ejecutar tareas autónomas: node operator.mjs "tu tarea"
2. Iniciar el servidor: node operator.mjs --server
3. Usar el dashboard web en http://localhost:3000/dashboard

El modelo más potente gratuito es: ${successful[0].model}
`);
  } else {
    console.log(`
⚠️  Algunos tests fallaron. Revisa los errores arriba.

Posibles causas:
- API key inválida o expirada
- Rate limit excedido (espera 1 minuto)
- Modelo no disponible temporalmente

Intenta de nuevo o prueba con otro modelo.
`);
  }
}

main().catch(e => {
  console.error('FATAL:', e);
  process.exit(1);
});
