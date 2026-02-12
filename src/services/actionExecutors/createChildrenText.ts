// @ts-nocheck
/**
 * Create Children (Text) Action Executor
 * 
 * Creates a specified number of child nodes with optional content from library prompts.
 * Supports naming templates like {{n}}, {{nn}}, {{A}}, {{date:FORMAT}}.
 */

import { processNamingTemplate } from '../../utils/namingTemplates.js';
import { generatePositionAtEnd } from '../../utils/lexPosition.js';

const PROMPTS_TABLE = 'q_prompts';
const SETTINGS_TABLE = 'q_settings';
const MODEL_DEFAULTS_TABLE = 'q_model_defaults';

/**
 * Get default prompt settings from the database
 */
const getDefaultSettings = async (supabase) => {
  const { data } = await supabase
    .from(SETTINGS_TABLE)
    .select('setting_key, setting_value')
    .in('setting_key', ['def_admin_prompt', 'default_user_prompt', 'default_model']);

  const settings = {};
  data?.forEach(row => {
    settings[row.setting_key] = row.setting_value;
  });
  return settings;
};

/**
 * Get model defaults for a specific model
 */
const getModelDefaults = async (supabase, modelId) => {
  if (!modelId) return {};

  const { data } = await supabase
    .from(MODEL_DEFAULTS_TABLE)
    .select('*')
    .eq('model_id', modelId)
    .maybeSingle();

  if (!data) return { model: modelId, model_on: true };

  const defaults = { model: modelId, model_on: true };
  // All model settings fields that can have defaults
  const fields = ['temperature', 'max_tokens', 'max_completion_tokens', 'top_p', 'frequency_penalty', 
    'presence_penalty', 'reasoning_effort', 'stop', 'n', 'stream', 'response_format', 'logit_bias', 'o_user', 'seed', 'tool_choice'];

  fields.forEach(field => {
    if (data[`${field}_on`]) {
      defaults[field] = data[field];
      defaults[`${field}_on`] = true;
    }
  });

  return defaults;
};

/**
 * Get inheritable settings from parent prompt
 */
const getParentSettings = async (supabase, parentRowId) => {
  if (!parentRowId) return {};

  const { data } = await supabase
    .from(PROMPTS_TABLE)
    .select(`
      model, model_on, web_search_on, confluence_enabled, thread_mode, 
      child_thread_strategy, temperature, temperature_on, 
      max_tokens, max_tokens_on, max_completion_tokens, max_completion_tokens_on
    `)
    .eq('row_id', parentRowId)
    .maybeSingle();

  return data || {};
};

/**
 * Get library prompt content if specified
 */
const getLibraryPrompt = async (supabase, libraryPromptId) => {
  if (!libraryPromptId) return null;

  const { data } = await supabase
    .from('q_prompt_library')
    .select('content, name')
    .eq('row_id', libraryPromptId)
    .maybeSingle();

  return data;
};

/**
 * Execute the create children text action
 */
export const executeCreateChildrenText = async ({
  supabase,
  prompt,
  jsonResponse,
  config,
  context,
}) => {
  const {
    children_count = 3,
    name_prefix = 'Child',
    placement = 'children',
    child_node_type = 'standard',
    copy_library_prompt_id,
  } = config || {};

  // Get default settings
  const defaults = await getDefaultSettings(supabase);
  
  // Get model defaults if a default model is set
  const modelDefaults = await getModelDefaults(supabase, defaults.default_model);
  
  // Get parent settings to inherit
  const parentSettings = await getParentSettings(supabase, prompt.row_id);
  
  // Get library prompt if specified
  const libraryPrompt = await getLibraryPrompt(supabase, copy_library_prompt_id);

  // Determine parent_row_id based on placement
  let targetParentRowId;
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
      targetParentRowId = config.target_prompt_id || prompt.row_id;
      break;
    default:
      targetParentRowId = prompt.row_id;
  }

  // Get last position_lex at target level
  let lastPositionKey;
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

  const createdChildren = [];

  for (let i = 0; i < children_count; i++) {
    // Support naming templates in the prefix (e.g., "Child {{nn}}", "Section {{A}}")
    const hasTemplateCode = name_prefix && /\{\{[^}]+\}\}/.test(name_prefix);
    const childName = hasTemplateCode 
      ? processNamingTemplate(name_prefix, i)
      : `${name_prefix} ${i + 1}`;
    
    // Generate sequential lex positions
    const childPositionLex = generatePositionAtEnd(lastPositionKey);
    lastPositionKey = childPositionLex;
    
    // Build child data with proper inheritance
    const childData = {
      parent_row_id: targetParentRowId,
      prompt_name: childName,
      input_admin_prompt: libraryPrompt?.content || defaults.def_admin_prompt || '',
      input_user_prompt: defaults.default_user_prompt || '',
      position_lex: childPositionLex,
      is_deleted: false,
      owner_id: context.userId || prompt.owner_id,
      node_type: child_node_type || 'standard',
      is_assistant: true, // Always enable conversation mode for child prompts
      // Apply model defaults
      ...modelDefaults,
      // Inherit settings from parent (with fallback to model defaults)
      temperature: parentSettings.temperature ?? modelDefaults.temperature,
      temperature_on: parentSettings.temperature_on ?? modelDefaults.temperature_on,
      max_tokens: parentSettings.max_tokens ?? modelDefaults.max_tokens,
      max_tokens_on: parentSettings.max_tokens_on ?? modelDefaults.max_tokens_on,
      max_completion_tokens: parentSettings.max_completion_tokens ?? modelDefaults.max_completion_tokens,
      max_completion_tokens_on: parentSettings.max_completion_tokens_on ?? modelDefaults.max_completion_tokens_on,
      web_search_on: parentSettings.web_search_on,
      confluence_enabled: parentSettings.confluence_enabled,
      thread_mode: parentSettings.thread_mode,
      child_thread_strategy: parentSettings.child_thread_strategy,
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

  const placementText = {
    children: 'as children',
    siblings: 'as siblings',
    top_level: 'as top-level prompts',
  };

  const nodeTypeText = child_node_type === 'action' ? ' action' : '';

  return {
    action: 'create_children_text',
    createdCount: createdChildren.length,
    children: createdChildren,
    placement,
    message: `Created ${createdChildren.length}${nodeTypeText} node(s) ${placementText[placement] || ''}`,
  };
};
