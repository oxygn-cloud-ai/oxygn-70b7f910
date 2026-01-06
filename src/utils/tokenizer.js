/**
 * Simple token estimator for pre-flight input size estimation.
 * Uses character-based heuristics (roughly 4 chars per token for English text).
 * 
 * For accurate counts, we'd need tiktoken/gpt-tokenizer, but this provides
 * good enough estimates for dashboard display without adding 2MB+ to bundle.
 */

// Average characters per token by content type
const CHARS_PER_TOKEN = {
  english: 4,      // ~4 chars per token for English prose
  code: 3.5,       // Code tends to have more tokens (symbols, whitespace)
  json: 3,         // JSON has lots of brackets and quotes
  mixed: 3.75,     // Default for mixed content
};

/**
 * Estimate token count for a string
 * @param {string} text - The text to estimate
 * @param {string} contentType - 'english' | 'code' | 'json' | 'mixed'
 * @returns {number} Estimated token count
 */
export function estimateTokens(text, contentType = 'mixed') {
  if (!text || typeof text !== 'string') return 0;
  
  const charsPerToken = CHARS_PER_TOKEN[contentType] || CHARS_PER_TOKEN.mixed;
  return Math.ceil(text.length / charsPerToken);
}

/**
 * Estimate tokens for a messages array (OpenAI format)
 * Each message has overhead of ~4 tokens for role/formatting
 * @param {Array} messages - Array of {role, content} objects
 * @returns {number} Estimated total tokens
 */
export function estimateMessagesTokens(messages) {
  if (!Array.isArray(messages)) return 0;
  
  const MESSAGE_OVERHEAD = 4; // Tokens for role, separators
  
  return messages.reduce((total, msg) => {
    const contentTokens = estimateTokens(msg.content || '', 'mixed');
    return total + contentTokens + MESSAGE_OVERHEAD;
  }, 0);
}

/**
 * Estimate tokens for a complete API request
 * Includes system prompt, messages, and any additional context
 * @param {Object} params
 * @param {string} params.systemPrompt - System instructions
 * @param {string} params.userMessage - Current user message
 * @param {Array} params.previousMessages - Previous conversation messages
 * @param {Object} params.jsonSchema - JSON schema if structured output
 * @returns {number} Estimated total input tokens
 */
export function estimateRequestTokens({ 
  systemPrompt = '', 
  userMessage = '', 
  previousMessages = [],
  jsonSchema = null,
}) {
  let total = 0;
  
  // System prompt (usually code/structured content)
  if (systemPrompt) {
    total += estimateTokens(systemPrompt, 'mixed') + 4;
  }
  
  // Previous messages
  total += estimateMessagesTokens(previousMessages);
  
  // Current user message
  if (userMessage) {
    total += estimateTokens(userMessage, 'english') + 4;
  }
  
  // JSON schema overhead (if structured output)
  if (jsonSchema) {
    total += estimateTokens(JSON.stringify(jsonSchema), 'json');
  }
  
  // Add ~3% buffer for tokenizer differences
  return Math.ceil(total * 1.03);
}

/**
 * Format token count for display
 * @param {number} tokens - Token count
 * @returns {string} Formatted string (e.g., "2.4K", "150")
 */
export function formatTokenCount(tokens) {
  if (!tokens || tokens < 0) return '0';
  if (tokens >= 1000000) {
    return (tokens / 1000000).toFixed(1) + 'M';
  }
  if (tokens >= 1000) {
    return (tokens / 1000).toFixed(1) + 'K';
  }
  return String(Math.round(tokens));
}

/**
 * Calculate context window usage percentage
 * @param {number} usedTokens - Tokens used
 * @param {number} contextWindow - Model's context window size
 * @returns {number} Percentage (0-100)
 */
export function calculateContextUsage(usedTokens, contextWindow) {
  if (!contextWindow || contextWindow <= 0) return 0;
  return Math.min(100, Math.round((usedTokens / contextWindow) * 100));
}

/**
 * Get context window for a model
 * @param {string} modelId - Model identifier
 * @returns {number} Context window size in tokens
 */
export function getModelContextWindow(modelId) {
  if (!modelId) return 128000;
  
  const id = modelId.toLowerCase();
  
  // GPT-4o and variants
  if (id.includes('gpt-4o')) return 128000;
  
  // GPT-5 / o-series
  if (id.includes('gpt-5') || id.includes('o3') || id.includes('o1')) return 200000;
  
  // GPT-4 Turbo
  if (id.includes('gpt-4-turbo') || id.includes('gpt-4-1106')) return 128000;
  
  // GPT-4 (original)
  if (id.includes('gpt-4-32k')) return 32768;
  if (id.includes('gpt-4')) return 8192;
  
  // GPT-3.5
  if (id.includes('gpt-3.5-turbo-16k')) return 16384;
  if (id.includes('gpt-3.5')) return 4096;
  
  // Claude models
  if (id.includes('claude-3')) return 200000;
  if (id.includes('claude-2')) return 100000;
  
  // Default to 128k for unknown models
  return 128000;
}
