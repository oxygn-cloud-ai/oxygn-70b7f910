/**
 * Cost estimation utilities for API calls.
 * Prices are per 1M tokens.
 */

// Default pricing (per 1M tokens) - updated regularly
const MODEL_PRICING = {
  // GPT-4o
  'gpt-4o': { input: 2.50, output: 10.00 },
  'gpt-4o-2024-11-20': { input: 2.50, output: 10.00 },
  'gpt-4o-2024-08-06': { input: 2.50, output: 10.00 },
  'gpt-4o-mini': { input: 0.15, output: 0.60 },
  'gpt-4o-mini-2024-07-18': { input: 0.15, output: 0.60 },
  
  // GPT-5 / o-series (reasoning models)
  'gpt-5': { input: 5.00, output: 15.00 },
  'o3': { input: 10.00, output: 40.00 },
  'o3-mini': { input: 1.10, output: 4.40 },
  'o1': { input: 15.00, output: 60.00 },
  'o1-mini': { input: 3.00, output: 12.00 },
  'o1-preview': { input: 15.00, output: 60.00 },
  
  // GPT-4 Turbo
  'gpt-4-turbo': { input: 10.00, output: 30.00 },
  'gpt-4-turbo-preview': { input: 10.00, output: 30.00 },
  'gpt-4-1106-preview': { input: 10.00, output: 30.00 },
  
  // GPT-4
  'gpt-4': { input: 30.00, output: 60.00 },
  'gpt-4-32k': { input: 60.00, output: 120.00 },
  
  // GPT-3.5
  'gpt-3.5-turbo': { input: 0.50, output: 1.50 },
  'gpt-3.5-turbo-16k': { input: 3.00, output: 4.00 },
  
  // GPT-4o variants
  'gpt-4o-audio-preview': { input: 2.50, output: 10.00 },
  'gpt-4-vision-preview': { input: 10.00, output: 30.00 },
  'chatgpt-4o-latest': { input: 2.50, output: 10.00 },
  
  // Claude models (for future use)
  'claude-3-opus': { input: 15.00, output: 75.00 },
  'claude-3-sonnet': { input: 3.00, output: 15.00 },
  'claude-3-haiku': { input: 0.25, output: 1.25 },
  'claude-3.5-sonnet': { input: 3.00, output: 15.00 },
  
  // Default for unknown models
  'default': { input: 2.50, output: 10.00 },
};

/**
 * Get pricing for a model
 * @param {string} modelId - Model identifier
 * @returns {{ input: number, output: number }} Prices per 1M tokens
 */
export function getModelPricing(modelId) {
  if (!modelId) return MODEL_PRICING.default;
  
  const id = modelId.toLowerCase();
  
  // Try exact match first
  if (MODEL_PRICING[id]) return MODEL_PRICING[id];
  
  // Try prefix matching for versioned models
  for (const [key, pricing] of Object.entries(MODEL_PRICING)) {
    if (id.startsWith(key) || key.startsWith(id)) {
      return pricing;
    }
  }
  
  return MODEL_PRICING.default;
}

/**
 * Estimate cost for a call
 * @param {Object} params
 * @param {string} params.model - Model identifier
 * @param {number} params.inputTokens - Input token count
 * @param {number} params.outputTokens - Output token count
 * @returns {number} Estimated cost in USD
 */
export function estimateCost({ model, inputTokens = 0, outputTokens = 0 }) {
  const pricing = getModelPricing(model);
  
  const inputCost = (inputTokens / 1000000) * pricing.input;
  const outputCost = (outputTokens / 1000000) * pricing.output;
  
  return inputCost + outputCost;
}

/**
 * Format cost for display
 * @param {number} cost - Cost in USD
 * @returns {string} Formatted cost string
 */
export function formatCost(cost) {
  if (!cost || cost < 0) return '$0.00';
  if (cost < 0.001) return '<$0.001';
  if (cost < 0.01) return `$${cost.toFixed(4)}`;
  if (cost < 1) return `$${cost.toFixed(3)}`;
  return `$${cost.toFixed(2)}`;
}

/**
 * Format tokens per second for display
 * @param {number} tokensPerSecond - Tokens per second
 * @returns {string} Formatted string
 */
export function formatTokensPerSecond(tokensPerSecond) {
  if (!tokensPerSecond || tokensPerSecond < 0) return '0';
  if (tokensPerSecond < 1) return '<1';
  return Math.round(tokensPerSecond).toString();
}

/**
 * Calculate tokens per second from timing data
 * @param {number} tokenCount - Number of tokens generated
 * @param {number} firstTokenAt - Timestamp of first token (ms)
 * @param {number} lastTokenAt - Timestamp of last token (ms)
 * @returns {number} Tokens per second
 */
export function calculateTokensPerSecond(tokenCount, firstTokenAt, lastTokenAt) {
  if (!tokenCount || !firstTokenAt || !lastTokenAt) return 0;
  
  const durationMs = lastTokenAt - firstTokenAt;
  if (durationMs <= 0) return 0;
  
  const durationSeconds = durationMs / 1000;
  return tokenCount / durationSeconds;
}
