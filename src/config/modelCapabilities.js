// Model capabilities configuration
// Defines which settings each model/provider supports

export const MODEL_CAPABILITIES = {
  // OpenAI models
  openai: {
    default: ['temperature', 'max_tokens', 'top_p', 'frequency_penalty', 'presence_penalty', 'stop', 'n', 'stream', 'response_format', 'logit_bias', 'o_user', 'web_search'],
    'gpt-4': ['temperature', 'max_tokens', 'top_p', 'frequency_penalty', 'presence_penalty', 'stop', 'n', 'stream', 'response_format', 'logit_bias', 'o_user', 'web_search'],
    'gpt-4o': ['temperature', 'max_tokens', 'top_p', 'frequency_penalty', 'presence_penalty', 'stop', 'n', 'stream', 'response_format', 'logit_bias', 'o_user', 'web_search'],
    'gpt-4o-mini': ['temperature', 'max_tokens', 'top_p', 'frequency_penalty', 'presence_penalty', 'stop', 'n', 'stream', 'response_format', 'logit_bias', 'o_user', 'web_search'],
    'gpt-5': ['max_tokens', 'top_p', 'frequency_penalty', 'presence_penalty', 'stop', 'n', 'stream', 'response_format', 'logit_bias', 'o_user', 'web_search'],
    'gpt-5-mini': ['max_tokens', 'top_p', 'frequency_penalty', 'presence_penalty', 'stop', 'n', 'stream', 'response_format', 'logit_bias', 'o_user', 'web_search'],
    'gpt-5.2': ['max_tokens', 'top_p', 'frequency_penalty', 'presence_penalty', 'stop', 'n', 'stream', 'response_format', 'logit_bias', 'o_user', 'web_search'],
    'gpt-5.2-pro': ['max_tokens', 'top_p', 'frequency_penalty', 'presence_penalty', 'stop', 'n', 'stream', 'response_format', 'logit_bias', 'o_user', 'web_search'],
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
    default: ['temperature', 'max_tokens', 'top_p', 'frequency_penalty', 'presence_penalty', 'stop', 'n', 'stream', 'response_format', 'logit_bias', 'o_user'],
  }
};

// All possible settings with their labels, descriptions, and documentation links
export const ALL_SETTINGS = {
  temperature: { 
    label: 'Temperature', 
    description: 'Controls randomness (0-2)',
    details: 'Higher values like 0.8 make output more random, while lower values like 0.2 make it more focused and deterministic. Use lower values for factual/analytical tasks, higher for creative tasks.',
    docUrl: 'https://platform.openai.com/docs/api-reference/chat/create#chat-create-temperature'
  },
  max_tokens: { 
    label: 'Max Tokens', 
    description: 'Maximum response length',
    details: 'The maximum number of tokens to generate. One token is roughly 4 characters for English text. The total tokens (prompt + completion) cannot exceed the model\'s context length.',
    docUrl: 'https://platform.openai.com/docs/api-reference/chat/create#chat-create-max_tokens'
  },
  top_p: { 
    label: 'Top P', 
    description: 'Nucleus sampling (0-1)',
    details: 'An alternative to temperature. The model considers tokens with top_p probability mass. 0.1 means only tokens in the top 10% probability are considered. Generally, alter this or temperature, not both.',
    docUrl: 'https://platform.openai.com/docs/api-reference/chat/create#chat-create-top_p'
  },
  frequency_penalty: { 
    label: 'Frequency Penalty', 
    description: 'Reduces repetition (0-2)',
    details: 'Positive values penalize tokens based on how frequently they appear in the text so far, decreasing the likelihood of repeating the same content verbatim.',
    docUrl: 'https://platform.openai.com/docs/api-reference/chat/create#chat-create-frequency_penalty'
  },
  presence_penalty: { 
    label: 'Presence Penalty', 
    description: 'Encourages new topics (0-2)',
    details: 'Positive values penalize tokens based on whether they appear in the text so far, increasing the likelihood of talking about new topics.',
    docUrl: 'https://platform.openai.com/docs/api-reference/chat/create#chat-create-presence_penalty'
  },
  stop: { 
    label: 'Stop Sequences', 
    description: 'Sequences where API stops',
    details: 'Up to 4 sequences where the API will stop generating further tokens. The returned text will not contain the stop sequence.',
    docUrl: 'https://platform.openai.com/docs/api-reference/chat/create#chat-create-stop'
  },
  n: { 
    label: 'N', 
    description: 'Number of completions',
    details: 'How many chat completion choices to generate for each input message. Note: generating multiple completions uses more tokens and costs more.',
    docUrl: 'https://platform.openai.com/docs/api-reference/chat/create#chat-create-n'
  },
  stream: { 
    label: 'Stream', 
    description: 'Stream responses',
    details: 'If set, partial message deltas will be sent as server-sent events. Tokens will be sent as they become available, with the stream terminated by a data: [DONE] message.',
    docUrl: 'https://platform.openai.com/docs/api-reference/chat/create#chat-create-stream'
  },
  response_format: { 
    label: 'Response Format', 
    description: 'Output format (e.g., JSON)',
    details: 'Specifies the format the model must output. Use {"type": "json_object"} for JSON mode, which guarantees valid JSON output. Must also instruct the model to produce JSON in your prompt.',
    docUrl: 'https://platform.openai.com/docs/api-reference/chat/create#chat-create-response_format'
  },
  logit_bias: { 
    label: 'Logit Bias', 
    description: 'Token probability adjustments',
    details: 'Modify the likelihood of specified tokens appearing in the completion. Maps token IDs to bias values from -100 to 100. Use tokenizer tool to convert text to token IDs.',
    docUrl: 'https://platform.openai.com/docs/api-reference/chat/create#chat-create-logit_bias'
  },
  o_user: { 
    label: 'User ID', 
    description: 'End-user identifier',
    details: 'A unique identifier representing your end-user, which helps OpenAI monitor and detect abuse. Should not contain PII.',
    docUrl: 'https://platform.openai.com/docs/api-reference/chat/create#chat-create-user'
  },
  web_search: { 
    label: 'Web Search', 
    description: 'Enable real-time web search',
    details: 'When enabled, the AI can search the web for current information to provide up-to-date answers. Responses will include citations to sources. Best for questions about recent events or current data.',
    docUrl: 'https://platform.openai.com/docs/guides/tools-web-search'
  },
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
