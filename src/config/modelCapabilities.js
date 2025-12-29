// Model capabilities configuration - v4
// UI metadata for settings and tools (capabilities come from DB)

// All possible settings with their labels, descriptions, and documentation links
export const ALL_SETTINGS = {
  temperature: { 
    label: 'Temperature', 
    shortLabel: 'Temp',
    description: 'Controls randomness (0-2)',
    details: 'Higher values like 0.8 make output more random, while lower values like 0.2 make it more focused and deterministic.',
    docUrl: 'https://platform.openai.com/docs/api-reference/chat/create#chat-create-temperature',
    type: 'slider',
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
  max_completion_tokens: { 
    label: 'Max Completion Tokens', 
    shortLabel: 'Max Comp',
    description: 'Maximum response length (GPT-5/O-series)',
    details: 'The maximum number of tokens to generate. Used by GPT-5 and O-series models instead of max_tokens.',
    docUrl: 'https://platform.openai.com/docs/api-reference/chat/create#chat-create-max_completion_tokens',
    type: 'number',
    min: 1,
    max: 100000,
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
    type: 'hidden',
    defaultValue: '{"type": "text"}'
  },
  top_p: {
    label: 'Top P',
    shortLabel: 'Top P',
    description: 'Nucleus sampling (0-1)',
    details: 'An alternative to temperature. The model considers the results of the tokens with top_p probability mass.',
    docUrl: 'https://platform.openai.com/docs/api-reference/chat/create#chat-create-top_p',
    type: 'slider',
    min: 0,
    max: 1,
    step: 0.05,
    defaultValue: '1'
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
