/**
 * Cost Estimator Utilities
 * Functions for estimating and formatting API call costs
 */

import type { ModelPricing } from '@/types/api.types';

/**
 * Model pricing table (cost per 1M tokens)
 */
export const MODEL_PRICING: Record<string, ModelPricing> = {
  // OpenAI GPT-4 family
  'gpt-4o': { input: 2.50, output: 10.00 },
  'gpt-4o-mini': { input: 0.15, output: 0.60 },
  'gpt-4-turbo': { input: 10.00, output: 30.00 },
  'gpt-4': { input: 30.00, output: 60.00 },
  'gpt-4-32k': { input: 60.00, output: 120.00 },
  
  // OpenAI GPT-3.5 family
  'gpt-3.5-turbo': { input: 0.50, output: 1.50 },
  'gpt-3.5-turbo-16k': { input: 3.00, output: 4.00 },
  
  // OpenAI o1 family
  'o1-preview': { input: 15.00, output: 60.00 },
  'o1-mini': { input: 3.00, output: 12.00 },
  'o1': { input: 15.00, output: 60.00 },
  'o3-mini': { input: 1.10, output: 4.40 },
  
  // Anthropic Claude family
  'claude-3-opus': { input: 15.00, output: 75.00 },
  'claude-3-sonnet': { input: 3.00, output: 15.00 },
  'claude-3-haiku': { input: 0.25, output: 1.25 },
  'claude-3.5-sonnet': { input: 3.00, output: 15.00 },
  'claude-3.5-haiku': { input: 0.80, output: 4.00 },
  
  // Google Gemini family
  'gemini-1.5-pro': { input: 1.25, output: 5.00 },
  'gemini-1.5-flash': { input: 0.075, output: 0.30 },
  'gemini-2.0-flash': { input: 0.10, output: 0.40 },
  
  // Manus
  'manus': { input: 0.00, output: 0.00 },
  
  // Default fallback
  'default': { input: 2.50, output: 10.00 },
};

/**
 * Get pricing for a model
 * @param modelId - Model identifier
 * @returns Pricing object with input and output costs per 1M tokens
 */
export const getModelPricing = (modelId: string): ModelPricing => {
  // Direct match
  if (MODEL_PRICING[modelId]) {
    return MODEL_PRICING[modelId];
  }
  
  // Try prefix matching (e.g., 'gpt-4o-2024-05-13' matches 'gpt-4o')
  const normalizedId = modelId.toLowerCase();
  for (const [key, pricing] of Object.entries(MODEL_PRICING)) {
    if (normalizedId.startsWith(key.toLowerCase())) {
      return pricing;
    }
  }
  
  // Return default pricing
  return MODEL_PRICING['default'];
};

/**
 * Estimate cost of an API call
 */
export interface CostEstimateParams {
  model: string;
  inputTokens: number;
  outputTokens: number;
}

/**
 * Estimate the cost of an API call
 * @param params - Cost estimation parameters
 * @returns Estimated cost in USD
 */
export const estimateCost = ({ model, inputTokens, outputTokens }: CostEstimateParams): number => {
  const pricing = getModelPricing(model);
  
  // Convert from per-million to actual cost
  const inputCost = (inputTokens / 1_000_000) * pricing.input;
  const outputCost = (outputTokens / 1_000_000) * pricing.output;
  
  return inputCost + outputCost;
};

/**
 * Format a cost value for display
 * @param cost - Cost in USD
 * @returns Formatted cost string
 */
export const formatCost = (cost: number): string => {
  if (cost === 0) return '$0.00';
  if (cost < 0.001) return '<$0.001';
  if (cost < 0.01) return `$${cost.toFixed(4)}`;
  if (cost < 1) return `$${cost.toFixed(3)}`;
  return `$${cost.toFixed(2)}`;
};

/**
 * Format tokens per second
 * @param tokensPerSecond - Rate of token generation
 * @returns Formatted string
 */
export const formatTokensPerSecond = (tokensPerSecond: number): string => {
  if (tokensPerSecond < 1) return '<1 tok/s';
  if (tokensPerSecond < 10) return `${tokensPerSecond.toFixed(1)} tok/s`;
  return `${Math.round(tokensPerSecond)} tok/s`;
};

/**
 * Calculate tokens per second from timing data
 * @param tokenCount - Number of tokens generated
 * @param firstTokenAt - Timestamp of first token
 * @param lastTokenAt - Timestamp of last token
 * @returns Tokens per second
 */
export const calculateTokensPerSecond = (
  tokenCount: number,
  firstTokenAt: number,
  lastTokenAt: number
): number => {
  const durationSeconds = (lastTokenAt - firstTokenAt) / 1000;
  if (durationSeconds <= 0 || tokenCount <= 0) return 0;
  return tokenCount / durationSeconds;
};

/**
 * Format token count for display
 * @param tokens - Number of tokens
 * @returns Formatted string
 */
export const formatTokenCount = (tokens: number): string => {
  if (tokens < 1000) return tokens.toString();
  if (tokens < 10000) return `${(tokens / 1000).toFixed(1)}K`;
  if (tokens < 1000000) return `${Math.round(tokens / 1000)}K`;
  return `${(tokens / 1000000).toFixed(1)}M`;
};

/**
 * Calculate cumulative cost from multiple calls
 * @param calls - Array of cost parameters
 * @returns Total cost in USD
 */
export const calculateCumulativeCost = (calls: CostEstimateParams[]): number => {
  return calls.reduce((total, call) => total + estimateCost(call), 0);
};

export default {
  MODEL_PRICING,
  getModelPricing,
  estimateCost,
  formatCost,
  formatTokensPerSecond,
  calculateTokensPerSecond,
  formatTokenCount,
  calculateCumulativeCost,
};
