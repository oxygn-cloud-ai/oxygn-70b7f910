/**
 * Create Children (Sections) Action Executor
 * 
 * Creates child nodes from JSON keys matching a pattern or explicit key list.
 * Each matching key becomes a child node with the value as the name.
 * Optionally looks for corresponding content keys (e.g., "section 01 system prompt").
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
  getDefaultSettings, 
  getModelDefaults, 
  getLibraryPrompt,
  getParentSettings,
} from './helpers';

// Table reference - validated at import time
const PROMPTS_TABLE = getEnvOrThrow('VITE_PROMPTS_TBL');

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
  const actionPromptSettings = await getParentSettings(supabase, prompt.row_id);
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
      model_on: actionPromptSettings.model_on ?? modelDefaults.model_on,
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
