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

const NVIDIA_KEY = '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';
const NVIDIA_URL = 'https://integrate.api.nvidia.com/v1';

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
  }

  async think(task, state, knowledge, history = []) {
    const prompt = this._buildPrompt(task, state, knowledge, history);

    const backends = this.backend === 'auto'
      ? ['nvidia', 'copilot', 'opencodeGo', 'hermes', 'opencode', 'groq', 'bridge', 'local']
      : [this.backend];

    let lastError = '';
    for (const backend of backends) {
      try {
        const result = await this[`_${backend}`](prompt);
        if (result) return { ...result, _backend: backend };
      } catch (e) {
        lastError = e.message;
        if (this.verbose) console.log(`  ⚠️ Brain[${backend}]: ${e.message || 'returned null'}`);
      }
    }
    return this._fallback(task, state, lastError);
  }

  async describeImage(base64) {
    if (!base64) return 'Sin imagen disponible';
    for (const fn of [() => this._nvidiaVision(base64), () => this._groqVision(base64)]) {
      try { const r = await fn(); if (r) return r; } catch {}
    }
    return `[Análisis visual no disponible - screenshot de ${Math.round(base64.length / 1024)}KB]`;
  }

  async _nvidiaVision(base64) {
    try {
      const res = await axios.post(`${this.nvidiaUrl}/chat/completions`, {
        model: 'deepseek-ai/deepseek-v4-flash',
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
      return res.data?.choices?.[0]?.message?.content || null;
    } catch { return null; }
  }

  async _nvidia(prompt) {
    const promptShort = prompt.length > 4000 ? prompt.substring(0, 4000) + '\n...[truncado]' : prompt;
    try {
      const res = await axios.post(`${this.nvidiaUrl}/chat/completions`, {
        model: 'nvidia/nemotron-3-super-120b-a12b',
        messages: [
          { role: 'system', content: 'Eres un operador de PC. Responde SOLO con JSON. Acciones: screenshot, browser_goto, browser_click(text), browser_type(text), browser_evaluate(code), powershell, wait, done. Formato: {"thought":"...","action":{"type":"comando","params":{}},"done":false,"reason":"..."}' },
          { role: 'user', content: promptShort }
        ],
        temperature: 0.1,
        max_tokens: 300
      }, {
        headers: { 'Authorization': `Bearer ${this.nvidiaKey}`, 'Content-Type': 'application/json' },
        timeout: 15000
      });
      if (!res.data?.choices?.[0]?.message?.content) return null;
      return this._parseJSON(res.data.choices[0].message.content);
    } catch (e) {
      if (this.verbose) console.log(`  ⚠️ NVIDIA error: ${e.message}`);
      return null;
    }
  }

  async _copilot(prompt) {
    const cpToken = process.env.GITHUB_COPILOT_TOKEN || process.env.GITHUB_TOKEN;
    if (!cpToken || cpToken.length < 10) return null;
    try {
      const { default: axios } = await import('axios');
      const res = await axios.post('https://api.githubcopilot.com/chat/completions', {
        model: 'gpt-4o',
        messages: [
          { role: 'system', content: 'Eres un operador autonomo de PC. Responde SOLO con JSON exactamente este formato: {"thought":"razonamiento","action":{"type":"COMANDO","params":{}},"done":false,"reason":"por que"}. COMANDOS: screenshot, browser_goto, browser_click, browser_type, browser_evaluate, powershell, keyboard_type, wait, done' },
          { role: 'user', content: prompt.length > 6000 ? prompt.substring(0, 6000) + '\n...[truncado]' : prompt }
        ],
        temperature: 0.2,
        max_tokens: 500
      }, {
        headers: { 'Authorization': `Bearer ${cpToken}`, 'Content-Type': 'application/json' },
        timeout: 20000
      });
      if (!res.data?.choices?.[0]?.message?.content) return null;
      return this._parseJSON(res.data.choices[0].message.content);
    } catch { return null; }
  }

  async _opencode(prompt) {
    return this._opencodeGo(prompt);
  }

  async _opencodeGo(prompt) {
    const goKey = process.env.OPENCODE_GO_API_KEY || process.env.OPENCODE_ZEN_API_KEY;
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
      if (this.verbose) console.log(`  ⚠️ OpenCodeGo error: ${e.message}`);
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
    const res = await axios.post('https://api.groq.com/openai/v1/chat/completions', {
      model: 'llama-3.3-70b-versatile',
      messages: [
        { role: 'system', content: 'Eres un operador autónomo de PC. JSON only.' },
        { role: 'user', content: prompt }
      ],
      temperature: 0.2,
      response_format: { type: 'json_object' }
    }, {
      headers: { Authorization: `Bearer ${this.groqKey}`, 'Content-Type': 'application/json' },
      timeout: 20000
    });
    return this._parseJSON(res.data.choices[0].message.content);
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
    const p = prompt.toLowerCase();
    let thought = 'Modo local - sin modelos de IA disponibles';
    let action = { type: 'screenshot', params: { quality: 50, scale: 0.75 } };
    let done = false;
    let reason = 'Analizando estado del sistema con heurística local';

    if (p.includes('facebook') || p.includes('ads')) {
      action = { type: 'open_url', params: { url: 'https://adsmanager.facebook.com/adsmanager/manage/campaigns?act=1545022093928422' } };
      thought = 'Abriendo Facebook Ads Manager';
      reason = 'Facebook Ads detectado en la tarea';
    } else if (p.includes('chrome') || p.includes('navegador')) {
      action = { type: 'powershell', params: { script: 'Start-Process "chrome.exe"' } };
      thought = 'Abriendo Google Chrome';
      reason = 'Navegador solicitado';
    } else if (p.includes('whatsapp')) {
      action = { type: 'open_url', params: { url: 'https://web.whatsapp.com' } };
      thought = 'Abriendo WhatsApp Web';
      reason = 'WhatsApp solicitado';
    } else if (p.includes('screenshot') || p.includes('captura') || p.includes('pantalla')) {
      thought = 'Tomando screenshot para análisis visual';
      reason = 'Captura de pantalla solicitada';
    } else if (p.includes('analiza') || p.includes('describe') || p.includes('status') || p.includes('estado')) {
      thought = 'Analizando el sistema completo';
      reason = 'Diagnóstico solicitado';
    }

    return { thought, action, done, reason, _backend: 'local' };
  }

  _fallback(task, state, error) {
    return {
      thought: `Ningún modelo disponible (${error}). Tomando screenshot básico.`,
      action: { type: 'screenshot', params: { quality: 40, scale: 0.5 } },
      done: false, reason: 'sin modelos de IA disponibles', _backend: 'fallback'
    };
  }

  _getProviderInfo() {
    return `PROVEEDORES DE IA:

🔥 NVIDIA NIM (ACTIVO - default)
   Key: ✅ | 118 modelos
   Modelo: nvidia/nemotron-3-super

🔥 GitHub Copilot (ACTIVO)
   Key: ✅ | Modelo: gpt-4o
   Alternativos: claude-sonnet, gemini-pro

🔥 OpenCode Go (ACTIVO)
   Key: ✅ | Modelo: kimi-k2.6
   Tambien: glm-5.1, mimo-v2.5, minimax-m2.7, qwen3.6

⏸️ OpenCode Zen — Sin key valida
⏸️ OpenAI — Key expirada (401)
⏸️ FreeModel.dev — Pago requerido (402)
⏸️ OpenCode Engine (:21294) — No ejecutandose
⏸️ Hermes CLI — Instalado, requiere Python
⏸️ Groq API — Sin API key

Mas: nous (gratis OAuth), gemini, deepseek, anthropic, z.ai/glm,
kimi, xiaomi/mimo, minimax, huggingface, xAI/grok, alibaba/qwen,
arcee, stepfun, gmi, ollama-cloud, lm studio

Prioridad auto: NVIDIA > Copilot > OpenCodeGo > Hermes > Engine > Groq > Bridge > Local`;
  }

  _buildPrompt(task, state, knowledge, history) {
    const lastActions = history.slice(-8).map(h =>
      `  Paso ${h.step}: 🤔 ${h.thought}\n  🎬 ${h.action}\n  📊 ${h.result}`
    ).join('\n');

    return `Eres un OPERADOR AUTÓNOMO DE PC con acceso a MÚLTIPLES MODELOS DE IA.
Tu tarea: "${task}"

${knowledge ? 'CONOCIMIENTO:\n' + knowledge.substring(0, 6000) + '\n' : ''}

${this._getProviderInfo()}

CONTEXTO DEL SISTEMA:
- PC: Windows
- Proyecto: ${path.resolve(__dirname, '..')}
- Bridge: ws://localhost:20100
- OpenCode Engine: ${this.opencodeUrl}
- Hermes CLI: ${fs.existsSync(HERMES_CLI) ? 'disponible' : 'no encontrado'}
- Facebook BM: 4482432028697067 | Página: VentasPro | Ad Account: 1545022093928422
- Catálogo: 102 productos tecnológicos
- Sesiones anteriores: ${this._getSessionCount()}

ESTADO ACTUAL:
${state.description || 'Iniciando...'} | Cursor: ${state.cursor || 'N/A'}

HISTORIAL:
${lastActions || '  (primer paso)'}

COMANDOS:
screenshot | mouse_move | mouse_click | keyboard_type | keyboard_press
powershell | open_url | read_file | write_file | list_dir | sysinfo
browser_goto | browser_click | browser_type | browser_evaluate | browser_screenshot
wait | done

Responde SOLO con JSON:
{ "thought": "razonamiento", "action": { "type": "COMANDO", "params": {} }, "done": false, "reason": "por qué" }
Tarea COMPLETA → { "done": true }`;
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
