import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';
import axios from 'axios';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const HERMES_CORE = path.resolve(__dirname, '..', '..', 'hermes-core');
const HERMES_CLI = path.join(HERMES_CORE, 'cli.py');
const HERMES_VENV = path.join(HERMES_CORE, '.venv', 'Scripts', 'python.exe');
const HERMES_VENV_ALT = path.join(HERMES_CORE, 'venv', 'Scripts', 'python.exe');
const PYTHON = fs.existsSync(HERMES_VENV) ? HERMES_VENV : fs.existsSync(HERMES_VENV_ALT) ? HERMES_VENV_ALT : 'python';

const ALL_PROVIDERS = [
  { id: 'opencode-zen', name: 'OpenCode Zen', url: 'https://opencode.ai/zen/v1', key: 'OPENCODE_ZEN_API_KEY', models: ['kimi-k2.5','gpt-5.4-pro','gpt-5.4','gpt-5.3-codex','claude-opus-4-6','claude-sonnet-4-6','gemini-3.1-pro','gemini-3-pro','gemini-3-flash','minimax-m2.7','minimax-m2.5','glm-5','glm-4.7','kimi-k2-thinking','big-pickle'] },
  { id: 'opencode-go', name: 'OpenCode Go', url: 'https://opencode.ai/zen/go/v1', key: 'OPENCODE_GO_API_KEY', models: ['kimi-k2.6','kimi-k2.5','glm-5.1','glm-5','mimo-v2.5-pro','mimo-v2.5','minimax-m2.7','minimax-m2.5','qwen3.6-plus','qwen3.5-plus'] },
  { id: 'nous', name: 'Nous Portal', url: 'https://inference-api.nousresearch.com/v1', auth: 'oauth', models: ['kimi-k2.6','xiaomi/mimo-v2.5-pro','tencent/hy3-preview','claude-opus-4.7','claude-sonnet-4.6','gpt-5.5','gpt-5.4-mini','gemini-3-pro-preview','gemini-3-flash-preview','qwen3.5-plus','step-3.5-flash','minimax-m2.7','glm-5.1','grok-4.20-beta','nemotron-3-super'] },
  { id: 'copilot', name: 'GitHub Copilot', url: 'https://api.githubcopilot.com', key: 'GITHUB_COPILOT_TOKEN', models: ['gpt-5.4','gpt-5.4-mini','gpt-5-mini','gpt-5.3-codex','gpt-4.1','gpt-4o','claude-sonnet-4.6','claude-sonnet-4','claude-haiku-4.5','gemini-3.1-pro-preview','gemini-3-pro-preview','gemini-3-flash-preview','gemini-2.5-pro'] },
  { id: 'nvidia', name: 'NVIDIA NIM', url: 'https://integrate.api.nvidia.com/v1', key: 'NVIDIA_API_KEY', models: ['nemotron-3-super-120b','nemotron-3-nano','llama-3.3-nemotron','qwen3.5-397b','deepseek-v3.2','kimi-k2.6','minimax-m2.5','glm5','gpt-oss-120b'] },
  { id: 'gemini', name: 'Google AI Studio', url: 'https://generativelanguage.googleapis.com/v1beta', key: 'GOOGLE_API_KEY', models: ['gemini-3.1-pro-preview','gemini-3-pro-preview','gemini-3-flash-preview','gemini-3.1-flash-lite-preview'] },
  { id: 'deepseek', name: 'DeepSeek', url: 'https://api.deepseek.com/v1', key: 'DEEPSEEK_API_KEY', models: ['deepseek-v4-pro','deepseek-v4-flash','deepseek-chat','deepseek-reasoner'] },
  { id: 'anthropic', name: 'Anthropic', url: 'https://api.anthropic.com', key: 'ANTHROPIC_API_KEY', models: ['claude-opus-4-7','claude-opus-4-6','claude-sonnet-4-6','claude-sonnet-4-5','claude-haiku-4-5'] },
  { id: 'openai', name: 'OpenAI', url: 'https://api.openai.com/v1', key: 'OPENAI_API_KEY', models: ['gpt-5.4','gpt-5.4-mini','gpt-5-mini','gpt-5.3-codex','gpt-4.1','gpt-4o','gpt-4o-mini'] },
  { id: 'zai', name: 'Z.AI / GLM', url: 'https://api.z.ai/api/paas/v4', key: 'GLM_API_KEY', models: ['glm-5.1','glm-5','glm-5v-turbo','glm-5-turbo','glm-4.7','glm-4.5','glm-4.5-flash'] },
  { id: 'kimi', name: 'Kimi / Moonshot', url: 'https://api.moonshot.ai/v1', key: 'KIMI_API_KEY', models: ['kimi-k2.6','kimi-k2.5','kimi-k2-thinking','kimi-k2-thinking-turbo'] },
  { id: 'xiaomi', name: 'Xiaomi MiMo', url: 'https://api.xiaomimimo.com/v1', key: 'XIAOMI_API_KEY', models: ['mimo-v2.5-pro','mimo-v2.5','mimo-v2-pro','mimo-v2-omni','mimo-v2-flash'] },
  { id: 'minimax', name: 'MiniMax', url: 'https://api.minimax.io/anthropic', key: 'MINIMAX_API_KEY', models: ['MiniMax-M2.7','MiniMax-M2.5','MiniMax-M2.1','MiniMax-M2'] },
  { id: 'huggingface', name: 'Hugging Face', url: 'https://router.huggingface.co/v1', key: 'HF_TOKEN', models: ['Kimi-K2.5','Qwen3.5-397B','DeepSeek-V3.2','MiniMax-M2.5','GLM-5','MiMo-V2-Flash','Kimi-K2.6'] },
  { id: 'xai', name: 'xAI', url: 'https://api.x.ai/v1', key: 'XAI_API_KEY', models: ['grok-4.20-beta','grok-3','grok-3-mini'] },
  { id: 'alibaba', name: 'Alibaba DashScope', url: 'https://dashscope-intl.aliyuncs.com/compatible-mode/v1', key: 'DASHSCOPE_API_KEY', models: ['qwen3.6-plus','kimi-k2.5','qwen3.5-plus','qwen3-coder-plus','glm-5','glm-4.7','MiniMax-M2.5'] },
  { id: 'arcee', name: 'Arcee AI', url: 'https://api.arcee.ai/api/v1', key: 'ARCEEAI_API_KEY', models: ['trinity-large-thinking','trinity-large-preview','trinity-mini'] },
  { id: 'stepfun', name: 'StepFun', url: 'https://api.stepfun.ai/step_plan/v1', key: 'STEPFUN_API_KEY', models: ['step-3.5-flash','step-3.5-flash-2603'] },
  { id: 'freemodel', name: 'FreeModel.dev', url: 'https://api.freemodel.dev/v1', key: 'FREEMODEL_API_KEY', models: ['gpt-4o','claude-sonnet','gemini-pro'] },
  { id: 'gmi', name: 'GMI Cloud', url: 'https://api.gmi-serving.com/v1', key: 'GMI_API_KEY', models: ['GLM-5.1','DeepSeek-V3.2','Kimi-K2.5','gemini-3.1-flash-lite','claude-sonnet-4.6','gpt-5.4'] },
  { id: 'ollama-cloud', name: 'Ollama Cloud', url: 'https://ollama.com/v1', key: 'OLLAMA_API_KEY', models: ['llama-4','llama-3.3','deepseek-v3','qwen3','mistral'] },
  { id: 'lmstudio', name: 'LM Studio', url: 'http://127.0.0.1:1234/v1', local: true, models: ['local-models'] },
  { id: 'opencode-engine', name: 'OpenCode Engine', url: 'http://localhost:21294/v1', local: true, models: ['deepseek-v4-flash','big-pickle','nemotron','hy3'] },
];

const NVIDIA_KEY = process.env.NVIDIA_API_KEY || '';
const NVIDIA_URL = process.env.NVIDIA_BASE_URL || 'https://integrate.api.nvidia.com/v1';

export class Brain {
  constructor(config = {}) {
    this.backend = config.backend || 'auto';
    this.groqKey = config.groqKey || process.env.GROQ_API_KEY || '';
    this.opencodeUrl = config.opencodeUrl || 'http://localhost:21294';
    this.nvidiaKey = NVIDIA_KEY;
    this.nvidiaUrl = NVIDIA_URL;
    this.model = config.model || 'nvidia/nemotron-3-super-120b-a12b';
    this.nvidiaModel = 'nvidia/nemotron-3-super-120b-a12b';
    this.visionModel = config.visionModel || 'llama-3.2-90b-vision-preview';
    this.bridge = config.bridge || null;
    this.verbose = config.verbose !== false;
    this.plan = null;
    this.planStepIndex = 0;
    this.goal = '';
    this.failedActions = 0;
    this.consecutiveFailures = 0;
    this._activeBackend = null;
    this._backendFailCount = 0;
    this._backendCache = new Map();
    this._backendPriority = ['opencodeGo', 'opencodeZen', 'groq', 'copilot', 'freemodel', 'nvidia', 'hermes', 'opencode', 'bridge', 'local'];
  }

  setPlan(plan) {
    this.plan = plan;
    this.planStepIndex = 0;
    this.failedActions = 0;
    this.consecutiveFailures = 0;
  }

  async createPlan(task, knowledge) {
    const planPrompt = `Eres un planificador meticuloso. Tu tarea: "${task}"

${knowledge ? 'CONTEXTO:\n' + knowledge.substring(0, 4000) + '\n' : ''}

Antes de ejecutar cualquier acción, debes crear un PLAN DETALLADO paso a paso.

IMPORTANTE: NO ejecutes nada aún. Solo PLANIFICA.

Reglas:
1. Analiza qué se necesita lograr exactamente
2. Divide en pasos lógicos y secuenciales
3. Cada paso debe tener: objetivo, acción esperada, criterio de éxito
4. Estima cuántos pasos tomará
5. Identifica posibles problemas o dependencias

Responde SOLO con JSON:
{
  "goal": "descripción clara del objetivo final",
  "steps": [
    { "step": 1, "goal": "qué se logra aquí", "action": "acción esperada", "success_criteria": "cómo sé que funcionó" }
  ],
  "total_steps": 3,
  "warnings": ["posibles problemas"]
}`;

    const backends = this.backend === 'auto'
      ? ['opencodeZen', 'copilot', 'groq', 'opencodeGo', 'freemodel', 'nvidia', 'hermes', 'opencode', 'bridge']
      : [this.backend];

    for (const backend of backends) {
      try {
        const result = await this[`_${backend}`](planPrompt);
        if (result && result.goal && Array.isArray(result.steps)) {
          this.plan = result;
          this.goal = result.goal;
          this.planStepIndex = 0;
          return result;
        }
        if (result && result.goal) {
          this.plan = result;
          this.goal = result.goal;
          this.planStepIndex = 0;
          return result;
        }
      } catch {}
    }
    this.plan = { goal: task, steps: [{ step: 1, goal: task, action: 'analizar', success_criteria: 'ninguno' }], total_steps: 1, warnings: [] };
    this.goal = task;
    return this.plan;
  }

  async think(task, state, knowledge, history = []) {
    const currentGoal = this.plan?.steps?.[this.planStepIndex];
    const planProgress = this.plan
      ? `PLAN: "${this.plan.goal}"\nPaso actual: ${this.planStepIndex + 1}/${this.plan.total_steps}\nObjetivo del paso: ${currentGoal?.goal || 'completar tarea'}\nCriterio de éxito: ${currentGoal?.success_criteria || 'ninguno'}\n`
      : '';

    const prompt = this._buildPrompt(task, state, knowledge, history, planProgress);

    const taskType = this._detectTaskType(task);

    let backends;
    if (this.backend !== 'auto') {
      backends = [this.backend];
    } else if (this._activeBackend && this._backendFailCount < 2) {
      backends = [this._activeBackend, ...this._backendPriority.filter(b => b !== this._activeBackend)];
    } else if (taskType === 'testing' || taskType === 'facebook') {
      backends = ['opencodeGo', 'opencodeZen', 'groq', 'copilot', 'freemodel', 'nvidia', 'hermes', 'opencode', 'bridge', 'local'];
    } else if (this.consecutiveFailures > 0) {
      backends = ['opencodeGo', 'opencodeZen', 'groq', 'copilot', 'freemodel', 'nvidia', 'hermes', 'opencode', 'bridge', 'local'];
    } else {
      backends = this._backendPriority;
    }

    let lastError = '';
    for (const backend of backends) {
      try {
        const cached = this._backendCache.get(backend);
        if (cached && cached.error === 'rate_limit') continue;
        const result = await this[`_${backend}`](prompt);
        if (result) {
          this._activeBackend = backend;
          this._backendFailCount = 0;
          this._backendCache.set(backend, { ok: true, at: Date.now() });
          result._planStep = this.planStepIndex;
          result._goal = currentGoal?.goal || '';
          result._backend = backend;
          return result;
        }
      } catch (e) {
        lastError = e.message;
        if (this.verbose) console.log(`  ⚠️ Brain[${backend}]: ${e.message || 'returned null'}`);
        this._backendFailCount++;
        this._backendCache.set(backend, { error: 'failed', at: Date.now() });
        if (backend === this._activeBackend) {
          this._activeBackend = null;
        }
      }
    }
    return this._fallback(task, state, lastError);
  }

  async verify(action, result, stateBefore, stateAfter) {
    const verifyPrompt = `Verifica si la acción fue exitosa.

ACCIÓN EJECUTADA: ${JSON.stringify(action)}
RESULTADO: ${result?.ok ? '✅ Éxito' : '❌ Fallo'}${result?.error ? ' - ' + result.error : ''}
ESTADO ANTERIOR: ${stateBefore?.substring(0, 1000) || 'desconocido'}
ESTADO ACTUAL: ${stateAfter?.substring(0, 1000) || 'desconocido'}

¿La acción logró su objetivo? Responde SOLO con JSON:
{
  "verified": true/false,
  "reason": "por qué",
  "action_needed": "siguiente acción si falló (retry, skip, alternative)",
  "advance_plan": true/false
}`;

    const backends = ['opencodeGo', 'opencodeZen', 'groq', 'copilot', 'nvidia'];
    for (const backend of backends) {
      try {
        const result = await this[`_${backend}`](verifyPrompt);
        if (result && result.verified !== undefined) {
          return result;
        }
      } catch {}
    }
    return { verified: result?.ok || false, reason: result?.ok ? 'acción completada' : (result?.error || 'error desconocido'), action_needed: result?.ok ? 'continue' : 'retry', advance_plan: result?.ok };
  }

  advancePlan() {
    if (this.plan && this.planStepIndex < (this.plan.total_steps || this.plan.steps.length) - 1) {
      this.planStepIndex++;
      this.consecutiveFailures = 0;
      return { advanced: true, currentStep: this.planStepIndex + 1, totalSteps: this.plan.total_steps };
    }
    return { advanced: false, done: true };
  }

  async describeImage(base64) {
    if (!base64) return 'Sin imagen disponible';
    if (this.backend === 'local') {
      return `[Screenshot de ${Math.round(base64.length / 1024)}KB - análisis local no disponible]`;
    }
    for (const fn of [() => this._nvidiaVision(base64), () => this._groqVision(base64)]) {
      try { const r = await fn(); if (r) return r; } catch {}
    }
    return `[Análisis visual no disponible - screenshot de ${Math.round(base64.length / 1024)}KB]`;
  }

  async _nvidiaVision(base64) {
    const visionModels = [
      'deepseek-ai/deepseek-v4-flash',
      'nvidia/llama-3.2-90b-vision-preview',
      'nvidia/neva-22b'
    ];
    for (const model of visionModels) {
      try {
        const res = await axios.post(`${this.nvidiaUrl}/chat/completions`, {
          model,
          messages: [{
            role: 'user',
            content: `Describe EXACTAMENTE lo que ves en esta captura de pantalla. Incluye: URL del navegador si visible, botones, textos, campos de formulario, menús, y cualquier elemento interactivo.`
          }],
          temperature: 0.1,
          max_tokens: 1024
        }, {
          headers: { 'Authorization': `Bearer ${this.nvidiaKey}`, 'Content-Type': 'application/json' },
          timeout: 30000
        });
        const result = res.data?.choices?.[0]?.message?.content;
        if (result) return result;
      } catch { continue; }
    }
    return null;
  }

  async _nvidia(prompt) {
    const promptShort = prompt.length > 4000 ? prompt.substring(0, 4000) + '\n...[truncado]' : prompt;
    const models = [
      'nvidia/llama-3.3-nemotron-super-49b-v1',
      'nvidia/nemotron-3-super-120b-a12b',
      'deepseek-ai/deepseek-v4-flash',
      'meta/llama-3.1-8b-instruct'
    ];
    for (const model of models) {
      try {
        const res = await axios.post(`${this.nvidiaUrl}/chat/completions`, {
          model,
          messages: [
            { role: 'system', content: 'Eres un operador de PC. Responde SOLO con JSON. Formato: {"thought":"...","action":{"type":"comando","params":{}},"done":false,"reason":"..."}. COMANDOS: screenshot, browser_goto, browser_click, browser_type, powershell, keyboard_type, open_url, wait, done' },
            { role: 'user', content: promptShort }
          ],
          temperature: 0.2,
          max_tokens: 500
        }, {
          headers: { 'Authorization': `Bearer ${this.nvidiaKey}`, 'Content-Type': 'application/json' },
          timeout: 15000
        });
        if (!res.data?.choices?.[0]?.message?.content) continue;
        const parsed = this._parseJSON(res.data.choices[0].message.content);
        if (parsed) return parsed;
      } catch (e) {
        if (this.verbose) console.log(`  ⚠️ NVIDIA[${model}]: ${e.response?.status || e.message}`);
        continue;
      }
    }
    return null;
  }

  async _copilot(prompt) {
    const cpToken = process.env.GITHUB_COPILOT_TOKEN;
    if (!cpToken || cpToken.length < 20) return null;
    try {
      const { default: axios } = await import('axios');
      const res = await axios.post('https://api.githubcopilot.com/chat/completions', {
        model: 'gpt-4o',
        messages: [
          { role: 'system', content: 'Eres un operador autonomo de PC. Responde SOLO con JSON exactamente este formato: {"thought":"razonamiento","action":{"type":"COMANDO","params":{}},"done":false,"reason":"por que"}. COMANDOS: screenshot, powershell, keyboard_type, keyboard_press, open_url, read_file, write_file, list_dir, browser_goto, browser_click, browser_type, wait, done' },
          { role: 'user', content: prompt.length > 6000 ? prompt.substring(0, 6000) + '\n...[truncado]' : prompt }
        ],
        temperature: 0.2,
        max_tokens: 500
      }, {
        headers: {
          'Authorization': `Bearer ${cpToken}`,
          'Content-Type': 'application/json',
          'Editor-Version': 'vscode/1.96.0',
          'Editor-Plugin-Version': 'copilot/1.250.0',
          'Openai-Organization': 'github-copilot',
          'Copilot-Integration-Id': 'vscode-chat'
        },
        timeout: 20000
      });
      if (!res.data?.choices?.[0]?.message?.content) return null;
      return this._parseJSON(res.data.choices[0].message.content);
    } catch (e) {
      if (this.verbose) console.log(`  ⚠️ Copilot error: ${e.response?.status || e.message}`);
      return null;
    }
  }

  async _opencode(prompt) {
    return this._opencodeGo(prompt);
  }

  async _opencodeGo(prompt) {
    const goKey = process.env.OPENCODE_GO_API_KEY;
    if (!goKey || goKey.length < 10) return null;
    try {
      const { default: axios } = await import('axios');
      const res = await axios.post('https://opencode.ai/zen/go/v1/chat/completions', {
        model: 'kimi-k2.6',
        messages: [
          { role: 'system', content: 'Eres un operador autonomo de PC. IMPORTANTE: Responde UNICAMENTE con el JSON solicitado. No expliques nada, no añadas texto, solo el JSON.' },
          { role: 'user', content: prompt.length > 6000 ? prompt.substring(0, 6000) + '\n...[truncado]' : prompt }
        ],
        temperature: 0.1,
        max_tokens: 800
      }, {
        headers: { 'Authorization': `Bearer ${goKey}`, 'Content-Type': 'application/json' },
        timeout: 20000
      });
      if (!res.data?.choices?.[0]?.message?.content) return null;
      const content = res.data.choices[0].message.content;
      const parsed = this._parseJSON(content);
      if (parsed) return parsed;
      const jsonMatch = content.match(/\{[\s\S]*"thought"[\s\S]*"action"[\s\S]*\}/);
      if (jsonMatch) return this._parseJSON(jsonMatch[0]);
      const anyJson = content.match(/\{[\s\S]*\}/);
      if (anyJson) return this._parseJSON(anyJson[0]);
      return null;
    } catch (e) {
      if (this.verbose) console.log(`  ⚠️ OpenCodeZen error: ${e.response?.status || e.message}`);
      return null;
    }
  }

  async _opencodeZen(prompt) {
    const zenKey = process.env.OPENCODE_ZEN_API_KEY || process.env.OPENCODE_API_KEY;
    if (!zenKey || zenKey.length < 10) return null;
    const zenModel = process.env.OPENCODE_ZEN_MODEL || 'deepseek-v4-flash-free';
    try {
      const { default: axios } = await import('axios');
      const res = await axios.post('https://opencode.ai/zen/v1/chat/completions', {
        model: zenModel,
        messages: [
          { role: 'system', content: 'Eres un operador autonomo de PC. Responde SOLO con JSON. Formato: {"thought":"razonamiento","action":{"type":"COMANDO","params":{}},"done":false,"reason":"por que"}. COMANDOS: screenshot, browser_goto, browser_click, browser_type, browser_evaluate, powershell, keyboard_type, open_url, read_file, write_file, list_dir, wait, done' },
          { role: 'user', content: prompt.length > 6000 ? prompt.substring(0, 6000) + '\n...[truncado]' : prompt }
        ],
        temperature: 0.2,
        max_tokens: 800
      }, {
        headers: { 'Authorization': `Bearer ${zenKey}`, 'Content-Type': 'application/json' },
        timeout: 20000
      });
      if (!res.data?.choices?.[0]?.message?.content) return null;
      const content = res.data.choices[0].message.content;
      const parsed = this._parseJSON(content);
      if (parsed) return parsed;
      const jsonMatch = content.match(/\{[\s\S]*"thought"[\s\S]*"action"[\s\S]*\}/);
      if (jsonMatch) return this._parseJSON(jsonMatch[0]);
      const anyJson = content.match(/\{[\s\S]*\}/);
      if (anyJson) return this._parseJSON(anyJson[0]);
      return null;
    } catch (e) {
      if (this.verbose) console.log(`  ⚠️ OpenCodeZen error: ${e.message}`);
      return null;
    }
  }

  async _freemodel(prompt) {
    const fmKey = process.env.FREEMODEL_API_KEY;
    if (!fmKey || fmKey.length < 10) return null;
    const fmUrl = process.env.FREEMODEL_BASE_URL || 'https://api.freemodel.dev/v1';
    const fmModel = process.env.FREEMODEL_MODEL || 'gpt-4o';
    try {
      const { default: axios } = await import('axios');
      const res = await axios.post(`${fmUrl}/chat/completions`, {
        model: fmModel,
        messages: [
          { role: 'system', content: 'Eres un operador autonomo de PC. Responde SOLO con JSON. Formato: {"thought":"razonamiento","action":{"type":"COMANDO","params":{}},"done":false,"reason":"por que"}. COMANDOS: screenshot, browser_goto, browser_click, browser_type, browser_evaluate, powershell, keyboard_type, open_url, read_file, write_file, list_dir, wait, done' },
          { role: 'user', content: prompt.length > 6000 ? prompt.substring(0, 6000) + '\n...[truncado]' : prompt }
        ],
        temperature: 0.2,
        max_tokens: 800
      }, {
        headers: { 'Authorization': `Bearer ${fmKey}`, 'Content-Type': 'application/json' },
        timeout: 25000
      });
      if (!res.data?.choices?.[0]?.message?.content) return null;
      const content = res.data.choices[0].message.content;
      const parsed = this._parseJSON(content);
      if (parsed) return parsed;
      const jsonMatch = content.match(/\{[\s\S]*"thought"[\s\S]*"action"[\s\S]*\}/);
      if (jsonMatch) return this._parseJSON(jsonMatch[0]);
      const anyJson = content.match(/\{[\s\S]*\}/);
      if (anyJson) return this._parseJSON(anyJson[0]);
      return null;
    } catch (e) {
      if (this.verbose) console.log(`  ⚠️ FreeModel error: ${e.message}`);
      return null;
    }
  }

  async _hermes(prompt) {
    if (!fs.existsSync(HERMES_CLI)) return null;
    try {
      const result = execSync(
        `"${PYTHON}" "${HERMES_CLI}" --json --prompt "${prompt.replace(/"/g, '\\"').replace(/\n/g, '\\n').substring(0, 3000)}"`,
        { timeout: 30000, encoding: 'utf8', maxBuffer: 1024 * 1024, windowsHide: true }
      );
      const lines = result.split('\n').filter(l => l.trim().startsWith('{') || l.trim().startsWith('['));
      for (const line of lines) {
        try { return this._parseJSON(line); } catch {}
      }
      return null;
    } catch { return null; }
  }

  async _opencode(prompt) {
    try {
      const res = await fetch(`${this.opencodeUrl}/v1/chat/completions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: this.model,
          messages: [
            { role: 'system', content: 'Eres un operador autónomo de PC. Responde SOLO con JSON.' },
            { role: 'user', content: prompt }
          ],
          temperature: 0.2,
          max_tokens: 1024
        }),
        signal: AbortSignal.timeout(20000)
      });
      if (!res.ok) return null;
      const data = await res.json();
      return this._parseJSON(data.choices?.[0]?.message?.content || '');
    } catch { return null; }
  }

  async _groq(prompt) {
    if (!this.groqKey || this.groqKey === 'tu_api_key_de_groq_aqui') return null;
    const groqModel = process.env.GROQ_MODEL || 'llama-3.1-8b-instant';
    try {
      const res = await axios.post('https://api.groq.com/openai/v1/chat/completions', {
        model: groqModel,
        messages: [
          { role: 'system', content: 'Eres un operador autónomo de PC. Responde SOLO con JSON. Formato: {"thought":"razonamiento","action":{"type":"COMANDO","params":{}},"done":false,"reason":"por que"}. COMANDOS: screenshot, powershell, keyboard_type, keyboard_press, open_url, read_file, write_file, list_dir, browser_goto, browser_click, browser_type, wait, done' },
          { role: 'user', content: prompt.length > 4000 ? prompt.substring(0, 4000) + '\n...[truncado]' : prompt }
        ],
        temperature: 0.2,
        max_tokens: 500,
        response_format: { type: 'json_object' }
      }, {
        headers: { Authorization: `Bearer ${this.groqKey}`, 'Content-Type': 'application/json' },
        timeout: 20000
      });
      return this._parseJSON(res.data.choices[0].message.content);
    } catch (e) {
      if (this.verbose) console.log(`  ⚠️ Groq error: ${e.response?.status || e.message}`);
      return null;
    }
  }

  async _groqVision(base64) {
    if (!this.groqKey || this.groqKey === 'tu_api_key_de_groq_aqui') return null;
    const res = await axios.post('https://api.groq.com/openai/v1/chat/completions', {
      model: 'llama-3.2-90b-vision-preview',
      messages: [{
        role: 'user',
        content: [
          { type: 'text', text: 'Describe exactamente lo que ves. URL, botones, textos, campos, elementos interactivos.' },
          { type: 'image_url', image_url: { url: `data:image/png;base64,${base64}`, detail: 'high' } }
        ]
      }],
      temperature: 0.1, max_tokens: 1024
    }, {
      headers: { Authorization: `Bearer ${this.groqKey}`, 'Content-Type': 'application/json' },
      timeout: 30000
    });
    return res.data.choices[0].message.content;
  }

  async _bridge(prompt) {
    if (!this.bridge) return null;
    const result = await this.bridge.execute({
      type: 'powershell',
      params: {
        script: `curl.exe -s -X POST ${this.opencodeUrl}/v1/chat/completions -H "Content-Type: application/json" -d '${JSON.stringify({
          model: this.model,
          messages: [
            { role: 'system', content: 'Operador autónomo PC. JSON only.' },
            { role: 'user', content: prompt }
          ],
          temperature: 0.2
        }).replace(/'/g, "''")}'`
      }
    });
    if (!result.ok) return null;
    try { return this._parseJSON(JSON.parse(result.output)?.choices?.[0]?.message?.content); } catch {}
    return null;
  }

  async _local(prompt) {
    return {
      thought: 'No hay modelos de IA disponibles. No puedo operar sin razonamiento.',
      action: { type: 'done', params: { message: 'sin IA' } },
      done: true,
      reason: 'Modo local desactivado - se requiere IA para operar con razonamiento',
      _backend: 'local'
    };
  }

  _fallback(task, state, error) {
    const taskType = this._detectTaskType(task);
    if (taskType === 'facebook' || taskType === 'testing') {
      return {
        thought: `BACKEND CAÍDO (${error}). Pero como la tarea es ejecutar un script existente, lo haré directamente.`,
        action: { type: 'powershell', params: { script: `node "C:\\Users\\ADMIN\\Music\\proyecto-unificado\\master.mjs" status` } },
        done: false, reason: 'fallback a comando directo del proyecto', _backend: 'fallback'
      };
    }
    return {
      thought: `ERROR: Ningún modelo de IA disponible (${error}). No puedo continuar sin un backend de IA.`,
      action: { type: 'done', params: { message: 'sin modelos de IA disponibles' } },
      done: true, reason: 'sin modelos de IA disponibles - no se puede operar sin razonamiento', _backend: 'fallback'
    };
  }

  _buildPrompt(task, state, knowledge, history, planProgress = '') {
    const lastActions = history.slice(-6).map(h =>
      `  Paso ${h.step}: 🤔 ${h.thought}\n  🎬 ${h.action}\n  📊 ${h.result}`
    ).join('\n');

    const taskType = this._detectTaskType(task);
    const taskHints = this._getTaskTypeHints(taskType);
    let backendInfo = `Backend activo: ${this._activeBackend || 'buscando...'}`;
    if (this._backendFailCount > 0) backendInfo += ` (fallos seguidos: ${this._backendFailCount})`;
    if (this._backendCache.size > 0) {
      const working = [...this._backendCache.entries()].filter(([,v]) => v.ok).map(([k]) => k);
      if (working.length) backendInfo += ` | disponibles: ${working.join(', ')}`;
    }

    return `Eres un OPERADOR AUTÓNOMO DE PC. Tu tarea: "${task}"

${planProgress}

${knowledge ? 'CONOCIMIENTO:\n' + knowledge.substring(0, 4000) + '\n' : ''}

CONTEXTO DEL SISTEMA:
- PC: Windows
- Proyecto: ${path.resolve(__dirname, '..')}
- Sesiones anteriores: ${this._getSessionCount()}
- Tipo de tarea: ${taskType}
- ${backendInfo}

${taskHints}

ESTADO ACTUAL:
${state.description || 'Iniciando...'} | Cursor: ${state.cursor || 'N/A'}

HISTORIAL RECIENTE:
${lastActions || '  (primer paso)'}

INSTRUCCIONES CRÍTICAS:
1. RAZONA antes de actuar — explica QUÉ vas a hacer y POR QUÉ es necesario
2. USA EL CONOCIMIENTO disponible — hay documentación del proyecto, úsala
3. PLANIFICA — cada acción debe acercarte al objetivo, no hagas movimientos al azar
4. VERIFICA — si una acción falla, intenta otra alternativa distinta, NO repitas lo mismo
5. NO hagas acciones sin propósito — cada acción debe tener una razón clara en "thought"
6. Si ves que algo no funciona (mismo estado que antes), cambia de estrategia radicalmente
7. PREFIERE scripts existentes del proyecto antes de hacer acciones manuales

COMANDOS DISPONIBLES (usa SOLO estos):
- screenshot(quality, scale) — captura de pantalla
- mouse_move(x, y) — mover mouse a coordenadas exactas
- mouse_click(button, x, y) — hacer clic (left/right) en coordenadas
- mouse_double_click() — doble clic
- mouse_scroll(clicks) — scroll vertical
- keyboard_type(text) — escribir texto (usa SendKeys)
- keyboard_press(key) — presionar tecla (ENTER, TAB, ESC, BACKSPACE, DELETE, F1-F12, etc.)
- powershell(script) — ejecutar script PowerShell (para node, npm, comandos del sistema)
- open_url(url) — abrir URL en navegador predeterminado
- read_file(path) — leer archivo
- write_file(path, content) — escribir archivo
- list_dir(path) — listar directorio
- sysinfo() — información del sistema (OS, RAM, CPU)
- get_cursor() — posición actual del mouse
- list_windows() — ventanas abiertas con título
- list_apps() — aplicaciones instaladas
- notify(message, title) — notificación en pantalla
- run_script(path, args) — ejecuta un script Node.js del proyecto (ej: "facebook-automation/scripts/ads/crear-campanias-catalogo.mjs")
- browser_goto(url) — navegar en Chrome (requiere debugging en :9222)
- browser_click(text/selector) — hacer clic en elemento por texto o selector CSS
- browser_type(selector, text) — escribir en campo del navegador
- browser_evaluate(code) — ejecutar JavaScript en el navegador
- wait(ms) — esperar milisegundos
- facebook_create_campaign(name, objective, budget, status) — crear campaña en Facebook Ads vía API
- facebook_list_campaigns(adAccount) — listar campañas existentes
- facebook_get_insights(campaignId) — obtener métricas de campañas

REGLAS PARA TAREAS DE FACEBOOK:
- Usa los scripts existentes en facebook-automation/scripts/ en vez de hacer clics manuales
- Para crear campañas: ejecuta el script con powershell o node
- Los tokens están en facebook-automation/tokens/fb_tokens_output.json
- El catálogo está en facebook-automation/tokens/megapack-82-productos.json
- Las creatividades están en facebook-automation/ads/ad-creatives.mjs

Responde SOLO con JSON en este formato EXACTO:
{
  "thought": "RAZONAMIENTO: por qué hago esto, qué espero lograr, cómo verificaré el resultado",
  "action": { "type": "COMANDO", "params": { ... } },
  "done": false,
  "reason": "por qué la tarea está completa (solo si done=true)"
}

NUNCA repitas la misma acción si falló. TRES opciones cuando algo falla:
1. Prueba un enfoque diferente (otro comando)
2. Lee un archivo relevante para entender qué hacer
3. Cambia de estrategia completamente
NO hagas loops infinitos. Si algo falla 3 veces seguidas, reporta el error y termina.`;
  }

  _detectTaskType(task) {
    const t = task.toLowerCase();
    if (t.includes('facebo') || t.includes('ads') || t.includes('campaña') || t.includes('anuncio') || t.includes('publicidad') || t.includes('marketing') || t.includes('ventaspro')) return 'facebook';
    if (t.includes('instagram') || t.includes('reels') || t.includes('social')) return 'social_media';
    if (t.includes('whatsapp') || t.includes('mensaje') || t.includes('chat')) return 'messaging';
    if (t.includes('archivo') || t.includes('file') || t.includes('lectura') || t.includes('leer') || t.includes('escribir') || t.includes('crear') || t.includes('carpeta') || t.includes('folder') || t.includes('directorio')) return 'filesystem';
    if (t.includes('navegador') || t.includes('browser') || t.includes('chrome') || t.includes('url') || t.includes('web') || t.includes('internet') || t.includes('pagina')) return 'browsing';
    if (t.includes('sistema') || t.includes('info') || t.includes('status') || t.includes('estado') || t.includes('pc') || t.includes('windows') || t.includes('computador')) return 'system';
    if (t.includes('test') || t.includes('prueba') || t.includes('verificar') || t.includes('check') || t.includes('validar')) return 'testing';
    if (t.includes('descargar') || t.includes('download') || t.includes('subir') || t.includes('upload') || t.includes('imagen') || t.includes('image') || t.includes('foto') || t.includes('video')) return 'media';
    return 'general';
  }

  _getTaskTypeHints(taskType) {
    const hints = {
      facebook: `SUGERENCIAS PARA FACEBOOK:
- Hay scripts listos en: facebook-automation/scripts/
- Para crear campañas: ejecuta "node facebook-automation/scripts/ads/crear-campanias-catalogo.mjs" con powershell
- Para abrir Ads Manager: navega a https://adsmanager.facebook.com/adsmanager/manage/campaigns?act=1545022093928422
- Revisa los tokens en facebook-automation/tokens/fb_tokens_output.json
- El catálogo de productos digitales está en facebook-automation/tokens/megapack-82-productos.json
- Si el token expiró, usa el script de extracción de token
- Categorías: Diseño, Programación, Marketing, Idiomas, Oficina, Ingeniería, Ciberseguridad, MegaPack, Piano`,
      messaging: `SUGERENCIAS PARA WHATSAPP/MENSAJES:
- El bot de WhatsApp está en whatsapp-bot/
- Se conecta vía Baileys y usa Groq IA
- El catálogo de productos está disponible en facebook-automation/tokens/`,
      filesystem: `SUGERENCIAS PARA ARCHIVOS:
- Usa read_file, write_file, list_dir para operaciones de archivos
- powershell también funciona para comandos del sistema de archivos
- El proyecto principal está en C:\\Users\\ADMIN\\Music\\proyecto-unificado`,
      system: `SUGERENCIAS PARA INFO DEL SISTEMA:
- Usa sysinfo() para información general
- powershell("Get-ComputerInfo") para detalles completos
- list_windows() para ver qué programas están abiertos`,
      testing: `SUGERENCIAS PARA PRUEBAS:
- Ejecuta comandos simples como powershell("Get-Date") para verificar funcionamiento
- Lee archivos para verificar que el sistema responde
- Haz screenshots para ver el estado visual`,
      media: `SUGERENCIAS PARA MEDIA:
- Las imágenes de productos están en facebook-automation/assets/images/
- Los prompts para DALL-E están en facebook-automation/ads/campaign-package/dalle-prompts.md
- Usa open_url para abrir URLs de descarga`,
      browsing: `SUGERENCIAS PARA NAVEGACIÓN WEB:
- browser_goto para navegar a URLs específicas
- browser_click para hacer clic en elementos de la página
- browser_type para llenar formularios
- browser_evaluate para extraer información`,
      general: `SUGERENCIAS GENERALES:
- Prefiere usar scripts existentes del proyecto antes que acciones manuales
- Si no estás seguro, primero lee archivos relevantes para entender la estructura
- powershell te da acceso a node, npm y cualquier comando del sistema`
    };
    return hints[taskType] || hints.general;
  }

  _getSessionCount() {
    try {
      const ctx = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'context.json'), 'utf8'));
      return ctx.sessions?.length || 0;
    } catch { return 0; }
  }

  _parseJSON(text) {
    if (!text) return null;
    const cleaned = text.replace(/```json\s*/g, '').replace(/```\s*/g, '').replace(/^\uFEFF/, '').trim();
    try { return JSON.parse(cleaned); } catch {}
    const match = cleaned.match(/\{[\s\S]*\}/);
    if (match) try { return JSON.parse(match[0].replace(/^\uFEFF/, '')); } catch {}
    return null;
  }
}

export { ALL_PROVIDERS };
