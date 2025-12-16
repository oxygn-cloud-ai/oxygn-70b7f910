// Model capabilities configuration
// Defines which settings each model/provider supports

export const MODEL_CAPABILITIES = {
  // OpenAI models
  openai: {
    default: ['temperature', 'max_tokens', 'top_p', 'frequency_penalty', 'presence_penalty', 'stop', 'n', 'stream', 'response_format', 'logit_bias', 'o_user'],
    'gpt-4': ['temperature', 'max_tokens', 'top_p', 'frequency_penalty', 'presence_penalty', 'stop', 'n', 'stream', 'response_format', 'logit_bias', 'o_user'],
    'gpt-4o': ['temperature', 'max_tokens', 'top_p', 'frequency_penalty', 'presence_penalty', 'stop', 'n', 'stream', 'response_format', 'logit_bias', 'o_user'],
    'gpt-4o-mini': ['temperature', 'max_tokens', 'top_p', 'frequency_penalty', 'presence_penalty', 'stop', 'n', 'stream', 'response_format', 'logit_bias', 'o_user'],
    'gpt-5': ['max_tokens', 'top_p', 'frequency_penalty', 'presence_penalty', 'stop', 'n', 'stream', 'response_format', 'logit_bias', 'o_user'],
    'gpt-5-mini': ['max_tokens', 'top_p', 'frequency_penalty', 'presence_penalty', 'stop', 'n', 'stream', 'response_format', 'logit_bias', 'o_user'],
    'gpt-5.2': ['max_tokens', 'top_p', 'frequency_penalty', 'presence_penalty', 'stop', 'n', 'stream', 'response_format', 'logit_bias', 'o_user'],
    'gpt-5.2-pro': ['max_tokens', 'top_p', 'frequency_penalty', 'presence_penalty', 'stop', 'n', 'stream', 'response_format', 'logit_bias', 'o_user'],
    'o3': ['max_tokens', 'top_p', 'stop', 'stream', 'response_format'],
    'o4-mini': ['max_tokens', 'top_p', 'stop', 'stream', 'response_format'],
  },
  
  // Anthropic models
  anthropic: {
    default: ['temperature', 'max_tokens', 'top_p', 'stop', 'stream'],
    'claude-sonnet-4-5': ['temperature', 'max_tokens', 'top_p', 'stop', 'stream'],
    'claude-opus-4-1': ['temperature', 'max_tokens', 'top_p', 'stop', 'stream'],
    'claude-3-5-sonnet': ['temperature', 'max_tokens', 'top_p', 'stop', 'stream'],
    'claude-3-5-haiku': ['temperature', 'max_tokens', 'top_p', 'stop', 'stream'],
  },
  
  // Google models  
  google: {
    default: ['temperature', 'max_tokens', 'top_p', 'stop', 'stream'],
    'gemini-2.5-pro': ['temperature', 'max_tokens', 'top_p', 'stop', 'stream'],
    'gemini-2.5-flash': ['temperature', 'max_tokens', 'top_p', 'stop', 'stream'],
    'gemini-2.5-flash-lite': ['temperature', 'max_tokens', 'top_p', 'stop', 'stream'],
  },
  
  // Other/custom models - allow all common settings
  other: {
    default: ['temperature', 'max_tokens', 'top_p', 'frequency_penalty', 'presence_penalty', 'stop', 'n', 'stream', 'response_format', 'logit_bias', 'o_user', 'context_length'],
  }
};

// All possible settings with their labels and descriptions
export const ALL_SETTINGS = {
  temperature: { label: 'Temperature', description: 'Controls randomness (0-2)' },
  max_tokens: { label: 'Max Tokens', description: 'Maximum response length' },
  top_p: { label: 'Top P', description: 'Nucleus sampling (0-1)' },
  frequency_penalty: { label: 'Frequency Penalty', description: 'Reduces repetition (0-2)' },
  presence_penalty: { label: 'Presence Penalty', description: 'Encourages new topics (0-2)' },
  stop: { label: 'Stop Sequences', description: 'Sequences where API stops' },
  n: { label: 'N', description: 'Number of completions' },
  stream: { label: 'Stream', description: 'Stream responses' },
  response_format: { label: 'Response Format', description: 'Output format (e.g., JSON)' },
  logit_bias: { label: 'Logit Bias', description: 'Token probability adjustments' },
  o_user: { label: 'User ID', description: 'End-user identifier' },
  context_length: { label: 'Context Length', description: 'Max context window' },
  best_of: { label: 'Best Of', description: 'Server-side generations' },
  logprobs: { label: 'Log Probs', description: 'Log probabilities' },
  echo: { label: 'Echo', description: 'Echo back prompt' },
  suffix: { label: 'Suffix', description: 'Text after completion' },
};

// Get supported settings for a specific model
export const getModelCapabilities = (modelId, provider) => {
  const providerCaps = MODEL_CAPABILITIES[provider?.toLowerCase()] || MODEL_CAPABILITIES.other;
  
  // Try to find exact model match, otherwise use provider default
  const modelKey = Object.keys(providerCaps).find(key => 
    modelId?.toLowerCase().includes(key.toLowerCase())
  );
  
  return providerCaps[modelKey] || providerCaps.default;
};

// Check if a setting is supported for a model
export const isSettingSupported = (setting, modelId, provider) => {
  const capabilities = getModelCapabilities(modelId, provider);
  return capabilities.includes(setting);
};
