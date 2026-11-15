/**
 * Coarena AI Model API Client
 * Supports both OpenAI-compatible and Anthropic-compatible endpoints
 * Free tier available at https://coarena.ai
 */

const https = require('https');
const http = require('http');

class CoarenaClient {
  constructor(options = {}) {
    this.apiKey = options.apiKey || process.env.COARENA_API_KEY || '';
    this.model = options.model || process.env.COARENA_MODEL || 'deepseek-v4-1-flash-1017';
    // Fallback models in order of preference (all free on Coarena)
    this.fallbackModels = options.fallbackModels || [
      'claude-fable-5',
      'gemini-3-8-flash',
      'gpt-6-astra',
      'kimi-k3',
      'glm-5-3-flash',
    ];
    this.openaiBaseUrl = options.openaiBaseUrl || process.env.COARENA_OPENAI_BASE_URL || 'https://coarena.ai/api/v1';
    this.anthropicBaseUrl = options.anthropicBaseUrl || process.env.COARENA_ANTHROPIC_BASE_URL || 'https://coarena.ai/api';
    this.timeout = options.timeout || 60000;
    this.maxRetries = options.maxRetries || 3;
    this.retryDelay = options.retryDelay || 1000;
  }

  /**
   * Make HTTP request with retry logic
   */
  async request(options, payload, retryCount = 0) {
    const url = new URL(options.path, options.baseUrl);
    const isHttps = url.protocol === 'https:';
    const client = isHttps ? https : http;

    const requestOptions = {
      hostname: url.hostname,
      port: url.port || (isHttps ? 443 : 80),
      path: url.pathname + url.search,
      method: options.method || 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`,
        'User-Agent': 'RIZE-Coarena/1.0',
        ...options.headers,
      },
      timeout: this.timeout,
    };

    return new Promise((resolve, reject) => {
      const req = client.request(requestOptions, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          try {
            const parsed = data ? JSON.parse(data) : {};
            if (res.statusCode >= 200 && res.statusCode < 300) {
              resolve(parsed);
            } else {
              const error = new Error(parsed.error?.message || `HTTP ${res.statusCode}: ${data}`);
              error.statusCode = res.statusCode;
              error.response = parsed;
              reject(error);
            }
          } catch (e) {
            if (res.statusCode >= 200 && res.statusCode < 300) {
              resolve(data);
            } else {
              const error = new Error(`HTTP ${res.statusCode}: ${data}`);
              error.statusCode = res.statusCode;
              reject(error);
            }
          }
        });
      });

      req.on('error', (err) => {
        if (retryCount < this.maxRetries && this.isRetryableError(err)) {
          setTimeout(() => {
            this.request(options, payload, retryCount + 1).then(resolve).catch(reject);
          }, this.retryDelay * (retryCount + 1));
        } else {
          reject(err);
        }
      });

      req.on('timeout', () => {
        req.destroy();
        const err = new Error('Request timeout');
        err.code = 'ETIMEDOUT';
        if (retryCount < this.maxRetries) {
          setTimeout(() => {
            this.request(options, payload, retryCount + 1).then(resolve).catch(reject);
          }, this.retryDelay * (retryCount + 1));
        } else {
          reject(err);
        }
      });

      if (payload) {
        req.write(JSON.stringify(payload));
      }
      req.end();
    });
  }

  /**
   * Check if error is retryable
   */
  isRetryableError(err) {
    const retryableCodes = ['ECONNRESET', 'ETIMEDOUT', 'ECONNREFUSED', 'ENOTFOUND', 'ENETUNREACH'];
    return retryableCodes.includes(err.code) || (err.statusCode >= 500 && err.statusCode < 600);
  }

  /**
   * OpenAI-compatible chat completions endpoint
   * POST /v1/chat/completions
   */
  async chatCompletion(messages, options = {}) {
    const payload = {
      model: options.model || this.model,
      messages,
      temperature: options.temperature ?? 0.7,
      max_tokens: options.maxTokens || options.max_tokens || 2048,
      top_p: options.topP ?? 1,
      frequency_penalty: options.frequencyPenalty ?? 0,
      presence_penalty: options.presencePenalty ?? 0,
      stream: options.stream || false,
      ...options.extra,
    };

    return this.requestWithFallback(
      (opts) => this.request({
        baseUrl: this.openaiBaseUrl,
        path: '/chat/completions',
        method: 'POST',
      }, { ...payload, model: opts.model }),
      options
    );
  }

  /**
   * OpenAI-compatible completions endpoint (legacy)
   * POST /v1/completions
   */
  async completion(prompt, options = {}) {
    const payload = {
      model: options.model || this.model,
      prompt,
      temperature: options.temperature ?? 0.7,
      max_tokens: options.maxTokens || options.max_tokens || 2048,
      top_p: options.topP ?? 1,
      frequency_penalty: options.frequencyPenalty ?? 0,
      presence_penalty: options.presencePenalty ?? 0,
      stream: options.stream || false,
      ...options.extra,
    };

    return this.requestWithFallback(
      (opts) => this.request({
        baseUrl: this.openaiBaseUrl,
        path: '/completions',
        method: 'POST',
      }, { ...payload, model: opts.model }),
      options
    );
  }

  /**
   * Anthropic-compatible messages endpoint
   * POST /v1/messages
   */
  async anthropicMessage(messages, options = {}) {
    // Convert OpenAI format to Anthropic format
    const systemMessage = messages.find(m => m.role === 'system');
    const userMessages = messages.filter(m => m.role !== 'system');

    const payload = {
      model: options.model || this.model,
      max_tokens: options.maxTokens || options.max_tokens || 2048,
      temperature: options.temperature ?? 0.7,
      top_p: options.topP ?? 1,
      system: systemMessage?.content || '',
      messages: userMessages.map(m => ({
        role: m.role === 'assistant' ? 'assistant' : 'user',
        content: m.content,
      })),
      stream: options.stream || false,
      ...options.extra,
    };

    return this.requestWithFallback(
      (opts) => this.request({
        baseUrl: this.anthropicBaseUrl,
        path: '/v1/messages',
        method: 'POST',
      }, { ...payload, model: opts.model }),
      options
    );
  }

  /**
   * Get effective model (with fallback if primary is unavailable)
   */
  getEffectiveModel() {
    return this.model;
  }

  /**
   * Try request with fallback models
   */
  async requestWithFallback(requestFn, options = {}) {
    const modelsToTry = [this.model, ...this.fallbackModels.filter(m => m !== this.model)];
    let lastError = null;

    for (const model of modelsToTry) {
      try {
        return await requestFn({ ...options, model });
      } catch (error) {
        lastError = error;
        // If it's a model unavailable error, try next model
        if (error.response?.error?.code === 'model_unavailable' ||
            error.message?.includes('model_unavailable') ||
            error.message?.includes('not available')) {
          console.warn(`[Coarena] Model ${model} unavailable, trying fallback...`);
          continue;
        }
        // For other errors, don't fallback
        throw error;
      }
    }

    throw lastError || new Error('All models unavailable');
  }
  async listModels() {
    return this.request({
      baseUrl: this.openaiBaseUrl,
      path: '/models',
      method: 'GET',
    });
  }

  /**
   * Health check - verify connection works
   */
  async healthCheck() {
    try {
      const models = await this.listModels();
      return {
        ok: true,
        models: models.data?.length || 0,
        model: this.model,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      return {
        ok: false,
        error: error.message,
        timestamp: new Date().toISOString(),
      };
    }
  }

  /**
   * Simple chat helper for quick interactions
   */
  async chat(userMessage, systemPrompt = 'You are a helpful assistant.', options = {}) {
    const messages = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userMessage },
    ];
    return this.chatCompletion(messages, options);
  }
}

// Singleton instance
let defaultClient = null;

/**
 * Get or create default client instance
 */
function getClient(options = {}) {
  if (!defaultClient) {
    defaultClient = new CoarenaClient(options);
  }
  return defaultClient;
}

/**
 * Create a new client instance with custom options
 */
function createClient(options = {}) {
  return new CoarenaClient(options);
}

module.exports = {
  CoarenaClient,
  getClient,
  createClient,
};