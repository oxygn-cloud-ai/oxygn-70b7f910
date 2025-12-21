// Shared table name configuration for edge functions
// All table names MUST be set via environment variables - fallbacks removed for safety

const requiredEnv = (key: string): string => {
  const value = Deno.env.get(key);
  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
};

export const TABLES = {
  PROMPTS: requiredEnv('PROMPTS_TBL'),
  SETTINGS: requiredEnv('SETTINGS_TBL'),
  MODELS: requiredEnv('MODELS_TBL'),
  ASSISTANTS: requiredEnv('ASSISTANTS_TBL'),
  THREADS: requiredEnv('THREADS_TBL'),
  TEMPLATES: requiredEnv('TEMPLATES_TBL'),
  PROMPT_VARIABLES: requiredEnv('PROMPT_VARIABLES_TBL'),
  AI_COSTS: requiredEnv('AI_COSTS_TBL'),
  MODEL_PRICING: requiredEnv('MODEL_PRICING_TBL'),
  MODEL_DEFAULTS: requiredEnv('MODEL_DEFAULTS_TBL'),
  ASSISTANT_FILES: requiredEnv('ASSISTANT_FILES_TBL'),
  ASSISTANT_TOOL_DEFAULTS: requiredEnv('ASSISTANT_TOOL_DEFAULTS_TBL'),
  VECTOR_STORES: requiredEnv('VECTOR_STORES_TBL'),
  CONFLUENCE_PAGES: requiredEnv('CONFLUENCE_PAGES_TBL'),
} as const;

// Helper to build FK relationship strings dynamically
export const FK = {
  ASSISTANTS_PROMPT: `${TABLES.PROMPTS}!${TABLES.ASSISTANTS}_prompt_row_id_fkey`,
  THREADS_ASSISTANT: `${TABLES.ASSISTANTS}!${TABLES.THREADS}_assistant_row_id_fkey`,
  THREADS_CHILD_PROMPT: `${TABLES.PROMPTS}!${TABLES.THREADS}_child_prompt_row_id_fkey`,
} as const;
