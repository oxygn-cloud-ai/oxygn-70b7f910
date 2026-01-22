import { SupabaseClient } from '@supabase/supabase-js';
import { Database } from '@/integrations/supabase/types';

export type TypedSupabaseClient = SupabaseClient<Database>;

export interface PromptRow {
  row_id: string;
  prompt_name: string | null;
  parent_row_id: string | null;
  root_prompt_row_id: string | null;
  model: string | null;
  temperature: string | null;
  temperature_on: boolean | null;
  max_tokens: string | null;
  max_tokens_on: boolean | null;
  max_output_tokens: string | null;
  max_output_tokens_on: boolean | null;
  max_completion_tokens: string | null;
  max_completion_tokens_on: boolean | null;
  top_p: string | null;
  top_p_on: boolean | null;
  frequency_penalty: string | null;
  frequency_penalty_on: boolean | null;
  presence_penalty: string | null;
  presence_penalty_on: boolean | null;
  reasoning_effort: string | null;
  reasoning_effort_on: boolean | null;
  input_admin_prompt: string | null;
  input_user_prompt: string | null;
  output_response: string | null;
  note: string | null;
  post_action: string | null;
  post_action_config: Record<string, unknown> | null;
  json_schema_template_id: string | null;
  library_prompt_id: string | null;
  position_lex: string;
  owner_id: string | null;
  [key: string]: unknown;
}

export interface ActionConfig {
  sourceField?: string;
  arrayPath?: string;
  sectionField?: string;
  titleField?: string;
  childNameTemplate?: string;
  systemPromptField?: string;
  userPromptField?: string;
  inheritSettings?: boolean;
  templateRowId?: string;
  variableMappings?: Record<string, string>;
  assignments?: VariableAssignment[];
  [key: string]: unknown;
}

export interface VariableAssignment {
  variableName: string;
  sourceType: 'jsonPath' | 'static' | 'systemVariable';
  sourcePath?: string;
  staticValue?: string;
  targetScope: 'self' | 'parent' | 'root';
}

export interface ExecutionContext {
  parentOutputResponse?: string | null;
  topLevelPromptName?: string | null;
  topLevelPromptRowId?: string | null;
  parentPromptName?: string | null;
  parentPromptRowId?: string | null;
  templateVariables?: Record<string, string>;
  [key: string]: unknown;
}

export interface ExecutorParams {
  supabase: TypedSupabaseClient;
  prompt: PromptRow;
  jsonResponse: Record<string, unknown> | unknown[] | null;
  actionId: string;
  config: ActionConfig;
  context: ExecutionContext;
}

export interface ExecutorResult {
  success: boolean;
  error?: string;
  createdCount?: number;
  children?: PromptRow[];
  updatedVariables?: Record<string, string>;
  [key: string]: unknown;
}

export type ExecutorFunction = (params: ExecutorParams) => Promise<ExecutorResult>;

/**
 * Model defaults structure from database
 * All fields optional to reflect actual database nullability
 */
export interface ModelDefaults {
  model_id?: string | null;
  model?: string | null;
  model_on?: boolean | null;
  temperature?: string | null;
  temperature_on?: boolean | null;
  max_tokens?: string | null;
  max_tokens_on?: boolean | null;
  max_output_tokens?: string | null;
  max_output_tokens_on?: boolean | null;
  max_completion_tokens?: string | null;
  max_completion_tokens_on?: boolean | null;
  top_p?: string | null;
  top_p_on?: boolean | null;
  frequency_penalty?: string | null;
  frequency_penalty_on?: boolean | null;
  presence_penalty?: string | null;
  presence_penalty_on?: boolean | null;
  reasoning_effort?: string | null;
  reasoning_effort_on?: boolean | null;
  response_format?: string | null;
  response_format_on?: boolean | null;
  stop?: string | null;
  stop_on?: boolean | null;
  n?: number | null;
  n_on?: boolean | null;
  stream?: boolean | null;
  stream_on?: boolean | null;
  logit_bias?: string | null;
  logit_bias_on?: boolean | null;
  o_user?: string | null;
  o_user_on?: boolean | null;
  seed?: number | null;
  seed_on?: boolean | null;
  tool_choice?: string | null;
  tool_choice_on?: boolean | null;
  [key: string]: unknown;
}

/**
 * Parent settings for inheritance - comprehensive field list
 * All fields optional to match database nullability and partial returns
 */
export interface ParentSettings {
  model?: string | null;
  model_on?: boolean | null;
  web_search_on?: boolean | null;
  confluence_enabled?: boolean | null;
  thread_mode?: string | null;
  child_thread_strategy?: string | null;
  response_format?: string | null;
  response_format_on?: boolean | null;
  temperature?: string | null;
  temperature_on?: boolean | null;
  max_tokens?: string | null;
  max_tokens_on?: boolean | null;
  max_output_tokens?: string | null;
  max_output_tokens_on?: boolean | null;
  max_completion_tokens?: string | null;
  max_completion_tokens_on?: boolean | null;
  top_p?: string | null;
  top_p_on?: boolean | null;
  frequency_penalty?: string | null;
  frequency_penalty_on?: boolean | null;
  presence_penalty?: string | null;
  presence_penalty_on?: boolean | null;
  reasoning_effort?: string | null;
  reasoning_effort_on?: boolean | null;
  input_admin_prompt?: string | null;
}

/**
 * Library prompt structure
 */
export interface LibraryPrompt {
  row_id: string;
  name: string;
  content: string | null;
  description: string | null;
  category: string | null;
}
