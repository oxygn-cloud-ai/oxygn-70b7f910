/**
 * Create Children (JSON) Action Executor
 * 
 * Creates child nodes from a JSON array in the AI response.
 * Each item in the array becomes a child node.
 * Supports creating either standard or action node children.
 */

import { generatePositionAtEnd } from '../../utils/lexPosition';
import { getEnvOrThrow } from '@/utils/safeEnv';
import { 
  TypedSupabaseClient, 
  ExecutorParams, 
  ExecutorResult,
  ParentSettings,
} from './types';
import { 
  getNestedValue, 
  getDefaultSettings, 
  getModelDefaults, 
  getLibraryPrompt 
} from './helpers';

// Table reference - validated at import time
const PROMPTS_TABLE = getEnvOrThrow('VITE_PROMPTS_TBL');

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
      child_thread_strategy, response_format, response_format_on,
      temperature, temperature_on, max_tokens, max_tokens_on,
      max_completion_tokens, max_completion_tokens_on
    `)
    .eq('row_id', parentRowId)
    .maybeSingle();

  return (data || {}) as ParentSettings;
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
}: ExecutorParams): Promise<ExecutorResult> => {
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
    ? rawJsonPath[0] as string
    : ((rawJsonPath as string) || 'sections');

  const {
    name_field = 'prompt_name',
    content_field = 'input_admin_prompt',
    content_destination = 'system',
    child_node_type = 'standard',
    placement = 'children',
    copy_library_prompt_id,
  } = config || {};

  if (!jsonResponse || typeof jsonResponse !== 'object') {
    return {
      success: false,
      error: 'No JSON response to process',
      createdCount: 0,
      children: [],
    };
  }

  const responseObj = jsonResponse as Record<string, unknown>;
  
  // Extract array from JSON response
  const items = getNestedValue(responseObj, json_path);
  
  if (!Array.isArray(items)) {
    const isObject = typeof jsonResponse === 'object' && jsonResponse !== null;
    const availableKeys = isObject
      ? Object.keys(responseObj).filter(k => Array.isArray(responseObj[k]))
      : [];
    const allKeys = isObject ? Object.keys(responseObj) : [];
    
    const valueAtPath = getNestedValue(responseObj, json_path);
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
    
    console.error('createChildrenJson: Array path validation failed', {
      configuredPath: json_path,
      valueType: typeof items,
      availableArrayKeys: availableKeys.length > 0 ? availableKeys : 'none',
      allResponseKeys: allKeys,
      suggestion,
    });
    
    throw new Error(
      `JSON path "${json_path}" does not point to an array. ` +
      `Found: ${typeof items}. ` +
      `Available array keys: ${availableKeys.join(', ') || 'none'}. ` +
      `${suggestion}`
    );
  }

  if (items.length === 0) {
    return {
      success: true,
      action: 'create_children_json',
      createdCount: 0,
      children: [],
      message: 'No items found in JSON array',
    };
  }

  const defaults = await getDefaultSettings(supabase);
  const modelDefaults = await getModelDefaults(supabase, defaults.default_model);
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

  for (let i = 0; i < items.length; i++) {
    const item = items[i] as Record<string, unknown> | string;
    
    // Determine child name with smart auto-detection
    let childName: string;
    if (typeof item === 'string') {
      childName = item.substring(0, 100) || `Item ${i + 1}`;
    } else if (typeof item === 'object' && item !== null) {
      if (name_field) {
        const nameValue = getNestedValue(item, name_field as string);
        childName = typeof nameValue === 'string' ? nameValue : '';
      } else {
        childName = '';
      }
      if (!childName) {
        childName = (item.prompt_name || item.name || item.title || item.heading || item.label || 
                    item.section_name || item.section_title || item.topic ||
                    item.subject || item.key || item.id) as string || '';
      }
      if (!childName) {
        const firstStringValue = Object.values(item).find(v => typeof v === 'string' && v.length > 0 && v.length < 150);
        childName = (firstStringValue as string) || `Item ${i + 1}`;
      }
    } else {
      childName = `Item ${i + 1}`;
    }

    // Determine content
    let content: string;
    if (typeof item === 'string') {
      content = item;
    } else if (content_field && typeof item === 'object' && item !== null) {
      const contentValue = getNestedValue(item, content_field as string);
      if (contentValue !== undefined && contentValue !== null) {
        content = typeof contentValue === 'string' ? contentValue : JSON.stringify(contentValue, null, 2);
      } else {
        content = (item.input_admin_prompt || item.system_prompt || item.content || 
                  item.text || item.body || item.description) as string || '';
      }
    } else if (typeof item === 'object' && item !== null) {
      content = (item.input_admin_prompt || item.system_prompt || item.content || 
                item.text || item.body || item.description) as string || JSON.stringify(item, null, 2);
    } else {
      content = '';
    }

    console.log(`createChildrenJson: Creating child ${i + 1}/${items.length}:`, {
      extractedName: childName,
      hasContent: !!content,
      contentLength: content?.length,
    });

    const childPositionLex = generatePositionAtEnd(lastPositionKey);
    lastPositionKey = childPositionLex;

    const isSystemDestination = content_destination === 'system';
    
    const childData: Record<string, unknown> = {
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
      owner_id: (context?.userId as string) || prompt.owner_id,
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

    if ((child_node_type as string) === 'action' && parentSettings.response_format_on) {
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

  const placementText: Record<string, string> = {
    children: 'as children',
    siblings: 'as siblings',
    top_level: 'as top-level prompts',
  };

  const nodeTypeText = (child_node_type as string) === 'action' ? ' action' : '';

  return {
    success: true,
    action: 'create_children_json',
    createdCount: createdChildren.length,
    children: createdChildren,
    childNodeType: child_node_type,
    placement,
    targetParentRowId,
    jsonPath: json_path,
    message: `Created ${createdChildren.length}${nodeTypeText} node(s) ${placementText[placement as string] || ''} from JSON array`,
  };
};
