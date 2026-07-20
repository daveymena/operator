/**
 * ╔══════════════════════════════════════════════════════════════╗
 * ║          📡 Provider Definitions — v4.0                      ║
 * ║   OpenCode Zen (primary) + GMI Cloud (secondary)            ║
 * ║   + 21 additional providers with model catalogs             ║
 * ╚══════════════════════════════════════════════════════════════╝
 */

export const PROVIDERS = [
  // ═══ PRIMARY ═════════════════════════════════════════════════════════
  {
    id: 'opencode-zen',
    name: 'OpenCode Zen',
    url: 'https://opencode.ai/zen/v1',
    key: 'OPENCODE_ZEN_API_KEY',
    priority: 1,
    tier: 'primary',
    description: 'Curated gateway by OpenCode team — Claude, GPT, Gemini, open models',
    models: [
      // Anthropic
      'claude-opus-4-7', 'claude-opus-4-6', 'claude-sonnet-4-6', 'claude-sonnet-4-5',
      'claude-haiku-4-5',
      // OpenAI
      'gpt-5.4', 'gpt-5.4-pro', 'gpt-5.3-codex', 'gpt-5-mini',
      // Google
      'gemini-3.1-pro', 'gemini-3-pro', 'gemini-3-flash',
      // Open models
      'kimi-k2.5', 'kimi-k2-thinking', 'big-pickle',
      'minimax-m2.7', 'minimax-m2.5', 'glm-5', 'glm-4.7'
    ],
    costPerToken: { input: 0.000003, output: 0.000015 },
    rateLimits: { rpm: 60, tpm: 200000 },
    streaming: true,
    vision: true
  },

  // ═══ SECONDARY ═══════════════════════════════════════════════════════
  {
    id: 'gmi',
    name: 'GMI Cloud',
    url: 'https://api.gmi-serving.com/v1',
    key: 'GMI_API_KEY',
    priority: 2,
    tier: 'secondary',
    description: 'Hosted inference for frontier & open-weight models',
    models: [
      'deepseek-ai/DeepSeek-R1', 'deepseek-ai/DeepSeek-V3.2',
      'GLM-5.1', 'Kimi-K2.5', 'gemini-3.1-flash-lite',
      'claude-sonnet-4-6', 'gpt-5.4',
      'meta-llama/Llama-4-Maverick-17B-128E-Instruct-FP8'
    ],
    costPerToken: { input: 0.000002, output: 0.000010 },
    rateLimits: { rpm: 30, tpm: 100000 },
    streaming: true,
    vision: false
  },

  // ═══ TERTIARY ════════════════════════════════════════════════════════
  {
    id: 'opencode-go',
    name: 'OpenCode Go',
    url: 'https://opencode.ai/zen/go/v1',
    key: 'OPENCODE_GO_API_KEY',
    priority: 3,
    tier: 'tertiary',
    description: 'OpenCode subscription plan — open & reasoning models',
    models: [
      'kimi-k2.6', 'kimi-k2.5', 'glm-5.1', 'glm-5',
      'mimo-v2.5-pro', 'mimo-v2.5', 'minimax-m2.7',
      'minimax-m2.5', 'qwen3.6-plus', 'qwen3.5-plus',
      'deepseek-v4-pro', 'deepseek-v4-flash'
    ],
    costPerToken: { input: 0.000001, output: 0.000005 },
    rateLimits: { rpm: 40, tpm: 150000 },
    streaming: true,
    vision: true
  },

  {
    id: 'copilot',
    name: 'GitHub Copilot',
    url: 'https://api.githubcopilot.com',
    key: 'GITHUB_COPILOT_TOKEN',
    priority: 4,
    tier: 'tertiary',
    auth: 'copilot',
    description: 'GitHub Copilot API — GPT, Claude, Gemini models',
    models: [
      'gpt-5.4', 'gpt-5.4-mini', 'gpt-5-mini', 'gpt-5.3-codex',
      'gpt-4.1', 'gpt-4o', 'claude-sonnet-4-6', 'claude-sonnet-4',
      'claude-haiku-4.5', 'gemini-3.1-pro-preview', 'gemini-3-pro-preview',
      'gemini-3-flash-preview', 'gemini-2.5-pro'
    ],
    costPerToken: { input: 0, output: 0 }, // Included in subscription
    rateLimits: { rpm: 30, tpm: 100000 },
    streaming: true,
    vision: true
  },

  {
    id: 'nous',
    name: 'Nous Portal',
    url: 'https://inference-api.nousresearch.com/v1',
    key: 'NOUS_API_KEY',
    priority: 5,
    tier: 'tertiary',
    auth: 'oauth',
    description: 'Free research portal with frontier models',
    models: [
      'kimi-k2.6', 'xiaomi/mimo-v2.5-pro', 'tencent/hy3-preview',
      'claude-opus-4.7', 'claude-sonnet-4.6', 'gpt-5.5', 'gpt-5.4-mini',
      'gemini-3-pro-preview', 'gemini-3-flash-preview', 'qwen3.5-plus',
      'step-3.5-flash', 'minimax-m2.7', 'glm-5.1',
      'grok-4.20-beta', 'nemotron-3-super'
    ],
    costPerToken: { input: 0, output: 0 },
    rateLimits: { rpm: 10, tpm: 50000 },
    streaming: true,
    vision: false
  },

  {
    id: 'nvidia',
    name: 'NVIDIA NIM',
    url: 'https://integrate.api.nvidia.com/v1',
    key: 'NVIDIA_API_KEY',
    priority: 6,
    tier: 'tertiary',
    description: 'NVIDIA inference microservices — Nemotron, LLaMA, Qwen',
    models: [
      'nemotron-3-super-120b', 'nemotron-3-nano',
      'llama-3.3-nemotron', 'qwen3.5-397b',
      'deepseek-v3.2', 'kimi-k2.6', 'minimax-m2.5', 'glm5'
    ],
    costPerToken: { input: 0.000002, output: 0.000008 },
    rateLimits: { rpm: 20, tpm: 80000 },
    streaming: true,
    vision: false
  },

  {
    id: 'deepseek',
    name: 'DeepSeek',
    url: 'https://api.deepseek.com/v1',
    key: 'DEEPSEEK_API_KEY',
    priority: 7,
    tier: 'tertiary',
    description: 'DeepSeek API — best value reasoning models',
    models: [
      'deepseek-v4-pro', 'deepseek-v4-flash', 'deepseek-chat', 'deepseek-reasoner'
    ],
    costPerToken: { input: 0.000001, output: 0.000004 },
    rateLimits: { rpm: 30, tpm: 100000 },
    streaming: true,
    vision: false
  },

  {
    id: 'anthropic',
    name: 'Anthropic Direct',
    url: 'https://api.anthropic.com',
    key: 'ANTHROPIC_API_KEY',
    priority: 8,
    tier: 'tertiary',
    description: 'Direct Anthropic API — Claude models',
    models: [
      'claude-opus-4-7', 'claude-opus-4-6', 'claude-sonnet-4-6',
      'claude-sonnet-4-5', 'claude-haiku-4-5'
    ],
    costPerToken: { input: 0.000003, output: 0.000015 },
    rateLimits: { rpm: 50, tpm: 200000 },
    streaming: true,
    vision: true
  },

  {
    id: 'openai',
    name: 'OpenAI Direct',
    url: 'https://api.openai.com/v1',
    key: 'OPENAI_API_KEY',
    priority: 9,
    tier: 'tertiary',
    description: 'Direct OpenAI API — GPT models',
    models: [
      'gpt-5.4', 'gpt-5.4-mini', 'gpt-5-mini', 'gpt-5.3-codex',
      'gpt-4.1', 'gpt-4o', 'gpt-4o-mini'
    ],
    costPerToken: { input: 0.000005, output: 0.000015 },
    rateLimits: { rpm: 60, tpm: 200000 },
    streaming: true,
    vision: true
  },

  {
    id: 'gemini',
    name: 'Google AI Studio',
    url: 'https://generativelanguage.googleapis.com/v1beta',
    key: 'GOOGLE_API_KEY',
    priority: 10,
    tier: 'tertiary',
    description: 'Google Gemini API — free tier available',
    models: [
      'gemini-3.1-pro-preview', 'gemini-3-pro-preview',
      'gemini-3-flash-preview', 'gemini-3.1-flash-lite-preview'
    ],
    costPerToken: { input: 0, output: 0 }, // Free tier
    rateLimits: { rpm: 15, tpm: 60000 },
    streaming: true,
    vision: true
  },

  {
    id: 'zai',
    name: 'Z.AI / GLM',
    url: 'https://api.z.ai/api/paas/v4',
    key: 'GLM_API_KEY',
    priority: 11,
    tier: 'tertiary',
    description: 'Zhipu AI — GLM models',
    models: [
      'glm-5.1', 'glm-5', 'glm-5v-turbo', 'glm-5-turbo',
      'glm-4.7', 'glm-4.5', 'glm-4.5-flash'
    ],
    costPerToken: { input: 0.000001, output: 0.000004 },
    rateLimits: { rpm: 30, tpm: 100000 },
    streaming: true,
    vision: true
  },

  {
    id: 'kimi',
    name: 'Kimi / Moonshot',
    url: 'https://api.moonshot.ai/v1',
    key: 'KIMI_API_KEY',
    priority: 12,
    tier: 'tertiary',
    description: 'Moonshot AI — Kimi reasoning models',
    models: [
      'kimi-k2.6', 'kimi-k2.5', 'kimi-k2-thinking', 'kimi-k2-thinking-turbo'
    ],
    costPerToken: { input: 0.000001, output: 0.000004 },
    rateLimits: { rpm: 20, tpm: 80000 },
    streaming: true,
    vision: false
  },

  {
    id: 'xiaomi',
    name: 'Xiaomi MiMo',
    url: 'https://api.xiaomimimo.com/v1',
    key: 'XIAOMI_API_KEY',
    priority: 13,
    tier: 'tertiary',
    description: 'Xiaomi MiMo — coding & reasoning',
    models: [
      'mimo-v2.5-pro', 'mimo-v2.5', 'mimo-v2-pro', 'mimo-v2-omni', 'mimo-v2-flash'
    ],
    costPerToken: { input: 0.000001, output: 0.000003 },
    rateLimits: { rpm: 20, tpm: 60000 },
    streaming: true,
    vision: true
  },

  {
    id: 'minimax',
    name: 'MiniMax',
    url: 'https://api.minimax.io/anthropic',
    key: 'MINIMAX_API_KEY',
    priority: 14,
    tier: 'tertiary',
    description: 'MiniMax — long context models',
    models: [
      'MiniMax-M2.7', 'MiniMax-M2.5', 'MiniMax-M2.1', 'MiniMax-M2'
    ],
    costPerToken: { input: 0.000001, output: 0.000004 },
    rateLimits: { rpm: 20, tpm: 80000 },
    streaming: true,
    vision: false
  },

  {
    id: 'huggingface',
    name: 'Hugging Face',
    url: 'https://router.huggingface.co/v1',
    key: 'HF_TOKEN',
    priority: 15,
    tier: 'tertiary',
    description: 'Hugging Face Inference API — open models',
    models: [
      'Kimi-K2.5', 'Qwen3.5-397B', 'DeepSeek-V3.2',
      'MiniMax-M2.5', 'GLM-5', 'MiMo-V2-Flash', 'Kimi-K2.6'
    ],
    costPerToken: { input: 0, output: 0 },
    rateLimits: { rpm: 10, tpm: 30000 },
    streaming: true,
    vision: false
  },

  {
    id: 'xai',
    name: 'xAI',
    url: 'https://api.x.ai/v1',
    key: 'XAI_API_KEY',
    priority: 16,
    tier: 'tertiary',
    description: 'xAI — Grok models',
    models: ['grok-4.20-beta', 'grok-3', 'grok-3-mini'],
    costPerToken: { input: 0.000005, output: 0.000015 },
    rateLimits: { rpm: 30, tpm: 100000 },
    streaming: true,
    vision: true
  },

  {
    id: 'alibaba',
    name: 'Alibaba DashScope',
    url: 'https://dashscope-intl.aliyuncs.com/compatible-mode/v1',
    key: 'DASHSCOPE_API_KEY',
    priority: 17,
    tier: 'tertiary',
    description: 'Alibaba Cloud — Qwen models',
    models: [
      'qwen3.6-plus', 'qwen3.5-plus', 'qwen3-coder-plus'
    ],
    costPerToken: { input: 0.000001, output: 0.000004 },
    rateLimits: { rpm: 20, tpm: 80000 },
    streaming: true,
    vision: true
  },

  {
    id: 'arcee',
    name: 'Arcee AI',
    url: 'https://api.arcee.ai/api/v1',
    key: 'ARCEEAI_API_KEY',
    priority: 18,
    tier: 'tertiary',
    description: 'Arcee AI — Trinity models',
    models: ['trinity-large-thinking', 'trinity-large-preview', 'trinity-mini'],
    costPerToken: { input: 0.000001, output: 0.000003 },
    rateLimits: { rpm: 15, tpm: 50000 },
    streaming: true,
    vision: false
  },

  {
    id: 'stepfun',
    name: 'StepFun',
    url: 'https://api.stepfun.ai/step_plan/v1',
    key: 'STEPFUN_API_KEY',
    priority: 19,
    tier: 'tertiary',
    description: 'StepFun — Step models',
    models: ['step-3.5-flash', 'step-3.5-flash-2603'],
    costPerToken: { input: 0.000001, output: 0.000003 },
    rateLimits: { rpm: 15, tpm: 50000 },
    streaming: true,
    vision: false
  },

  {
    id: 'freemodel',
    name: 'FreeModel.dev',
    url: 'https://api.freemodel.dev/v1',
    key: 'FREEMODEL_API_KEY',
    priority: 20,
    tier: 'fallback',
    description: 'Free model gateway',
    models: ['gpt-4o', 'claude-sonnet', 'gemini-pro'],
    costPerToken: { input: 0, output: 0 },
    rateLimits: { rpm: 10, tpm: 30000 },
    streaming: false,
    vision: false
  },

  // ═══ LOCAL ════════════════════════════════════════════════════════════
  {
    id: 'opencode-engine',
    name: 'OpenCode Engine (local)',
    url: 'http://localhost:21294/v1',
    key: 'LOCAL_ENGINE_KEY',
    priority: 21,
    tier: 'local',
    local: true,
    description: 'Local OpenCode engine — always available',
    models: ['deepseek-v4-flash', 'big-pickle', 'nemotron', 'hy3'],
    costPerToken: { input: 0, output: 0 },
    rateLimits: { rpm: 999, tpm: 999999 },
    streaming: true,
    vision: false
  },

  {
    id: 'lmstudio',
    name: 'LM Studio',
    url: 'http://127.0.0.1:1234/v1',
    key: 'LMSTUDIO_KEY',
    priority: 22,
    tier: 'local',
    local: true,
    description: 'Local LM Studio — self-hosted models',
    models: ['local-models'],
    costPerToken: { input: 0, output: 0 },
    rateLimits: { rpm: 999, tpm: 999999 },
    streaming: true,
    vision: false
  },

  {
    id: 'ollama-cloud',
    name: 'Ollama Cloud',
    url: 'https://ollama.com/v1',
    key: 'OLLAMA_API_KEY',
    priority: 23,
    tier: 'fallback',
    description: 'Ollama cloud — open models',
    models: ['llama-4', 'llama-3.3', 'deepseek-v3', 'qwen3', 'mistral'],
    costPerToken: { input: 0, output: 0 },
    rateLimits: { rpm: 10, tpm: 30000 },
    streaming: true,
    vision: false
  }
];

/**
 * Find the best provider for a given model
 */
export function getModelProvider(modelId) {
  const matches = [];
  for (const p of PROVIDERS) {
    const found = p.models.some(m =>
      m.toLowerCase() === modelId.toLowerCase()
    );
    if (found) {
      matches.push({ provider: p.id, priority: p.priority, tier: p.tier });
    }
  }
  // Sort by priority
  matches.sort((a, b) => a.priority - b.priority);
  return matches;
}

/**
 * Get default model for a task type
 */
export function getDefaultModel(taskType = 'general') {
  const defaults = {
    general: 'big-pickle',
    coding: 'claude-sonnet-4-6',
    reasoning: 'claude-opus-4-7',
    vision: 'gpt-5.4',
    fast: 'gemini-3-flash',
    deep_research: 'deepseek-v4-pro',
    creative: 'gpt-5.4',
    analysis: 'kimi-k2.5'
  };
  return defaults[taskType] || defaults.general;
}

export default PROVIDERS;
