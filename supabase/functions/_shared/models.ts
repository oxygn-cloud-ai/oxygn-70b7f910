// deno-lint-ignore-file no-explicit-any

export interface ModelConfig {
  modelId: string;
  modelName: string;
  provider: string;
  isActive: boolean;
  contextWindow: number;
  maxOutputTokens: number;
  tokenParam: string;
  supportsTemperature: boolean;
  supportsReasoningEffort: boolean;
  reasoningEffortLevels: string[] | null;
  supportedSettings: string[];
  supportedTools: string[];
  apiModelId: string;
  inputCostPerMillion: number;
  outputCostPerMillion: number;
}

interface ModelRow {
  model_id: string;
  model_name: string;
  provider: string;
  is_active: boolean;
  context_window: number | null;
  max_output_tokens: number | null;
  token_param: string | null;
  supports_temperature: boolean | null;
  supports_reasoning_effort: boolean | null;
  reasoning_effort_levels: string[] | null;
  supported_settings: string[] | null;
  supported_tools: string[] | null;
  api_model_id: string | null;
  input_cost_per_million: string | null;
  output_cost_per_million: string | null;
}

// Default config for fallback
const DEFAULT_CONFIG = {
  contextWindow: 128000,
  maxOutputTokens: 4096,
  tokenParam: 'max_tokens',
  supportsTemperature: true,
  supportsReasoningEffort: false,
  supportedSettings: ['temperature', 'max_tokens', 'frequency_penalty', 'presence_penalty', 'seed', 'tool_choice', 'response_format'],
  supportedTools: ['web_search', 'code_interpreter', 'file_search'],
};

function rowToConfig(row: ModelRow): ModelConfig {
  return {
    modelId: row.model_id,
    modelName: row.model_name,
    provider: row.provider,
    isActive: row.is_active,
    contextWindow: row.context_window ?? DEFAULT_CONFIG.contextWindow,
    maxOutputTokens: row.max_output_tokens ?? DEFAULT_CONFIG.maxOutputTokens,
    tokenParam: row.token_param ?? DEFAULT_CONFIG.tokenParam,
    supportsTemperature: row.supports_temperature ?? DEFAULT_CONFIG.supportsTemperature,
    supportsReasoningEffort: row.supports_reasoning_effort ?? DEFAULT_CONFIG.supportsReasoningEffort,
    reasoningEffortLevels: row.reasoning_effort_levels,
    supportedSettings: row.supported_settings ?? DEFAULT_CONFIG.supportedSettings,
    supportedTools: row.supported_tools ?? DEFAULT_CONFIG.supportedTools,
    apiModelId: row.api_model_id ?? row.model_id,
    inputCostPerMillion: parseFloat(row.input_cost_per_million || '0') || 0,
    outputCostPerMillion: parseFloat(row.output_cost_per_million || '0') || 0
  };
}

/**
 * Fetch model configuration from the database
 */
export async function fetchModelConfig(
  supabase: any,
  modelId: string
): Promise<ModelConfig | null> {
  const { data, error } = await supabase
    .from('q_models')
    .select('*')
    .eq('model_id', modelId)
    .single();

  if (error || !data) {
    console.warn(`Model config not found for ${modelId}, using defaults`);
    return null;
  }

  return rowToConfig(data as unknown as ModelRow);
}

/**
 * Resolve a model ID to its actual API model ID
 */
export async function resolveApiModelId(
  supabase: any,
  modelId: string
): Promise<string> {
  const config = await fetchModelConfig(supabase, modelId);
  return config?.apiModelId || modelId;
}

/**
 * Check if a model supports temperature parameter
 */
export async function supportsTemperature(
  supabase: any,
  modelId: string
): Promise<boolean> {
  const config = await fetchModelConfig(supabase, modelId);
  return config?.supportsTemperature ?? true;
}

/**
 * Get the token parameter name for a model
 */
export async function getTokenParam(
  supabase: any,
  modelId: string
): Promise<string> {
  const config = await fetchModelConfig(supabase, modelId);
  return config?.tokenParam ?? 'max_tokens';
}

/**
 * Fetch all active models from the database
 */
export async function fetchActiveModels(
  supabase: any
): Promise<ModelConfig[]> {
  const { data, error } = await supabase
    .from('q_models')
    .select('*')
    .eq('is_active', true)
    .order('model_name', { ascending: true });

  if (error || !data) {
    console.error('Error fetching active models:', error);
    return [];
  }

  return (data as unknown as ModelRow[]).map(rowToConfig);
}
