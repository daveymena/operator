/**
 * ╔══════════════════════════════════════════════════════════════╗
 * ║      🧠 AI Gateway v4.1 — DB-backed with Token Manager      ║
 * ║                                                              ║
 * ║   Extends the v4.0 Gateway to use:                          ║
 * ║   • SQLite database for token storage                       ║
 * ║   • TokenManager for auto-rotation & renewal                ║
 * ║   • Usage tracking in DB (not JSON)                         ║
 * ║   • Auto-restart when all tokens exhausted                  ║
 * ╚══════════════════════════════════════════════════════════════╝
 */

import axios from 'axios';
import { EventEmitter } from 'events';
import { getDatabase } from '../db/index.mjs';
import { TokenManager } from '../token-manager/index.mjs';
import { PROVIDERS, getDefaultModel } from './providers.mjs';

export class AIGatewayDB extends EventEmitter {
  constructor(config = {}) {
    super();
    this.config = config;
    this.providers = new Map();
    this.health = new Map();
    this.verbose = config.verbose || false;
    this.maxRetries = config.maxRetries || 3;
    this.timeout = config.timeout || 120000;
    this.db = null;
    this.tokenManager = null;
    this._initialized = false;
  }

  async init() {
    if (this._initialized) return this;

    // Init database
    this.db = await getDatabase();

    // Init token manager
    this.tokenManager = new TokenManager({ verbose: this.verbose });
    await this.tokenManager.init();
    this.tokenManager.start();

    // Forward token manager events
    this.tokenManager.on('provider:exhausted', (data) => {
      this._log(`⚠️ Provider ${data.provider} exhausted!`);
      this.emit('provider:exhausted', data);
    });

    this.tokenManager.on('provider:renewed', (data) => {
      this._log(`✅ Provider ${data.provider} renewed!`);
      this.emit('provider:renewed', data);
    });

    this.tokenManager.on('server:restart_needed', (data) => {
      this._log(`🔄 Server restart needed (reason: ${data.reason})`);
      this.emit('server:restart_needed', data);
    });

    // Load provider definitions
    for (const p of PROVIDERS) {
      this.providers.set(p.id, p);
      this.health.set(p.id, {
        status: 'unknown',
        lastCheck: null,
        failures: 0,
        totalRequests: 0,
        successRate: 1.0,
        avgLatency: 0
      });
    }

    this._initialized = true;
    this._log('Gateway initialized with DB + Token Manager');
    return this;
  }

  // ─── Main Request Method ──────────────────────────────────────────────

  async chat(params) {
    if (!this._initialized) await this.init();

    const { model, messages, options = {}, stream = false, preferProvider } = params;

    // Find providers that support this model
    const candidateProviders = this._findProvidersForModel(model, preferProvider);

    if (candidateProviders.length === 0) {
      throw new Error(`No provider available for model: ${model}`);
    }

    const ranked = this._rankProviders(candidateProviders);

    let lastError = null;
    for (const providerId of ranked) {
      // Get token from DB via TokenManager
      const token = this.tokenManager.getToken(providerId);

      if (!token) {
        this._log(`No active token for ${providerId}, skipping`);
        continue;
      }

      const startTime = Date.now();

      try {
        const result = await this._sendRequest(providerId, token.key, model, messages, options, stream);
        const duration = Date.now() - startTime;

        // Record success
        this._recordSuccess(providerId, duration);
        this.tokenManager.reportResult(token.id, {
          success: true,
          tokensUsed: result.usage?.total_tokens || 0,
          cost: this._estimateCost(providerId, result.usage),
          durationMs: duration
        });

        // Record usage in DB
        this.db.recordUsage(
          providerId, model,
          result.usage?.prompt_tokens || 0,
          result.usage?.completion_tokens || 0,
          result.usage?.total_tokens || 0,
          this._estimateCost(providerId, result.usage),
          duration,
          true
        );

        result.provider = providerId;
        result.tokenId = token.id;
        return result;

      } catch (error) {
        lastError = error;
        const duration = Date.now() - startTime;
        const httpStatus = error.response?.status;

        this._recordFailure(providerId, error);

        // Report to token manager (handles auto-rotation/renewal)
        this.tokenManager.reportResult(token.id, {
          success: false,
          httpStatus,
          error: error.message,
          durationMs: duration
        });

        this._log(`Provider ${providerId} failed: ${error.message}`);

        if (httpStatus === 401 || httpStatus === 403) {
          this.health.get(providerId).status = 'auth_error';
          continue;
        }

        if (httpStatus === 429) {
          this.health.get(providerId).status = 'rate_limited';
          continue;
        }
      }
    }

    throw new Error(`All providers failed for model ${model}. Last error: ${lastError?.message}`);
  }

  // ─── Streaming ─────────────────────────────────────────────────────────

  async *chatStream(params) {
    if (!this._initialized) await this.init();

    const { model, messages, options = {}, preferProvider } = params;
    const candidateProviders = this._findProvidersForModel(model, preferProvider);
    const ranked = this._rankProviders(candidateProviders);

    for (const providerId of ranked) {
      const token = this.tokenManager.getToken(providerId);
      if (!token) continue;

      try {
        const provider = this.providers.get(providerId);
        const url = `${provider.url}/chat/completions`;
        const headers = {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token.key}`
        };
        const body = { model, messages, stream: true, ...options };

        const response = await fetch(url, {
          method: 'POST', headers,
          body: JSON.stringify(body)
        });

        if (!response.ok) {
          const httpStatus = response.status;
          this.tokenManager.reportResult(token.id, { success: false, httpStatus, error: `Stream error: ${response.status}` });
          continue;
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

            try { yield JSON.parse(data); } catch {}
          }
        }

        this.tokenManager.reportResult(token.id, { success: true });
        this._recordSuccess(providerId, 0);
        return;

      } catch (error) {
        this._recordFailure(providerId, error);
        this.tokenManager.reportResult(token.id, { success: false, error: error.message });
      }
    }

    throw new Error(`All providers failed for streaming model ${model}`);
  }

  // ─── Model & Status ────────────────────────────────────────────────────

  listModels() {
    const models = [];
    for (const [providerId, provider] of this.providers) {
      const healthInfo = this.health.get(providerId);
      const activeTokens = this.db?.getActiveTokens(providerId) || [];
      for (const modelId of provider.models) {
        models.push({
          id: modelId,
          provider: providerId,
          providerName: provider.name,
          available: activeTokens.length > 0 && healthInfo.status !== 'auth_error',
          health: healthInfo.status,
          successRate: healthInfo.successRate,
          tokens: activeTokens.length
        });
      }
    }
    return models;
  }

  getStatus() {
    const providers = {};
    for (const [id, info] of this.health) {
      const provider = this.providers.get(id);
      const tokenStats = this.db?.getTokenStats(id) || [];
      providers[id] = {
        name: provider?.name,
        ...info,
        tokens: tokenStats
      };
    }

    const usage = this.db?.getUsageSummary(30) || [];
    const dailyUsage = this.db?.getDailyUsage(7) || [];
    const tokenMgrStatus = this.tokenManager?.getStatus() || {};

    return {
      status: 'online',
      providers,
      usage,
      dailyUsage,
      tokenManager: tokenMgrStatus,
      uptime: process.uptime()
    };
  }

  // ─── Request Execution ─────────────────────────────────────────────────

  async _sendRequest(providerId, apiKey, model, messages, options, stream) {
    const provider = this.providers.get(providerId);
    const startTime = Date.now();

    let url, headers, body;

    if (provider.id === 'anthropic') {
      url = `${provider.url}/v1/messages`;
      headers = { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' };
      body = { model, messages: this._convertToAnthropic(messages), max_tokens: options.max_tokens || 4096, stream: false, ...options };
    } else if (provider.id === 'gemini') {
      url = `${provider.url}/models/${model}:generateContent`;
      headers = { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey };
      body = { contents: this._convertToGemini(messages), generationConfig: { maxOutputTokens: options.max_tokens || 4096, temperature: options.temperature || 0.7 } };
    } else {
      url = `${provider.url}/chat/completions`;
      headers = { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` };
      body = { model, messages, stream: false, ...options };
    }

    const response = await axios.post(url, body, { headers, timeout: this.timeout, validateStatus: (s) => s < 500 });
    const duration = Date.now() - startTime;

    if (response.status >= 400) {
      const err = new Error(`Provider error ${response.status}: ${JSON.stringify(response.data)}`);
      err.response = response;
      throw err;
    }

    return this._normalizeResponse(response.data, providerId, model, duration);
  }

  _normalizeResponse(data, providerId, model, duration) {
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
    if (data.content) {
      return {
        ok: true, content: data.content.map(c => c.text || '').join(''),
        model: data.model || model, provider: providerId,
        usage: { prompt_tokens: data.usage?.input_tokens || 0, completion_tokens: data.usage?.output_tokens || 0, total_tokens: (data.usage?.input_tokens || 0) + (data.usage?.output_tokens || 0) },
        duration, raw: data
      };
    }
    if (data.candidates) {
      return {
        ok: true, content: data.candidates[0]?.content?.parts?.map(p => p.text).join('') || '',
        model, provider: providerId,
        usage: { prompt_tokens: data.usageMetadata?.promptTokenCount || 0, completion_tokens: data.usageMetadata?.candidatesTokenCount || 0, total_tokens: data.usageMetadata?.totalTokenCount || 0 },
        duration, raw: data
      };
    }
    return { ok: true, content: typeof data === 'string' ? data : JSON.stringify(data), model, provider: providerId, usage: { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 }, duration, raw: data };
  }

  _convertToAnthropic(messages) {
    return messages.filter(m => m.role !== 'system').map(m => ({ role: m.role === 'assistant' ? 'assistant' : 'user', content: m.content }));
  }

  _convertToGemini(messages) {
    return messages.map(m => ({ role: m.role === 'assistant' ? 'model' : 'user', parts: [{ text: m.content }] }));
  }

  _estimateCost(providerId, usage) {
    const provider = this.providers.get(providerId);
    if (!provider?.costPerToken || !usage) return 0;
    const prompt = (usage.prompt_tokens || 0) * provider.costPerToken.input;
    const completion = (usage.completion_tokens || 0) * provider.costPerToken.output;
    return prompt + completion;
  }

  // ─── Provider Routing ──────────────────────────────────────────────────

  _findProvidersForModel(model, preferProvider) {
    const candidates = [];
    if (preferProvider) {
      const p = this.providers.get(preferProvider);
      if (p?.models.some(m => m.toLowerCase() === model.toLowerCase())) candidates.push(preferProvider);
    }
    for (const [id, provider] of this.providers) {
      if (id === preferProvider) continue;
      if (provider.models.some(m => m.toLowerCase() === model.toLowerCase())) candidates.push(id);
    }
    return candidates;
  }

  _rankProviders(providerIds) {
    // Prioritize providers with active tokens
    return providerIds.sort((a, b) => {
      const aTokens = this.db?.getActiveTokens(a)?.length || 0;
      const bTokens = this.db?.getActiveTokens(b)?.length || 0;
      if (aTokens > 0 && bTokens === 0) return -1;
      if (bTokens > 0 && aTokens === 0) return 1;

      const ha = this.health.get(a) || {};
      const hb = this.health.get(b) || {};
      const scoreA = (ha.successRate || 0) - (ha.avgLatency || 0) / 10000;
      const scoreB = (hb.successRate || 0) - (hb.avgLatency || 0) / 10000;
      return scoreB - scoreA;
    });
  }

  _recordSuccess(providerId, duration) {
    const h = this.health.get(providerId);
    if (!h) return;
    h.status = 'healthy'; h.lastCheck = Date.now(); h.failures = 0; h.totalRequests++;
    h.avgLatency = h.avgLatency === 0 ? duration : (h.avgLatency * 0.8) + (duration * 0.2);
    h.successRate = h.totalRequests > 0 ? 1 - (h.failures / h.totalRequests) : 1.0;
  }

  _recordFailure(providerId, error) {
    const h = this.health.get(providerId);
    if (!h) return;
    h.lastCheck = Date.now(); h.failures++; h.totalRequests++;
    h.successRate = h.totalRequests > 0 ? 1 - (h.failures / h.totalRequests) : 0;
    if (h.failures >= 5) h.status = 'degraded';
  }

  _log(...args) { console.log('[GATEWAY-DB]', ...args); }
}

// Singleton
let _gateway = null;

export async function getGateway(config) {
  if (!_gateway) {
    _gateway = new AIGatewayDB(config);
    await _gateway.init();
  }
  return _gateway;
}

export default AIGatewayDB;
