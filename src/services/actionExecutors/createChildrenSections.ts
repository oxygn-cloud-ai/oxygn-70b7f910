/**
 * Create Children (Sections) Action Executor
 * 
 * Creates child nodes from JSON keys matching a pattern or explicit key list.
 * Each matching key becomes a child node with the value as the name.
 * Optionally looks for corresponding content keys (e.g., "section 01 system prompt").
 * Supports creating either standard or action node children.
 */
import { generatePositionAtEnd } from '../../utils/lexPosition';
import { 
  TypedSupabaseClient, 
  ExecutorParams, 
  ExecutorResult,
  ModelDefaults,
  LibraryPrompt
} from './types';

// Table references from environment
const PROMPTS_TABLE = import.meta.env.VITE_PROMPTS_TBL;
const SETTINGS_TABLE = import.meta.env.VITE_SETTINGS_TBL;
const MODEL_DEFAULTS_TABLE = import.meta.env.VITE_MODEL_DEFAULTS_TBL;
const LIBRARY_TABLE = import.meta.env.VITE_PROMPT_LIBRARY_TBL || 'q_prompt_library';

interface PromptSettings {
  model: string | null;
  model_on: boolean | null;
  web_search_on: boolean | null;
  confluence_enabled: boolean | null;
  thread_mode: string | null;
  child_thread_strategy: string | null;
  temperature: string | null;
  temperature_on: boolean | null;
  max_tokens: string | null;
  max_tokens_on: boolean | null;
  max_completion_tokens: string | null;
  max_completion_tokens_on: boolean | null;
  top_p: string | null;
  top_p_on: boolean | null;
  frequency_penalty: string | null;
  frequency_penalty_on: boolean | null;
  presence_penalty: string | null;
  presence_penalty_on: boolean | null;
  input_admin_prompt: string | null;
  response_format: string | null;
  response_format_on: boolean | null;
}

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
 * Get inheritable settings from a prompt (parent or action prompt itself)
 */
const getPromptSettings = async (
  supabase: TypedSupabaseClient, 
  promptRowId: string | null
): Promise<PromptSettings> => {
  if (!promptRowId) return {} as PromptSettings;

  const { data } = await supabase
    .from(PROMPTS_TABLE)
    .select(`
      model, model_on, web_search_on, confluence_enabled, thread_mode, 
      child_thread_strategy, temperature, temperature_on, max_tokens, max_tokens_on,
      max_completion_tokens, max_completion_tokens_on,
      top_p, top_p_on, frequency_penalty, frequency_penalty_on, presence_penalty, 
      presence_penalty_on, input_admin_prompt, response_format, response_format_on
    `)
    .eq('row_id', promptRowId)
    .maybeSingle();

  return (data || {}) as PromptSettings;
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
    .from(LIBRARY_TABLE)
    .select('row_id, name, content, description, category')
    .eq('row_id', libraryPromptId)
    .maybeSingle();

  return data as LibraryPrompt | null;
};

/**
 * Execute the create children sections action
 */
export const executeCreateChildrenSections = async ({
  supabase,
  prompt,
  jsonResponse,
  config,
  context,
}: ExecutorParams): Promise<ExecutorResult> => {
  const {
    target_keys = [],
    section_pattern = '^section\\s*\\d+',
    name_source = 'key_value',
    content_key_suffix = 'system prompt',
    placement = 'children',
    child_node_type = 'standard',
    copy_library_prompt_id,
  } = config || {};

  if (!jsonResponse || typeof jsonResponse !== 'object' || Array.isArray(jsonResponse)) {
    return {
      success: false,
      error: 'JSON response must be an object',
      createdCount: 0,
      children: [],
    };
  }

  const responseObj = jsonResponse as Record<string, unknown>;

  // Determine which keys to process
  let sectionKeys: string[] = [];
  
  if (Array.isArray(target_keys) && target_keys.length > 0) {
    sectionKeys = (target_keys as string[]).filter(key => key in responseObj);
  } else if (typeof target_keys === 'string' && target_keys) {
    if (target_keys in responseObj) {
      sectionKeys = [target_keys];
    }
  } else {
    let sectionRegex: RegExp;
    try {
      sectionRegex = new RegExp(section_pattern as string, 'i');
    } catch {
      throw new Error(`Invalid regex pattern: ${section_pattern}`);
    }

    const contentSuffixLower = (content_key_suffix as string)?.toLowerCase()?.trim() || '';
    sectionKeys = Object.keys(responseObj).filter(key => {
      const keyLower = key.toLowerCase();
      if (contentSuffixLower && keyLower.endsWith(contentSuffixLower)) {
        return false;
      }
      return sectionRegex.test(key);
    });
  }

  if (sectionKeys.length === 0) {
    return {
      success: true,
      action: 'create_children_sections',
      createdCount: 0,
      children: [],
      message: 'No keys matching criteria found in JSON response',
    };
  }

  // Sort keys naturally
  sectionKeys.sort((a, b) => {
    const numA = parseInt(a.match(/\d+/)?.[0] || '0', 10);
    const numB = parseInt(b.match(/\d+/)?.[0] || '0', 10);
    return numA - numB;
  });

  const defaults = await getDefaultSettings(supabase);
  const modelDefaults = await getModelDefaults(supabase, defaults.default_model || null);
  const actionPromptSettings = await getPromptSettings(supabase, prompt.row_id);
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

  const contentSuffixLower = (content_key_suffix as string)?.toLowerCase()?.trim() || '';
  const createdChildren: unknown[] = [];

  for (const sectionKey of sectionKeys) {
    const sectionValue = responseObj[sectionKey];
    
    let childName: string;
    switch (name_source) {
      case 'key_name':
        childName = sectionKey;
        break;
      case 'both':
        childName = `${sectionKey}: ${typeof sectionValue === 'string' ? sectionValue : JSON.stringify(sectionValue)}`;
        break;
      case 'key_value':
      default:
        childName = typeof sectionValue === 'string' ? sectionValue : JSON.stringify(sectionValue);
        break;
    }

    let content = '';
    if (contentSuffixLower) {
      const contentKey = `${sectionKey} ${content_key_suffix}`;
      const matchingKey = Object.keys(responseObj).find(
        k => k.toLowerCase() === contentKey.toLowerCase()
      );
      if (matchingKey) {
        const contentValue = responseObj[matchingKey];
        content = typeof contentValue === 'string' ? contentValue : JSON.stringify(contentValue, null, 2);
      }
    }

    if (!content && contentSuffixLower) {
      const underscoreSuffix = contentSuffixLower.replace(/\s+/g, '_');
      const contentKey = `${sectionKey}_${underscoreSuffix}`;
      const matchingKey = Object.keys(responseObj).find(
        k => k.toLowerCase() === contentKey.toLowerCase()
      );
      if (matchingKey) {
        const contentValue = responseObj[matchingKey];
        content = typeof contentValue === 'string' ? contentValue : JSON.stringify(contentValue, null, 2);
      }
    }

    const childPositionLex = generatePositionAtEnd(lastPositionKey);
    lastPositionKey = childPositionLex;

    const childData: Record<string, unknown> = {
      parent_row_id: targetParentRowId,
      prompt_name: String(childName).substring(0, 100),
      input_admin_prompt: libraryPrompt?.content || content || actionPromptSettings.input_admin_prompt || defaults.def_admin_prompt || '',
      input_user_prompt: content ? '' : (typeof sectionValue === 'string' ? sectionValue : ''),
      position_lex: childPositionLex,
      is_deleted: false,
      owner_id: (context?.userId as string) || prompt.owner_id,
      node_type: child_node_type || 'standard',
      is_assistant: true,
      extracted_variables: { 
        section_key: sectionKey, 
        section_value: sectionValue,
        has_content: !!content 
      },
      model: actionPromptSettings.model || modelDefaults.model_id,
      model_on: actionPromptSettings.model_on ?? (modelDefaults as unknown as Record<string, unknown>).model_on,
      temperature: actionPromptSettings.temperature ?? modelDefaults.temperature,
      temperature_on: actionPromptSettings.temperature_on ?? modelDefaults.temperature_on,
      max_tokens: actionPromptSettings.max_tokens ?? modelDefaults.max_tokens,
      max_tokens_on: actionPromptSettings.max_tokens_on ?? modelDefaults.max_tokens_on,
      max_completion_tokens: actionPromptSettings.max_completion_tokens ?? modelDefaults.max_completion_tokens,
      max_completion_tokens_on: actionPromptSettings.max_completion_tokens_on ?? modelDefaults.max_completion_tokens_on,
      web_search_on: actionPromptSettings.web_search_on,
      confluence_enabled: actionPromptSettings.confluence_enabled,
      thread_mode: actionPromptSettings.thread_mode,
      child_thread_strategy: actionPromptSettings.child_thread_strategy,
    };

    if ((child_node_type as string) === 'action' && actionPromptSettings.response_format_on) {
      childData.response_format = actionPromptSettings.response_format;
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
      console.error('Error creating child node from section:', error);
      throw error;
    }
    
    if (!data) {
      throw new Error(`Failed to create child node from section "${sectionKey}" - no data returned`);
    }

    createdChildren.push(data);
  }

  const placementText: Record<string, string> = {
    children: 'as children of this prompt',
    siblings: 'at the same level',
    top_level: 'as top-level prompts',
  };

  const nodeTypeText = (child_node_type as string) === 'action' ? ' action' : '';

  return {
    success: true,
    action: 'create_children_sections',
    createdCount: createdChildren.length,
    children: createdChildren,
    placement,
    childNodeType: child_node_type,
    sectionKeys,
    message: `Created ${createdChildren.length}${nodeTypeText} prompt(s) ${placementText[placement as string] || ''} from section keys`,
  };
};
