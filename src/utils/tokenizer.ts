/**
 * Tokenizer Utilities
 * Functions for estimating token counts in text
 */

/**
 * Content type for token estimation
 */
export type ContentType = 'english' | 'code' | 'json' | 'mixed';

/**
 * Characters per token ratio by content type
 */
const CHARS_PER_TOKEN: Record<ContentType, number> = {
  english: 4.0,
  code: 3.5,
  json: 3.0,
  mixed: 3.5,
};

/**
 * Estimate token count for a string
 * @param text - Text to estimate tokens for
 * @param contentType - Type of content for more accurate estimation
 * @returns Estimated token count
 */
export const estimateTokens = (text: string | null | undefined, contentType: ContentType = 'mixed'): number => {
  if (!text || typeof text !== 'string') return 0;
  
  const ratio = CHARS_PER_TOKEN[contentType];
  return Math.ceil(text.length / ratio);
};

/**
 * Message structure for token estimation
 */
export interface Message {
  role: string;
  content: string | null;
}

/**
 * Estimate tokens for an array of messages
 * @param messages - Array of messages
 * @returns Total estimated tokens
 */
export const estimateMessagesTokens = (messages: Message[]): number => {
  if (!Array.isArray(messages)) return 0;
  
  let total = 0;
  
  messages.forEach(msg => {
    // Add overhead for each message (role, formatting)
    total += 4;
    
    // Add content tokens
    if (msg.content) {
      total += estimateTokens(msg.content, 'mixed');
    }
  });
  
  // Add conversation overhead
  total += 3;
  
  return total;
};

/**
 * Request estimation parameters
 */
export interface RequestEstimateParams {
  systemPrompt?: string | null;
  userMessage?: string | null;
  previousMessages?: Message[];
  jsonSchema?: unknown;
}

/**
 * Estimate total tokens for an API request
 * @param params - Request parameters
 * @returns Estimated total tokens
 */
export const estimateRequestTokens = ({
  systemPrompt,
  userMessage,
  previousMessages = [],
  jsonSchema,
}: RequestEstimateParams): number => {
  let total = 0;
  
  // System prompt
  if (systemPrompt) {
    total += estimateTokens(systemPrompt, 'mixed') + 4;
  }
  
  // Previous messages
  total += estimateMessagesTokens(previousMessages);
  
  // Current user message
  if (userMessage) {
    total += estimateTokens(userMessage, 'mixed') + 4;
  }
  
  // JSON schema overhead
  if (jsonSchema) {
    const schemaStr = JSON.stringify(jsonSchema);
    total += estimateTokens(schemaStr, 'json');
  }
  
  return total;
};

/**
 * Format a token count for display
 * @param tokens - Token count
 * @returns Formatted string (e.g., "2.4K", "150")
 */
export const formatTokenCount = (tokens: number): string => {
  if (tokens < 1000) return tokens.toString();
  if (tokens < 10000) return `${(tokens / 1000).toFixed(1)}K`;
  if (tokens < 1000000) return `${Math.round(tokens / 1000)}K`;
  return `${(tokens / 1000000).toFixed(1)}M`;
};

/**
 * Calculate context window usage percentage
 * @param usedTokens - Tokens used
 * @param contextWindow - Total context window size
 * @returns Usage percentage (0-100)
 */
export const calculateContextUsage = (usedTokens: number, contextWindow: number): number => {
  if (contextWindow <= 0) return 0;
  return Math.min(100, (usedTokens / contextWindow) * 100);
};

/**
 * Model context window sizes
 */
const MODEL_CONTEXT_WINDOWS: Record<string, number> = {
  // GPT-4 family
  'gpt-4o': 128000,
  'gpt-4o-mini': 128000,
  'gpt-4-turbo': 128000,
  'gpt-4': 8192,
  'gpt-4-32k': 32768,
  
  // GPT-3.5 family
  'gpt-3.5-turbo': 16385,
  'gpt-3.5-turbo-16k': 16385,
  
  // o1 family
  'o1-preview': 128000,
  'o1-mini': 128000,
  'o1': 200000,
  'o3-mini': 200000,
  
  // Claude family
  'claude-3-opus': 200000,
  'claude-3-sonnet': 200000,
  'claude-3-haiku': 200000,
  'claude-3.5-sonnet': 200000,
  
  // Gemini family
  'gemini-1.5-pro': 1000000,
  'gemini-1.5-flash': 1000000,
  
  // Default
  'default': 128000,
};

/**
 * Get context window size for a model
 * @param modelId - Model identifier
 * @returns Context window size in tokens
 */
export const getModelContextWindow = (modelId: string): number => {
  // Direct match
  if (MODEL_CONTEXT_WINDOWS[modelId]) {
    return MODEL_CONTEXT_WINDOWS[modelId];
  }
  
  // Prefix match
  const normalizedId = modelId.toLowerCase();
  for (const [key, size] of Object.entries(MODEL_CONTEXT_WINDOWS)) {
    if (normalizedId.startsWith(key.toLowerCase())) {
      return size;
    }
  }
  
  return MODEL_CONTEXT_WINDOWS['default'];
};

/**
 * Check if request would exceed context window
 * @param estimatedTokens - Estimated tokens for request
 * @param modelId - Model being used
 * @param reserveForOutput - Tokens to reserve for output (default: 4096)
 * @returns True if request would exceed limits
 */
export const wouldExceedContext = (
  estimatedTokens: number,
  modelId: string,
  reserveForOutput: number = 4096
): boolean => {
  const contextWindow = getModelContextWindow(modelId);
  return estimatedTokens > (contextWindow - reserveForOutput);
};

export default {
  estimateTokens,
  estimateMessagesTokens,
  estimateRequestTokens,
  formatTokenCount,
  calculateContextUsage,
  getModelContextWindow,
  wouldExceedContext,
};
