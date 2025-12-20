// Shared table name configuration for edge functions
// All table names are read from environment variables - NO HARDCODING

export const TABLES = {
  PROMPTS: Deno.env.get('PROMPTS_TBL') || 'q_prompts',
  SETTINGS: Deno.env.get('SETTINGS_TBL') || 'q_settings',
  MODELS: Deno.env.get('MODELS_TBL') || 'q_models',
  ASSISTANTS: Deno.env.get('ASSISTANTS_TBL') || 'q_assistants',
  THREADS: Deno.env.get('THREADS_TBL') || 'q_threads',
  TEMPLATES: Deno.env.get('TEMPLATES_TBL') || 'q_templates',
  PROMPT_VARIABLES: Deno.env.get('PROMPT_VARIABLES_TBL') || 'q_prompt_variables',
  AI_COSTS: Deno.env.get('AI_COSTS_TBL') || 'q_ai_costs',
  MODEL_PRICING: Deno.env.get('MODEL_PRICING_TBL') || 'q_model_pricing',
  MODEL_DEFAULTS: Deno.env.get('MODEL_DEFAULTS_TBL') || 'q_model_defaults',
  ASSISTANT_FILES: Deno.env.get('ASSISTANT_FILES_TBL') || 'q_assistant_files',
  ASSISTANT_TOOL_DEFAULTS: Deno.env.get('ASSISTANT_TOOL_DEFAULTS_TBL') || 'q_assistant_tool_defaults',
  VECTOR_STORES: Deno.env.get('VECTOR_STORES_TBL') || 'q_vector_stores',
  CONFLUENCE_PAGES: Deno.env.get('CONFLUENCE_PAGES_TBL') || 'q_confluence_pages',
} as const;

// Helper to build FK relationship strings dynamically
export const FK = {
  ASSISTANTS_PROMPT: `${TABLES.PROMPTS}!${TABLES.ASSISTANTS}_prompt_row_id_fkey`,
  THREADS_ASSISTANT: `${TABLES.ASSISTANTS}!${TABLES.THREADS}_assistant_row_id_fkey`,
  THREADS_CHILD_PROMPT: `${TABLES.PROMPTS}!${TABLES.THREADS}_child_prompt_row_id_fkey`,
} as const;
