/**
 * Create Children (JSON) Action Executor
 * 
 * Creates child nodes from a JSON array in the AI response.
 * Each item in the array becomes a child node.
 * Supports creating either standard or action node children.
 */

import { generatePositionAtEnd } from '../../utils/lexPosition';

const PROMPTS_TABLE = 'q_prompts';
const SETTINGS_TABLE = 'q_settings';
const MODEL_DEFAULTS_TABLE = 'q_model_defaults';

/**
 * Get nested value from object using dot notation path
 * e.g., getNestedValue({ data: { items: [1,2,3] } }, 'data.items') => [1,2,3]
 */
const getNestedValue = (obj, path) => {
  if (!path) return obj;
  
  const keys = path.split('.');
  let value = obj;
  
  for (const key of keys) {
    if (value === null || value === undefined) return undefined;
    
    // Handle array index access
    if (Array.isArray(value) && /^\d+$/.test(key)) {
      value = value[parseInt(key, 10)];
    } else {
      value = value[key];
    }
  }
  
  return value;
};

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
      child_thread_strategy, response_format, response_format_on,
      temperature, temperature_on, max_tokens, max_tokens_on,
      max_completion_tokens, max_completion_tokens_on
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
 * Execute the create children JSON action
 */
export const executeCreateChildrenJson = async ({
  supabase,
  prompt,
  jsonResponse,
  config,
  context,
}) => {
  console.log('createChildrenJson: Starting execution with config:', {
    json_path: config?.json_path,
    name_field: config?.name_field,
    content_field: config?.content_field,
    content_destination: config?.content_destination,
    placement: config?.placement,
    child_node_type: config?.child_node_type,
  });

  // Handle json_path as either string OR array (use first element if array)
  const rawJsonPath = config?.json_path;
  const json_path = Array.isArray(rawJsonPath) 
    ? rawJsonPath[0] 
    : (rawJsonPath || 'sections');

  const {
    name_field = 'prompt_name',
    content_field = 'input_admin_prompt',
    content_destination = 'system', // 'system' or 'user'
    child_node_type = 'standard',
    placement = 'children',
    copy_library_prompt_id,
  } = config || {};

  // Extract array from JSON response
  const items = getNestedValue(jsonResponse, json_path);
  
  if (!Array.isArray(items)) {
    // Provide detailed error with available keys and debugging info
    const responseType = typeof jsonResponse;
    const isObject = responseType === 'object' && jsonResponse !== null;
    const availableKeys = isObject
      ? Object.keys(jsonResponse).filter(k => Array.isArray(jsonResponse[k]))
      : [];
    const allKeys = isObject ? Object.keys(jsonResponse) : [];
    
    // Check if the value at path is a string (common mistake - AI returns stringified JSON)
    const valueAtPath = getNestedValue(jsonResponse, json_path);
    let suggestion = '';
    
    if (typeof valueAtPath === 'string') {
      suggestion = 'The value at this path is a string. The AI may have returned stringified JSON instead of an object.';
    } else if (availableKeys.length > 0) {
      suggestion = `Try changing json_path to "${availableKeys[0]}"`;
    } else if (Array.isArray(jsonResponse)) {
      suggestion = 'The response itself is an array. Try setting json_path to "root" or leave it empty.';
    } else {
      suggestion = 'Ensure your JSON schema includes an array field for child items.';
    }
    
    const errorDetails = {
      configuredPath: json_path,
      valueType: typeof items,
      valuePreview: items !== undefined ? String(items).substring(0, 100) : 'undefined',
      availableArrayKeys: availableKeys.length > 0 ? availableKeys : 'none',
      allResponseKeys: allKeys,
      suggestion,
    };
    
    console.error('createChildrenJson: Array path validation failed', errorDetails);
    
    throw new Error(
      `JSON path "${json_path}" does not point to an array. ` +
      `Found: ${typeof items}. ` +
      `Available array keys: ${availableKeys.join(', ') || 'none'}. ` +
      `${suggestion}`
    );
  }

  if (items.length === 0) {
    return {
      action: 'create_children_json',
      createdCount: 0,
      children: [],
      message: 'No items found in JSON array',
    };
  }

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

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    
    // Determine child name with smart auto-detection
    let childName;
    if (typeof item === 'string') {
      childName = item.substring(0, 100) || `Item ${i + 1}`;
    } else if (typeof item === 'object' && item !== null) {
      // If name_field is specified, try that first
      if (name_field) {
        childName = getNestedValue(item, name_field);
      }
      // Auto-detect from common name fields if not found
      if (!childName) {
        childName = item.prompt_name || item.name || item.title || item.heading || item.label || 
                    item.section_name || item.section_title || item.topic ||
                    item.subject || item.key || item.id;
      }
      // If still nothing, use first string value in the object
      if (!childName) {
        const firstStringValue = Object.values(item).find(v => typeof v === 'string' && v.length > 0 && v.length < 150);
        childName = firstStringValue || `Item ${i + 1}`;
      }
    } else {
      childName = `Item ${i + 1}`;
    }

    // Determine content
    let content;
    if (typeof item === 'string') {
      content = item;
    } else if (content_field) {
      content = getNestedValue(item, content_field);
      // Auto-detect if specified field not found
      if (!content && typeof item === 'object') {
        content = item.input_admin_prompt || item.system_prompt || item.content || 
                  item.text || item.body || item.description;
      }
      if (typeof content !== 'string' && content !== undefined && content !== null) {
        content = JSON.stringify(content, null, 2);
      }
    } else {
      // No content_field specified, try auto-detection
      if (typeof item === 'object') {
        content = item.input_admin_prompt || item.system_prompt || item.content || 
                  item.text || item.body || item.description;
      }
      if (!content) {
        content = JSON.stringify(item, null, 2);
      }
    }

    console.log(`createChildrenJson: Creating child ${i + 1}/${items.length}:`, {
      extractedName: childName,
      hasContent: !!content,
      contentLength: content?.length,
      contentPreview: content?.substring(0, 100),
    });

    // Generate sequential lex position
    const childPositionLex = generatePositionAtEnd(lastPositionKey);
    lastPositionKey = childPositionLex;

    // Build child data with proper inheritance
    const isSystemDestination = content_destination === 'system';
    
    const childData = {
      parent_row_id: targetParentRowId,
      prompt_name: String(childName).substring(0, 100),
      input_admin_prompt: isSystemDestination 
        ? (content || libraryPrompt?.content || defaults.def_admin_prompt || '')
        : (libraryPrompt?.content || defaults.def_admin_prompt || ''),
      input_user_prompt: isSystemDestination 
        ? '' 
        : (content || ''),
      position_lex: childPositionLex,
      is_deleted: false,
      owner_id: context.userId || prompt.owner_id,
      node_type: child_node_type || 'standard',
      is_assistant: true,
      extracted_variables: typeof item === 'object' ? item : { value: item },
      ...modelDefaults,
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

    // If creating action nodes, inherit response_format for structured output
    if (child_node_type === 'action' && parentSettings.response_format_on) {
      childData.response_format = parentSettings.response_format;
      childData.response_format_on = true;
    }

    if (copy_library_prompt_id) {
      childData.library_prompt_id = copy_library_prompt_id;
    }

    const { data, error } = await supabase
      .from(PROMPTS_TABLE)
      .insert(childData)
      .select()
      .maybeSingle();

    if (error) {
      console.error('Error creating child node from JSON:', error);
      throw error;
    }
    
    if (!data) {
      throw new Error(`Failed to create child node from JSON item ${i + 1} - no data returned`);
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
    action: 'create_children_json',
    createdCount: createdChildren.length,
    children: createdChildren,
    childNodeType: child_node_type,
    placement,
    targetParentRowId,
    jsonPath: json_path,
    message: `Created ${createdChildren.length}${nodeTypeText} node(s) ${placementText[placement] || ''} from JSON array`,
  };
};