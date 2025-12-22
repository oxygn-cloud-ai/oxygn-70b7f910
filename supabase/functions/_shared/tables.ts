// Shared table name configuration for edge functions
// Uses environment variables with fallback to q_ prefixed tables

const getEnv = (key: string, fallback: string): string => {
  return Deno.env.get(key) || fallback;
};

export const TABLES = {
  PROMPTS: getEnv('PROMPTS_TBL', 'q_prompts'),
  SETTINGS: getEnv('SETTINGS_TBL', 'q_settings'),
  MODELS: getEnv('MODELS_TBL', 'q_models'),
  ASSISTANTS: getEnv('ASSISTANTS_TBL', 'q_assistants'),
  THREADS: getEnv('THREADS_TBL', 'q_threads'),
  TEMPLATES: getEnv('TEMPLATES_TBL', 'q_templates'),
  PROMPT_VARIABLES: getEnv('PROMPT_VARIABLES_TBL', 'q_prompt_variables'),
  AI_COSTS: getEnv('AI_COSTS_TBL', 'q_ai_costs'),
  MODEL_PRICING: getEnv('MODEL_PRICING_TBL', 'q_model_pricing'),
  MODEL_DEFAULTS: getEnv('MODEL_DEFAULTS_TBL', 'q_model_defaults'),
  ASSISTANT_FILES: getEnv('ASSISTANT_FILES_TBL', 'q_assistant_files'),
  ASSISTANT_TOOL_DEFAULTS: getEnv('ASSISTANT_TOOL_DEFAULTS_TBL', 'q_assistant_tool_defaults'),
  VECTOR_STORES: getEnv('VECTOR_STORES_TBL', 'q_vector_stores'),
  CONFLUENCE_PAGES: getEnv('CONFLUENCE_PAGES_TBL', 'q_confluence_pages'),
  BACKUPS: getEnv('BACKUPS_TBL', 'q_backups'),
  // Workbench tables
  WORKBENCH_THREADS: getEnv('WORKBENCH_THREADS_TBL', 'q_workbench_threads'),
  WORKBENCH_MESSAGES: getEnv('WORKBENCH_MESSAGES_TBL', 'q_workbench_messages'),
  WORKBENCH_FILES: getEnv('WORKBENCH_FILES_TBL', 'q_workbench_files'),
  WORKBENCH_CONFLUENCE: getEnv('WORKBENCH_CONFLUENCE_TBL', 'q_workbench_confluence_links'),
  PROMPT_LIBRARY: getEnv('PROMPT_LIBRARY_TBL', 'q_prompt_library'),
} as const;

// Helper to build FK relationship strings dynamically
export const FK = {
  ASSISTANTS_PROMPT: `${TABLES.PROMPTS}!${TABLES.ASSISTANTS}_prompt_row_id_fkey`,
  THREADS_ASSISTANT: `${TABLES.ASSISTANTS}!${TABLES.THREADS}_assistant_row_id_fkey`,
  THREADS_CHILD_PROMPT: `${TABLES.PROMPTS}!${TABLES.THREADS}_child_prompt_row_id_fkey`,
} as const;
