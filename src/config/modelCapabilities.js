// Model capabilities configuration
// Defines which settings and tools each model/provider supports

// Settings that each model supports
export const MODEL_CAPABILITIES = {
  // OpenAI-compatible models
  openai: {
    default: ['temperature', 'max_tokens', 'frequency_penalty', 'presence_penalty', 'seed', 'tool_choice', 'response_format'],
    'gpt-4': ['temperature', 'max_tokens', 'frequency_penalty', 'presence_penalty', 'seed', 'tool_choice', 'response_format'],
    'gpt-4o': ['temperature', 'max_tokens', 'frequency_penalty', 'presence_penalty', 'seed', 'tool_choice', 'response_format'],
    'gpt-4o-mini': ['temperature', 'max_tokens', 'frequency_penalty', 'presence_penalty', 'seed', 'tool_choice', 'response_format'],
    'gpt-5': ['max_tokens', 'frequency_penalty', 'presence_penalty', 'seed', 'tool_choice', 'reasoning_effort', 'response_format'],
    'gpt-5-mini': ['max_tokens', 'frequency_penalty', 'presence_penalty', 'seed', 'tool_choice', 'reasoning_effort', 'response_format'],
    'gpt-5.2': ['max_tokens', 'frequency_penalty', 'presence_penalty', 'seed', 'tool_choice', 'reasoning_effort', 'response_format'],
    'gpt-5.2-pro': ['max_tokens', 'frequency_penalty', 'presence_penalty', 'seed', 'tool_choice', 'reasoning_effort', 'response_format'],
    'o3': ['max_tokens', 'reasoning_effort', 'response_format'],
    'o4-mini': ['max_tokens', 'reasoning_effort', 'response_format'],
  },
  
  // Anthropic models
  anthropic: {
    default: ['temperature', 'max_tokens'],
    'claude-sonnet-4-5': ['temperature', 'max_tokens'],
    'claude-opus-4-1': ['temperature', 'max_tokens'],
    'claude-3-5-sonnet': ['temperature', 'max_tokens'],
    'claude-3-5-haiku': ['temperature', 'max_tokens'],
  },
  
  // Google models  
  google: {
    default: ['temperature', 'max_tokens'],
    'gemini-2.5-pro': ['temperature', 'max_tokens'],
    'gemini-2.5-flash': ['temperature', 'max_tokens'],
    'gemini-2.5-flash-lite': ['temperature', 'max_tokens'],
  },
  
  // Other/custom models - allow common settings
  other: {
    default: ['temperature', 'max_tokens', 'frequency_penalty', 'presence_penalty', 'seed', 'tool_choice', 'response_format'],
  }
};

// Tools that each model supports
export const MODEL_TOOLS = {
  openai: {
    default: ['web_search', 'code_interpreter', 'file_search'],
    'gpt-4o': ['web_search', 'code_interpreter', 'file_search'],
    'gpt-4o-mini': ['web_search', 'code_interpreter', 'file_search'],
    'gpt-5': ['web_search', 'code_interpreter', 'file_search'],
    'gpt-5-mini': ['web_search', 'code_interpreter', 'file_search'],
    'o3': ['web_search', 'code_interpreter', 'file_search'],
    'o4-mini': ['web_search', 'code_interpreter', 'file_search'],
  },
  anthropic: {
    default: [],
  },
  google: {
    default: ['web_search'],
  },
  other: {
    default: ['web_search'],
  }
};

// All possible settings with their labels, descriptions, and documentation links
export const ALL_SETTINGS = {
  temperature: { 
    label: 'Temperature', 
    shortLabel: 'Temp',
    description: 'Controls randomness (0-2)',
    details: 'Higher values like 0.8 make output more random, while lower values like 0.2 make it more focused and deterministic.',
    docUrl: 'https://platform.openai.com/docs/api-reference/chat/create#chat-create-temperature',
    type: 'number',
    min: 0,
    max: 2,
    step: 0.1,
    defaultValue: '0.7'
  },
  max_tokens: { 
    label: 'Max Tokens', 
    shortLabel: 'Max Tok',
    description: 'Maximum response length',
    details: 'The maximum number of tokens to generate. One token is roughly 4 characters for English text.',
    docUrl: 'https://platform.openai.com/docs/api-reference/chat/create#chat-create-max_tokens',
    type: 'number',
    min: 1,
    max: 128000,
    step: 1,
    defaultValue: '4096'
  },
  frequency_penalty: { 
    label: 'Frequency Penalty', 
    shortLabel: 'Freq Pen',
    description: 'Reduces repetition (-2 to 2)',
    details: 'Positive values penalize tokens based on how frequently they appear, decreasing repetition.',
    docUrl: 'https://platform.openai.com/docs/api-reference/chat/create#chat-create-frequency_penalty',
    type: 'number',
    min: -2,
    max: 2,
    step: 0.1,
    defaultValue: '0'
  },
  presence_penalty: { 
    label: 'Presence Penalty', 
    shortLabel: 'Pres Pen',
    description: 'Encourages new topics (-2 to 2)',
    details: 'Positive values penalize tokens based on whether they appear in the text so far, encouraging new topics.',
    docUrl: 'https://platform.openai.com/docs/api-reference/chat/create#chat-create-presence_penalty',
    type: 'number',
    min: -2,
    max: 2,
    step: 0.1,
    defaultValue: '0'
  },
  seed: { 
    label: 'Seed', 
    shortLabel: 'Seed',
    description: 'For deterministic outputs',
    details: 'If specified, the system will attempt to make deterministic sampling so that repeated requests with the same seed should return the same result.',
    docUrl: 'https://platform.openai.com/docs/api-reference/chat/create#chat-create-seed',
    type: 'number',
    min: 0,
    max: 9999999999,
    step: 1,
    defaultValue: ''
  },
  tool_choice: { 
    label: 'Tool Choice', 
    shortLabel: 'Tool',
    description: 'How tools are selected',
    details: 'Controls which (if any) tool is called by the model. "auto" lets the model pick, "none" disables tools, "required" forces a tool call.',
    docUrl: 'https://platform.openai.com/docs/api-reference/chat/create#chat-create-tool_choice',
    type: 'select',
    options: [
      { value: 'auto', label: 'Auto' },
      { value: 'none', label: 'None' },
      { value: 'required', label: 'Required' }
    ],
    defaultValue: 'auto'
  },
  reasoning_effort: { 
    label: 'Reasoning Effort', 
    shortLabel: 'Reason',
    description: 'For reasoning models (GPT-5, o-series)',
    details: 'Controls how much effort the model spends on reasoning. Higher values = better reasoning but slower/more expensive.',
    docUrl: 'https://platform.openai.com/docs/api-reference/chat/create',
    type: 'select',
    options: [
      { value: 'low', label: 'Low' },
      { value: 'medium', label: 'Medium' },
      { value: 'high', label: 'High' }
    ],
    defaultValue: 'medium'
  },
  response_format: { 
    label: 'Response Format', 
    shortLabel: 'Format',
    description: 'Output format type',
    details: 'Specifies the format the model must output. Auto-set based on node type.',
    docUrl: 'https://platform.openai.com/docs/api-reference/chat/create#chat-create-response_format',
    type: 'hidden', // Hidden from UI, auto-set by node type
    defaultValue: '{"type": "text"}'
  },
};

// All available tools
export const ALL_TOOLS = {
  web_search: { 
    label: 'Web Search', 
    icon: 'Globe',
    description: 'Enable real-time web search',
    details: 'When enabled, the AI can search the web for current information. Best for questions about recent events.',
    docUrl: 'https://platform.openai.com/docs/guides/tools-web-search',
  },
  confluence: { 
    label: 'Confluence', 
    icon: 'FileText',
    description: 'Access linked Confluence pages',
    details: 'Includes content from attached Confluence pages in the context.',
    docUrl: null,
  },
  code_interpreter: { 
    label: 'Code Interpreter', 
    icon: 'Code',
    description: 'Execute Python code',
    details: 'The AI can write and execute Python code in a sandbox environment for data analysis, calculations, etc.',
    docUrl: 'https://platform.openai.com/docs/assistants/tools/code-interpreter',
  },
  file_search: { 
    label: 'File Search', 
    icon: 'Search',
    description: 'Search through uploaded files',
    details: 'Enables semantic search across uploaded documents using vector embeddings.',
    docUrl: 'https://platform.openai.com/docs/assistants/tools/file-search',
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

// Get supported tools for a specific model
export const getModelTools = (modelId, provider) => {
  const providerTools = MODEL_TOOLS[provider?.toLowerCase()] || MODEL_TOOLS.other;
  
  const modelKey = Object.keys(providerTools).find(key => 
    modelId?.toLowerCase().includes(key.toLowerCase())
  );
  
  return providerTools[modelKey] || providerTools.default;
};

// Check if a setting is supported for a model
export const isSettingSupported = (setting, modelId, provider) => {
  const capabilities = getModelCapabilities(modelId, provider);
  return capabilities.includes(setting);
};

// Check if a tool is supported for a model
export const isToolSupported = (tool, modelId, provider) => {
  const tools = getModelTools(modelId, provider);
  return tools.includes(tool);
};
