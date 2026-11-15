/**
 * Coarena AI API Routes
 * Provides endpoints for chat completions, health checks, and model listing
 */

const { parseBody, sendJson } = require('./utils.js');
const { getClient } = require('../src/coarena.js');

let coarenaClient = null;

function getCoarenaClient() {
  if (!coarenaClient) {
    coarenaClient = getClient();
  }
  return coarenaClient;
}

/**
 * Handle Coarena API routes
 * @param {http.IncomingMessage} req
 * @param {http.ServerResponse} res
 * @param {URL} u
 * @returns {Promise<boolean>} - true if route was handled
 */
async function handleCoarenaRoutes(req, res, u) {
  // Health check endpoint
  if (u.pathname === '/api/coarena/health' && req.method === 'GET') {
    try {
      const health = await getCoarenaClient().healthCheck();
      sendJson(res, health.ok ? 200 : 503, health);
    } catch (error) {
      sendJson(res, 503, {
        ok: false,
        error: error.message,
        timestamp: new Date().toISOString(),
      });
    }
    return true;
  }

  // List available models
  if (u.pathname === '/api/coarena/models' && req.method === 'GET') {
    try {
      const models = await getCoarenaClient().listModels();
      sendJson(res, 200, models);
    } catch (error) {
      sendJson(res, 500, { error: error.message });
    }
    return true;
  }

  // OpenAI-compatible chat completions
  if (u.pathname === '/api/coarena/chat/completions' && req.method === 'POST') {
    try {
      const body = await parseBody(req);
      const { messages, model, temperature, max_tokens, top_p, stream, ...extra } = body;

      if (!messages || !Array.isArray(messages) || messages.length === 0) {
        sendJson(res, 400, { error: 'messages array is required' });
        return true;
      }

      const result = await getCoarenaClient().chatCompletion(messages, {
        model,
        temperature,
        maxTokens: max_tokens,
        topP: top_p,
        stream,
        extra,
      });

      sendJson(res, 200, result);
    } catch (error) {
      sendJson(res, error.statusCode || 500, { error: error.message });
    }
    return true;
  }

  // Anthropic-compatible messages
  if (u.pathname === '/api/coarena/messages' && req.method === 'POST') {
    try {
      const body = await parseBody(req);
      const { messages, model, temperature, max_tokens, top_p, stream, system, ...extra } = body;

      if (!messages || !Array.isArray(messages) || messages.length === 0) {
        sendJson(res, 400, { error: 'messages array is required' });
        return true;
      }

      // Add system message if provided
      const messagesWithSystem = system
        ? [{ role: 'system', content: system }, ...messages]
        : messages;

      const result = await getCoarenaClient().anthropicMessage(messagesWithSystem, {
        model,
        temperature,
        maxTokens: max_tokens,
        topP: top_p,
        stream,
        extra,
      });

      sendJson(res, 200, result);
    } catch (error) {
      sendJson(res, error.statusCode || 500, { error: error.message });
    }
    return true;
  }

  // Simple chat helper endpoint
  if (u.pathname === '/api/coarena/chat' && req.method === 'POST') {
    try {
      const body = await parseBody(req);
      const { message, systemPrompt, model, temperature, max_tokens, ...extra } = body;

      if (!message || typeof message !== 'string') {
        sendJson(res, 400, { error: 'message string is required' });
        return true;
      }

      const result = await getCoarenaClient().chat(message, systemPrompt, {
        model,
        temperature,
        maxTokens: max_tokens,
        extra,
      });

      sendJson(res, 200, result);
    } catch (error) {
      sendJson(res, error.statusCode || 500, { error: error.message });
    }
    return true;
  }

  // Get current configuration (without API key)
  if (u.pathname === '/api/coarena/config' && req.method === 'GET') {
    const client = getCoarenaClient();
    sendJson(res, 200, {
      model: client.model,
      openaiBaseUrl: client.openaiBaseUrl,
      anthropicBaseUrl: client.anthropicBaseUrl,
      timeout: client.timeout,
      maxRetries: client.maxRetries,
      hasApiKey: !!client.apiKey,
    });
    return true;
  }

  return false;
}

module.exports = { handleCoarenaRoutes };