/**
 * Create Children (Text) Action Executor
 * 
 * Creates a specified number of child nodes with optional content from library prompts.
 * Supports naming templates like {{n}}, {{nn}}, {{A}}, {{date:FORMAT}}.
 */

import { processNamingTemplate } from '../../utils/namingTemplates';
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
