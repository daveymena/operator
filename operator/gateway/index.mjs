/**
 * ╔══════════════════════════════════════════════════════════════╗
 * ║              🧠 AI Gateway Provider — v4.0                  ║
 * ║   Unified multi-provider gateway with smart routing,        ║
 * ║   failover, rate limiting, cost tracking & streaming        ║
 * ╚══════════════════════════════════════════════════════════════╝
 *
 * Primary:   OpenCode Zen (https://opencode.ai/zen/v1)
 * Secondary: GMI Cloud     (https://api.gmi-serving.com/v1)
 * Tertiary:  OpenCode Go, Copilot, NVIDIA, etc.
 *
 * Features:
 * - Auto-failover between providers
 * - Round-robin API key rotation
 * - Rate limiting per provider
 * - Cost & token tracking
 * - SSE streaming support
 * - Provider health monitoring
 * - Smart model routing (pick best provider for each model)
 */

import axios from 'axios';
import { EventEmitter } from 'events';
import { PROVIDERS, getModelProvider } from './providers.mjs';
import { UsageTracker } from './tracker.mjs';

export class AIGateway extends EventEmitter {
  constructor(config = {}) {
    super();
    this.config = config;
    this.providers = new Map();
    this.health = new Map();
    this.keys = new Map();
    this.keyIndex = new Map();
    this.tracker = new UsageTracker();
    this.verbose = config.verbose || false;
    this.maxRetries = config.maxRetries || 3;
    this.timeout = config.timeout || 120000;
    this.streamEnabled = config.streaming !== false;

    // Initialize providers
    this._initProviders();
  }

  // ─── Provider Initialization ──────────────────────────────────────────

  _initProviders() {
    for (const p of PROVIDERS) {
      // Load API keys from env
      const keys = this._loadKeys(p);
      if (keys.length > 0 || p.local) {
        this.providers.set(p.id, p);
        this.keys.set(p.id, keys);
        this.keyIndex.set(p.id, 0);
        this.health.set(p.id, {
          status: 'unknown',
          lastCheck: null,
          failures: 0,
          avgLatency: 0,
          totalRequests: 0,
          successRate: 1.0
        });
        this._log(`Provider loaded: ${p.name} (${keys.length} keys)`);
      }
    }
  }

  _loadKeys(provider) {
    const keys = [];
    // Support multiple keys: KEY_1, KEY_2, or comma-separated
    const envKey = process.env[provider.key];
    if (envKey) {
      // Handle comma-separated keys
      if (envKey.includes(',')) {
        keys.push(...envKey.split(',').map(k => k.trim()).filter(Boolean));
      } else {
        keys.push(envKey);
      }
    }
    // Also check for numbered keys: OPENCODE_ZEN_API_KEY_1, OPENCODE_ZEN_API_KEY_2
    for (let i = 1; i <= 10; i++) {
      const numberedKey = process.env[`${provider.key}_${i}`];
      if (numberedKey) keys.push(numberedKey);
    }
    return keys;
  }

  _getNextKey(providerId) {
    const keys = this.keys.get(providerId);
    if (!keys || keys.length === 0) return null;

    // Round-robin rotation
    const idx = this.keyIndex.get(providerId) || 0;
    const key = keys[idx % keys.length];
    this.keyIndex.set(providerId, idx + 1);
    return key;
  }

  // ─── Main Request Method ──────────────────────────────────────────────

  /**
   * Send a chat completion request through the gateway
   * @param {Object} params - Request parameters
   * @param {string} params.model - Model ID (e.g., 'claude-sonnet-4-6', 'gpt-5.4')
   * @param {Array} params.messages - Chat messages
   * @param {Object} params.options - Additional options (temperature, max_tokens, etc.)
   * @param {boolean} params.stream - Enable streaming
   * @param {string} params.preferProvider - Preferred provider ID
   * @returns {Object|AsyncIterator} Response or stream
   */
  async chat(params) {
    const { model, messages, options = {}, stream = false, preferProvider } = params;

    // Find providers that support this model
    const candidateProviders = this._findProvidersForModel(model, preferProvider);

    if (candidateProviders.length === 0) {
      throw new Error(`No provider available for model: ${model}`);
    }

    // Sort by health score (success rate, latency)
    const ranked = this._rankProviders(candidateProviders);

    let lastError = null;
    for (const providerId of ranked) {
      // Check rate limits
      if (!this._checkRateLimit(providerId)) {
        this._log(`Rate limited: ${providerId}, skipping`);
        continue;
      }

      try {
        const result = await this._sendRequest(providerId, model, messages, options, stream);
        // Update health on success
        this._recordSuccess(providerId, result.duration);
        this.tracker.record(providerId, model, result.usage);
        return result;
      } catch (error) {
        lastError = error;
        this._recordFailure(providerId, error);
        this._log(`Provider ${providerId} failed: ${error.message}`);

        // If it's an auth error, don't retry this provider
        if (error.response?.status === 401 || error.response?.status === 403) {
          this.health.get(providerId).status = 'auth_error';
          continue;
        }

        // Rate limit error, wait and try next
        if (error.response?.status === 429) {
          this.health.get(providerId).status = 'rate_limited';
          continue;
        }
      }
    }

    throw new Error(`All providers failed for model ${model}. Last error: ${lastError?.message}`);
  }

  /**
   * Stream a chat completion request
   * @param {Object} params - Same as chat() params
   * @returns {AsyncGenerator} Stream of chunks
   */
  async *chatStream(params) {
    const { model, messages, options = {}, preferProvider } = params;
    const candidateProviders = this._findProvidersForModel(model, preferProvider);
    const ranked = this._rankProviders(candidateProviders);

    for (const providerId of ranked) {
      if (!this._checkRateLimit(providerId)) continue;

      try {
        const stream = this._sendStreamRequest(providerId, model, messages, options);
        yield* stream;
        this._recordSuccess(providerId, 0);
        return;
      } catch (error) {
        this._recordFailure(providerId, error);
        this._log(`Stream failed on ${providerId}: ${error.message}`);
      }
    }

    throw new Error(`All providers failed for streaming model ${model}`);
  }

  /**
   * List available models across all providers
   */
  listModels() {
    const models = [];
    for (const [providerId, provider] of this.providers) {
      const healthInfo = this.health.get(providerId);
      for (const modelId of provider.models) {
        models.push({
          id: modelId,
          provider: providerId,
          providerName: provider.name,
          available: healthInfo.status !== 'auth_error',
          health: healthInfo.status,
          successRate: healthInfo.successRate,
          avgLatency: healthInfo.avgLatency
        });
      }
    }
    return models;
  }

  /**
   * Get gateway status
   */
  getStatus() {
    const providers = {};
    for (const [id, info] of this.health) {
      const provider = this.providers.get(id);
      providers[id] = {
        name: provider?.name,
        ...info,
        keys: this.keys.get(id)?.length || 0
      };
    }
    return {
      status: 'online',
      providers,
      usage: this.tracker.getSummary(),
      uptime: process.uptime()
    };
  }

  // ─── Provider Routing ─────────────────────────────────────────────────

  _findProvidersForModel(model, preferProvider) {
    const candidates = [];

    // If preferred provider specified and has this model
    if (preferProvider) {
      const p = this.providers.get(preferProvider);
      if (p) {
        // Check if provider supports model (or supports all with local flag)
        const modelMatch = p.models.some(m =>
          m.toLowerCase() === model.toLowerCase() ||
          m.toLowerCase().includes(model.toLowerCase().split('-')[0])
        );
        if (modelMatch || p.local) {
          candidates.push(preferProvider);
        }
      }
    }

    // Find all providers that have this model
    for (const [id, provider] of this.providers) {
      if (id === preferProvider) continue;
      const modelMatch = provider.models.some(m =>
        m.toLowerCase() === model.toLowerCase() ||
        m.toLowerCase().includes(model.toLowerCase().split('-')[0])
      );
      if (modelMatch || provider.local) {
        candidates.push(id);
      }
    }

    return candidates;
  }

  _rankProviders(providerIds) {
    return providerIds.sort((a, b) => {
      const ha = this.health.get(a) || {};
      const hb = this.health.get(b) || {};

      // Prioritize by: success rate desc, then latency asc
      const scoreA = (ha.successRate || 0) - (ha.avgLatency || 0) / 10000;
      const scoreB = (hb.successRate || 0) - (hb.avgLatency || 0) / 10000;
      return scoreB - scoreA;
    });
  }

  // ─── Request Execution ────────────────────────────────────────────────

  async _sendRequest(providerId, model, messages, options, stream) {
    const provider = this.providers.get(providerId);
    const apiKey = this._getNextKey(providerId);

    const startTime = Date.now();
    let url, headers, body;

    // Build request based on provider type
    if (provider.auth === 'oauth') {
      // OAuth-based providers (Nous, etc.)
      url = `${provider.url}/chat/completions`;
      headers = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey || 'oauth-token'}`
      };
    } else if (provider.id === 'anthropic') {
      // Anthropic uses Messages API
      url = `${provider.url}/v1/messages`;
      headers = {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true'
      };
      body = {
        model,
        messages: this._convertToAnthropic(messages),
        max_tokens: options.max_tokens || 4096,
        stream: false,
        ...options
      };
    } else if (provider.id === 'gemini') {
      // Google Gemini API
      url = `${provider.url}/models/${model}:generateContent`;
      headers = {
        'Content-Type': 'application/json',
        'x-goog-api-key': apiKey
      };
      body = {
        contents: this._convertToGemini(messages),
        generationConfig: {
          maxOutputTokens: options.max_tokens || 4096,
          temperature: options.temperature || 0.7
        }
      };
    } else {
      // OpenAI-compatible (OpenCode Zen, GMI Cloud, DeepSeek, etc.)
      url = `${provider.url}/chat/completions`;
      headers = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      };
      body = {
        model,
        messages,
        stream: false,
        ...options
      };
    }

    if (!body) {
      body = { model, messages, stream: false, ...options };
    }

    const response = await axios.post(url, body, {
      headers,
      timeout: this.timeout,
      validateStatus: (status) => status < 500
    });

    const duration = Date.now() - startTime;

    if (response.status >= 400) {
      const err = new Error(`Provider error ${response.status}: ${JSON.stringify(response.data)}`);
      err.response = response;
      throw err;
    }

    // Normalize response to OpenAI format
    const result = this._normalizeResponse(response.data, providerId, model, duration);
    return result;
  }

  async *_sendStreamRequest(providerId, model, messages, options) {
    const provider = this.providers.get(providerId);
    const apiKey = this._getNextKey(providerId);

    const url = `${provider.url}/chat/completions`;
    const headers = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    };
    const body = { model, messages, stream: true, ...options };

    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(body)
    });

    if (!response.ok) {
      throw new Error(`Stream error: ${response.status} ${await response.text()}`);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || !trimmed.startsWith('data: ')) continue;
        const data = trimmed.slice(6);
        if (data === '[DONE]') return;

        try {
          const chunk = JSON.parse(data);
          yield chunk;
        } catch {}
      }
    }
  }

  // ─── Response Normalization ───────────────────────────────────────────

  _normalizeResponse(data, providerId, model, duration) {
    // Already OpenAI format (most providers)
    if (data.choices) {
      return {
        ok: true,
        content: data.choices[0]?.message?.content || '',
        model: data.model || model,
        provider: providerId,
        usage: data.usage || { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 },
        duration,
        raw: data
      };
    }

    // Anthropic format
    if (data.content) {
      return {
        ok: true,
        content: data.content.map(c => c.text || '').join(''),
        model: data.model || model,
        provider: providerId,
        usage: {
          prompt_tokens: data.usage?.input_tokens || 0,
          completion_tokens: data.usage?.output_tokens || 0,
          total_tokens: (data.usage?.input_tokens || 0) + (data.usage?.output_tokens || 0)
        },
        duration,
        raw: data
      };
    }

    // Gemini format
    if (data.candidates) {
      const text = data.candidates[0]?.content?.parts?.map(p => p.text).join('') || '';
      return {
        ok: true,
        content: text,
        model,
        provider: providerId,
        usage: {
          prompt_tokens: data.usageMetadata?.promptTokenCount || 0,
          completion_tokens: data.usageMetadata?.candidatesTokenCount || 0,
          total_tokens: data.usageMetadata?.totalTokenCount || 0
        },
        duration,
        raw: data
      };
    }

    // Fallback
    return {
      ok: true,
      content: typeof data === 'string' ? data : JSON.stringify(data),
      model,
      provider: providerId,
      usage: { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 },
      duration,
      raw: data
    };
  }

  // ─── Format Converters ────────────────────────────────────────────────

  _convertToAnthropic(messages) {
    return messages
      .filter(m => m.role !== 'system')
      .map(m => ({
        role: m.role === 'assistant' ? 'assistant' : 'user',
        content: m.content
      }));
  }

  _convertToGemini(messages) {
    return messages.map(m => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }]
    }));
  }

  // ─── Rate Limiting ────────────────────────────────────────────────────

  _checkRateLimit(providerId) {
    const health = this.health.get(providerId);
    if (!health) return false;

    // If rate limited, check if cooldown period has passed
    if (health.status === 'rate_limited') {
      const cooldown = 60000; // 1 minute cooldown
      if (health.lastCheck && Date.now() - health.lastCheck < cooldown) {
        return false;
      }
      health.status = 'unknown'; // Reset after cooldown
    }

    return health.status !== 'auth_error';
  }

  // ─── Health Tracking ──────────────────────────────────────────────────

  _recordSuccess(providerId, duration) {
    const health = this.health.get(providerId);
    if (!health) return;

    health.status = 'healthy';
    health.lastCheck = Date.now();
    health.failures = 0;
    health.totalRequests++;
    health.avgLatency = health.avgLatency === 0
      ? duration
      : (health.avgLatency * 0.8) + (duration * 0.2); // EMA
    health.successRate = health.totalRequests > 0
      ? 1 - (health.failures / health.totalRequests)
      : 1.0;
  }

  _recordFailure(providerId, error) {
    const health = this.health.get(providerId);
    if (!health) return;

    health.lastCheck = Date.now();
    health.failures++;
    health.totalRequests++;
    health.successRate = health.totalRequests > 0
      ? 1 - (health.failures / health.totalRequests)
      : 0;

    if (health.failures >= 5) {
      health.status = 'degraded';
    }

    this.emit('provider:error', { providerId, error: error.message });
  }

  // ─── Utility ──────────────────────────────────────────────────────────

  _log(...args) {
    if (this.verbose) {
      console.log(`[GATEWAY]`, ...args);
    }
  }
}

// Export singleton
let _gateway = null;

export function getGateway(config) {
  if (!_gateway) {
    _gateway = new AIGateway(config);
  }
  return _gateway;
}

export default AIGateway;
