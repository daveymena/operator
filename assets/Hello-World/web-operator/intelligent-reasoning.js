/**
 * Motor de Razonamiento Inteligente para Web Operator
 * Piensa, Observa, Verifica, Adapta - Como una persona real
 */

import { analyzeWithContext, callBestModel } from './ai-client.js';

export class IntelligentReasoning {
  constructor(operator) {
    this.operator = operator;
    this.taskGoal = null;
    this.currentStrategy = null;
    this.attemptHistory = [];
    this.successCriteria = null;
    this.lastObservation = null;
    this.failureCount = 0;
    this.strategyChanges = 0;
  }

  /**
   * FASE 1: ENTENDER LA TAREA - ¿Qué quiero lograr?
   */
  async understandTask(task) {
    this.operator.log('  [🧠 Pensando] ¿Qué se me pide realmente?');

    const prompt = `Eres un asistente inteligente. Analiza esta tarea y responde:

TAREA: "${task}"

Responde en JSON:
{
  "objetivo": "¿Qué se quiere lograr?",
  "criteriodeexito": "¿Cómo sé que tuve éxito?",
  "pasos": ["paso 1", "paso 2", ...],
  "señalesdeexito": ["señal 1 que indica éxito", "señal 2", ...],
  "señalesdefracaso": ["señal 1 que indica fracaso", "señal 2", ...],
  "estrategiainicial": "¿Cuál es la mejor forma de empezar?"
}`;

    const response = await callBestModel('planning', [
      { role: 'system', content: 'Eres un experto en análisis de tareas y planificación.' },
      { role: 'user', content: prompt }
    ], 1500);

    if (!response) return null;

    try {
      const match = response.match(/\{[\s\S]*\}/);
      if (match) {
        const understanding = JSON.parse(match[0]);
        this.taskGoal = understanding.objetivo;
        this.successCriteria = understanding.señalesdeexito;
        this.currentStrategy = understanding.estrategiainicial;
        
        this.operator.log(`  [🎯 Objetivo] ${this.taskGoal}`);
        this.operator.log(`  [✅ Éxito si veo] ${this.successCriteria?.join(', ')}`);
        
        return understanding;
      }
    } catch (e) {
      this.operator.log(`  [❌ Error] No pude entender la tarea: ${e.message}`);
    }

    return null;
  }

  /**
   * FASE 2: OBSERVAR - ¿Qué veo en la pantalla AHORA?
   */
  async observe(screenshot, pageInfo) {
    this.operator.log('  [👁️ Observando] ¿Qué hay en la pantalla?');

    const prompt = `Observa esta pantalla y describe lo que ves:

URL: ${pageInfo.url}
Título: ${pageInfo.title}

Responde en JSON:
{
  "que_veo": "Descripción de lo que hay en la pantalla",
  "elementos_importantes": ["elemento 1", "elemento 2", ...],
  "estado_actual": "¿En qué parte del proceso estoy?",
  "obstaculos": ["obstáculo 1 si hay", "obstáculo 2", ...],
  "oportunidades": ["¿Qué puedo hacer desde aquí?", ...]
}`;

    const response = await analyzeWithContext(screenshot, prompt);

    if (!response) return null;

    try {
      const match = response.match(/\{[\s\S]*\}/);
      if (match) {
        const observation = JSON.parse(match[0]);
        this.lastObservation = observation;
        
        this.operator.log(`  [📍 Estado] ${observation.estado_actual}`);
        if (observation.obstaculos?.length) {
          this.operator.log(`  [⚠️ Obstáculos] ${observation.obstaculos.join(', ')}`);
        }
        
        return observation;
      }
    } catch (e) {
      this.operator.log(`  [❌ Error] No pude observar: ${e.message}`);
    }

    return null;
  }

  /**
   * FASE 3: DECIDIR - ¿Qué debo hacer AHORA para acercarme al objetivo?
   */
  async decide(observation, taskUnderstanding, history) {
    this.operator.log('  [🤔 Decidiendo] ¿Cuál es la MEJOR acción ahora?');

    const recentHistory = history.slice(-5).map(h => 
      `${h.action.type} ${h.action.target || ''} → ${h.result?.success ? '✓' : '✗'}`
    ).join('\n');

    const prompt = `Eres un agente inteligente. Decide la MEJOR acción ahora.

OBJETIVO: ${this.taskGoal}
ESTRATEGIA ACTUAL: ${this.currentStrategy}
ESTADO ACTUAL: ${observation.estado_actual}
QUE VEO: ${observation.que_veo}

HISTORIAL RECIENTE:
${recentHistory || 'Primera acción'}

CRITERIOS DE ÉXITO: ${this.successCriteria?.join(', ')}

Pregúntate:
1. ¿Ya logré el objetivo? → Si SÍ: TASK_COMPLETE
2. ¿Estoy progresando? → Si NO: cambiar estrategia
3. ¿Qué acción me acerca MÁS al objetivo?
4. ¿Esta acción ya la intenté antes sin éxito? → Buscar alternativa

Responde en JSON:
{
  "razonamiento": "¿Por qué elijo esta acción?",
  "progreso": "¿Estoy avanzando? (si/no/atascado)",
  "decision": "CLICK/TYPE/WAIT/SCROLL/NAVIGATE/TASK_COMPLETE/CAMBIAR_ESTRATEGIA",
  "accion": {
    "type": "...",
    "target": "...",
    "value": "..."
  },
  "confianza": "alta/media/baja",
  "plan_b": "Si esto falla, ¿qué hago?"
}`;

    const response = await callBestModel('fast', [
      { role: 'system', content: 'Eres un agente que PIENSA antes de actuar. NUNCA repites lo que ya falló.' },
      { role: 'user', content: prompt }
    ], 1500);

    if (!response) return null;

    try {
      const match = response.match(/\{[\s\S]*\}/);
      if (match) {
        const decision = JSON.parse(match[0]);
        
        this.operator.log(`  [💡 Razonamiento] ${decision.razonamiento}`);
        this.operator.log(`  [📊 Progreso] ${decision.progreso}`);
        this.operator.log(`  [🎲 Confianza] ${decision.confianza}`);
        
        // Si dice que está atascado, cambiar estrategia
        if (decision.progreso === 'atascado' || decision.progreso === 'no') {
          this.operator.log(`  [🔄 ATASCADO] Necesito cambiar de enfoque`);
          return await this.changeStrategy(observation, history);
        }
        
        return decision;
      }
    } catch (e) {
      this.operator.log(`  [❌ Error] No pude decidir: ${e.message}`);
    }

    return null;
  }

  /**
   * FASE 4: VERIFICAR - ¿Funcionó lo que hice?
   */
  async verify(actionTaken, screenshotBefore, screenshotAfter, pageInfoBefore, pageInfoAfter) {
    this.operator.log('  [🔍 Verificando] ¿Funcionó lo que hice?');

    const prompt = `Compara el ANTES y DESPUÉS de la acción:

ACCIÓN REALIZADA: ${actionTaken.type} ${actionTaken.target || actionTaken.value || ''}

ANTES:
- URL: ${pageInfoBefore.url}
- Título: ${pageInfoBefore.title}

DESPUÉS:
- URL: ${pageInfoAfter.url}
- Título: ${pageInfoAfter.title}

OBJETIVO: ${this.taskGoal}

Responde en JSON:
{
  "funciono": true/false,
  "que_cambio": "¿Qué cambió en la pantalla?",
  "progreso_hacia_objetivo": "¿Me acerqué al objetivo? (si/no/igual)",
  "evaluacion": "exito/parcial/fallo",
  "razon": "¿Por qué digo que funcionó o falló?",
  "siguiente_paso": "¿Qué debería hacer ahora?"
}`;

    // Analizar screenshot DESPUÉS
    const response = await analyzeWithContext(screenshotAfter, prompt);

    if (!response) return null;

    try {
      const match = response.match(/\{[\s\S]*\}/);
      if (match) {
        const verification = JSON.parse(match[0]);
        
        const emoji = verification.funciono ? '✅' : '❌';
        this.operator.log(`  [${emoji} Resultado] ${verification.evaluacion}: ${verification.razon}`);
        this.operator.log(`  [📈 Progreso] ${verification.progreso_hacia_objetivo}`);
        
        // Trackear fallos
        if (!verification.funciono || verification.progreso_hacia_objetivo === 'no') {
          this.failureCount++;
          this.operator.log(`  [⚠️ Fallos acumulados] ${this.failureCount}`);
        } else {
          this.failureCount = 0; // Reset si hay éxito
        }
        
        // Si hay muchos fallos, cambiar estrategia
        if (this.failureCount >= 3) {
          this.operator.log(`  [🚨 ALERTA] 3 fallos seguidos, DEBO cambiar de estrategia`);
          verification.cambiar_estrategia = true;
        }
        
        return verification;
      }
    } catch (e) {
      this.operator.log(`  [❌ Error] No pude verificar: ${e.message}`);
    }

    return null;
  }

  /**
   * FASE 5: ADAPTAR - Si algo no funciona, cambiar de enfoque
   */
  async changeStrategy(observation, history) {
    this.operator.log('  [🔄 Adaptando] Cambiando de estrategia...');
    this.strategyChanges++;

    if (this.strategyChanges > 5) {
      this.operator.log(`  [🛑 LÍMITE] Ya cambié de estrategia 5 veces, NO puedo lograr esto`);
      return {
        decision: 'TASK_FAILED',
        accion: { type: 'TASK_FAILED', reason: 'No se pudo completar después de 5 cambios de estrategia' }
      };
    }

    const failedAttempts = this.attemptHistory.slice(-5).map(a => a.strategy).join(', ');

    const prompt = `Necesito cambiar de estrategia porque estoy atascado.

OBJETIVO: ${this.taskGoal}
ESTRATEGIAS QUE YA FALLARON: ${failedAttempts}
ESTADO ACTUAL: ${observation.estado_actual}
QUE VEO: ${observation.que_veo}

¿Qué otra forma COMPLETAMENTE DIFERENTE puedo intentar para lograr el objetivo?

Responde en JSON:
{
  "nueva_estrategia": "Descripción de la nueva estrategia",
  "por_que_diferente": "¿En qué se diferencia de lo anterior?",
  "primera_accion": {
    "type": "...",
    "target": "...",
    "value": "..."
  },
  "puede_funcionar": true/false,
  "razon": "¿Por qué creo que esto funcionará?"
}`;

    const response = await callBestModel('planning', [
      { role: 'system', content: 'Eres creativo y encuentras soluciones alternativas.' },
      { role: 'user', content: prompt }
    ], 2000);

    if (!response) return null;

    try {
      const match = response.match(/\{[\s\S]*\}/);
      if (match) {
        const newStrategy = JSON.parse(match[0]);
        
        this.currentStrategy = newStrategy.nueva_estrategia;
        this.attemptHistory.push({ strategy: this.currentStrategy, timestamp: Date.now() });
        
        this.operator.log(`  [🆕 Nueva Estrategia] ${newStrategy.nueva_estrategia}`);
        this.operator.log(`  [💭 Razón] ${newStrategy.razon}`);
        
        this.failureCount = 0; // Reset porque estamos intentando algo nuevo
        
        return {
          decision: newStrategy.primera_accion.type,
          accion: newStrategy.primera_accion,
          razonamiento: `Nueva estrategia: ${newStrategy.nueva_estrategia}`,
          confianza: newStrategy.puede_funcionar ? 'media' : 'baja'
        };
      }
    } catch (e) {
      this.operator.log(`  [❌ Error] No pude crear nueva estrategia: ${e.message}`);
    }

    return null;
  }

  /**
   * FASE 6: EVALUAR ÉXITO FINAL - ¿Ya terminé?
   */
  async evaluateSuccess(screenshot, pageInfo) {
    this.operator.log('  [🎯 Evaluando] ¿Ya logré el objetivo?');

    const prompt = `Evalúa si se cumplió el objetivo:

OBJETIVO: ${this.taskGoal}
CRITERIOS DE ÉXITO: ${this.successCriteria?.join(', ')}

URL ACTUAL: ${pageInfo.url}
TÍTULO: ${pageInfo.title}

Observa la pantalla y responde:
{
  "objetivo_cumplido": true/false,
  "razon": "¿Por qué digo que sí o no?",
  "porcentaje_completado": 0-100,
  "que_falta": "Si no está completo, ¿qué falta?"
}`;

    const response = await analyzeWithContext(screenshot, prompt);

    if (!response) return null;

    try {
      const match = response.match(/\{[\s\S]*\}/);
      if (match) {
        const evaluation = JSON.parse(match[0]);
        
        this.operator.log(`  [📊 Completado] ${evaluation.porcentaje_completado}%`);
        this.operator.log(`  [📝 Razón] ${evaluation.razon}`);
        
        return evaluation;
      }
    } catch (e) {
      this.operator.log(`  [❌ Error] No pude evaluar éxito: ${e.message}`);
    }

    return null;
  }
}

export default IntelligentReasoning;
