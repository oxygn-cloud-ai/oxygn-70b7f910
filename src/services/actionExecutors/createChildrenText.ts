/**
 * Create Children (Text) Action Executor
 * 
 * Creates a specified number of child nodes with optional content from library prompts.
 * Supports naming templates like {{n}}, {{nn}}, {{A}}, {{date:FORMAT}}.
 */

import { processNamingTemplate } from '../../utils/namingTemplates';
import { generatePositionAtEnd } from '../../utils/lexPosition';
import { 
  TypedSupabaseClient, 
  ExecutorParams, 
  ExecutorResult,
  ModelDefaults,
  ParentSettings,
  LibraryPrompt
} from './types';

const PROMPTS_TABLE = 'q_prompts';
const SETTINGS_TABLE = 'q_settings';
const MODEL_DEFAULTS_TABLE = 'q_model_defaults';

/**
 * Get default prompt settings from the database
 */
const getDefaultSettings = async (supabase: TypedSupabaseClient): Promise<Record<string, string>> => {
  const { data } = await supabase
    .from(SETTINGS_TABLE)
    .select('setting_key, setting_value')
    .in('setting_key', ['def_admin_prompt', 'default_user_prompt', 'default_model']);

  const settings: Record<string, string> = {};
  data?.forEach(row => {
    if (row.setting_key && row.setting_value) {
      settings[row.setting_key] = row.setting_value;
    }
  });
  return settings;
};

/**
 * Get model defaults for a specific model
 */
const getModelDefaults = async (
  supabase: TypedSupabaseClient, 
  modelId: string | null
): Promise<ModelDefaults> => {
  if (!modelId) return { model_id: null } as ModelDefaults;

  const { data } = await supabase
    .from(MODEL_DEFAULTS_TABLE)
    .select('*')
    .eq('model_id', modelId)
    .maybeSingle();

  if (!data) return { model_id: modelId, model: modelId, model_on: true } as unknown as ModelDefaults;

  const defaults: Record<string, unknown> = { model_id: modelId, model: modelId, model_on: true };
  const fields = ['temperature', 'max_tokens', 'max_completion_tokens', 'top_p', 'frequency_penalty', 
    'presence_penalty', 'reasoning_effort', 'stop', 'n', 'stream', 'response_format', 'logit_bias', 'o_user', 'seed', 'tool_choice'];

  fields.forEach(field => {
    const onKey = `${field}_on` as keyof typeof data;
    if (data[onKey]) {
      defaults[field] = data[field as keyof typeof data];
      defaults[`${field}_on`] = true;
    }
  });

  return defaults as ModelDefaults;
};

/**
 * Get inheritable settings from parent prompt
 */
const getParentSettings = async (
  supabase: TypedSupabaseClient, 
  parentRowId: string | null
): Promise<ParentSettings> => {
  if (!parentRowId) return {} as ParentSettings;

  const { data } = await supabase
    .from(PROMPTS_TABLE)
    .select(`
      model, model_on, web_search_on, confluence_enabled, thread_mode, 
      child_thread_strategy, temperature, temperature_on, 
      max_tokens, max_tokens_on, max_completion_tokens, max_completion_tokens_on
    `)
    .eq('row_id', parentRowId)
    .maybeSingle();

  return (data || {}) as ParentSettings;
};

/**
 * Get library prompt content if specified
 */
const getLibraryPrompt = async (
  supabase: TypedSupabaseClient, 
  libraryPromptId: string | null | undefined
): Promise<LibraryPrompt | null> => {
  if (!libraryPromptId) return null;

  const { data } = await supabase
    .from('q_prompt_library')
    .select('row_id, name, content, description, category')
    .eq('row_id', libraryPromptId)
    .maybeSingle();

  return data as LibraryPrompt | null;
};

/**
 * Execute the create children text action
 */
export const executeCreateChildrenText = async ({
  supabase,
  prompt,
  config,
  context,
}: ExecutorParams): Promise<ExecutorResult> => {
  const {
    children_count = 3,
    name_prefix = 'Child',
    placement = 'children',
    child_node_type = 'standard',
    copy_library_prompt_id,
  } = config || {};

  const defaults = await getDefaultSettings(supabase);
  const modelDefaults = await getModelDefaults(supabase, defaults.default_model || null);
  const parentSettings = await getParentSettings(supabase, prompt.row_id);
  const libraryPrompt = await getLibraryPrompt(supabase, copy_library_prompt_id as string | undefined);

  // Determine parent_row_id based on placement
  let targetParentRowId: string | null;
  switch (placement) {
    case 'children':
      targetParentRowId = prompt.row_id;
      break;
    case 'siblings':
      targetParentRowId = prompt.parent_row_id;
      break;
    case 'top_level':
      targetParentRowId = null;
      break;
    case 'specific_prompt':
      targetParentRowId = (config?.target_prompt_id as string) || prompt.row_id;
      break;
    default:
      targetParentRowId = prompt.row_id;
  }

  // Get last position_lex at target level
  let lastPositionKey: string | null;
  if (placement === 'top_level' || targetParentRowId === null) {
    const { data: topLevel } = await supabase
      .from(PROMPTS_TABLE)
      .select('position_lex')
      .is('parent_row_id', null)
      .order('position_lex', { ascending: false })
      .limit(1);
    lastPositionKey = topLevel?.[0]?.position_lex || null;
  } else {
    const { data: siblings } = await supabase
      .from(PROMPTS_TABLE)
      .select('position_lex')
      .eq('parent_row_id', targetParentRowId)
      .order('position_lex', { ascending: false })
      .limit(1);
    lastPositionKey = siblings?.[0]?.position_lex || null;
  }

  const createdChildren: unknown[] = [];
  const count = Number(children_count) || 3;

  for (let i = 0; i < count; i++) {
    const hasTemplateCode = name_prefix && /\{\{[^}]+\}\}/.test(name_prefix as string);
    const childName = hasTemplateCode 
      ? processNamingTemplate(name_prefix as string, i)
      : `${name_prefix} ${i + 1}`;
    
    const childPositionLex = generatePositionAtEnd(lastPositionKey);
    lastPositionKey = childPositionLex;
    
    const childData: Record<string, unknown> = {
      parent_row_id: targetParentRowId,
      prompt_name: childName,
      input_admin_prompt: libraryPrompt?.content || defaults.def_admin_prompt || '',
      input_user_prompt: defaults.default_user_prompt || '',
      position_lex: childPositionLex,
      is_deleted: false,
      owner_id: (context?.userId as string) || prompt.owner_id,
      node_type: child_node_type || 'standard',
      is_assistant: true,
      ...modelDefaults,
      temperature: parentSettings.temperature ?? modelDefaults.temperature,
      temperature_on: parentSettings.temperature_on ?? modelDefaults.temperature_on,
      max_tokens: parentSettings.max_tokens ?? modelDefaults.max_tokens,
      max_tokens_on: parentSettings.max_tokens_on ?? modelDefaults.max_tokens_on,
      max_completion_tokens: parentSettings.max_completion_tokens ?? modelDefaults.max_completion_tokens,
      max_completion_tokens_on: parentSettings.max_completion_tokens_on ?? modelDefaults.max_completion_tokens_on,
      web_search_on: (parentSettings as unknown as Record<string, unknown>).web_search_on,
      confluence_enabled: (parentSettings as unknown as Record<string, unknown>).confluence_enabled,
      thread_mode: (parentSettings as unknown as Record<string, unknown>).thread_mode,
      child_thread_strategy: (parentSettings as unknown as Record<string, unknown>).child_thread_strategy,
    };

    if (copy_library_prompt_id) {
      childData.library_prompt_id = copy_library_prompt_id;
    }

    const { data, error } = await supabase
      .from(PROMPTS_TABLE)
      .insert(childData)
      .select()
      .maybeSingle();

    if (error) {
      console.error('Error creating child node:', error);
      throw error;
    }
    
    if (!data) {
      throw new Error(`Failed to create child node ${i + 1} - no data returned`);
    }

    createdChildren.push(data);
  }

  const placementText: Record<string, string> = {
    children: 'as children',
    siblings: 'as siblings',
    top_level: 'as top-level prompts',
  };

  const nodeTypeText = (child_node_type as string) === 'action' ? ' action' : '';

  return {
    success: true,
    action: 'create_children_text',
    createdCount: createdChildren.length,
    children: createdChildren,
    placement,
    message: `Created ${createdChildren.length}${nodeTypeText} node(s) ${placementText[placement as string] || ''}`,
  };
};
