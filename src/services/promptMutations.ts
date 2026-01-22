/**
 * Prompt Mutations Service
 * Handles creating, duplicating, moving, and updating prompts
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type { PromptData } from '@/types';
import { deletePrompt } from './promptDeletion';
import { getLevelNamingConfig, generatePromptName } from '@/utils/namingTemplates';
import { calculateNewPositions } from '@/utils/positionUtils';
import { generatePositionAtEnd, generatePositionBetween } from '@/utils/lexPosition';
import { trackEvent, trackException } from '@/lib/posthog';

/**
 * Prompt context for hierarchical naming
 */
interface PromptContext {
  level: number;
  topLevelName: string | null;
}

/**
 * Inherited properties from parent prompt
 */
interface InheritedProps {
  thread_mode?: string | null;
  child_thread_strategy?: string | null;
  default_child_thread_strategy?: string | null;
  model?: string | null;
  model_on?: boolean;
  web_search_on?: boolean;
  confluence_enabled?: boolean;
}

/**
 * Move a prompt to a new position among siblings
 * 
 * @param supabase - Supabase client instance
 * @param itemId - Prompt row ID to move
 * @param siblings - Array of sibling prompts
 * @param currentIndex - Current index in siblings array
 * @param direction - Direction to move ('up' or 'down')
 * @returns True if move succeeded
 */
export const movePromptPosition = async (
  supabase: SupabaseClient, 
  itemId: string, 
  siblings: PromptData[], 
  currentIndex: number, 
  direction: 'up' | 'down'
): Promise<boolean> => {
  const result = calculateNewPositions(siblings, currentIndex, direction);
  
  if (!result) {
    return false;
  }

  const { error } = await supabase
    .from(import.meta.env.VITE_PROMPTS_TBL)
    .update({ position_lex: result.newPositionLex })
    .eq('row_id', itemId);

  if (error) {
    console.error('Failed to update position:', error);
    return false;
  }

  return true;
};

/**
 * Calculate the depth level and find top-level ancestor
 */
const getPromptContext = async (
  supabase: SupabaseClient, 
  parentId: string | null
): Promise<PromptContext> => {
  if (!parentId) {
    return { level: 0, topLevelName: null };
  }

  let currentId: string | null = parentId;
  let level = 1;
  let topLevelName: string | null = null;
  
  // Walk up the tree to find depth and top-level ancestor
  while (currentId) {
    const { data: parent } = await supabase
      .from(import.meta.env.VITE_PROMPTS_TBL)
      .select('row_id, parent_row_id, prompt_name')
      .eq('row_id', currentId)
      .maybeSingle();
    
    if (!parent) break;
    
    if (!parent.parent_row_id) {
      // This is the top-level prompt
      topLevelName = parent.prompt_name;
      break;
    }
    
    currentId = parent.parent_row_id;
    level++;
  }
  
  return { level, topLevelName };
};

/**
 * Create a conversation record for a top-level prompt (Responses API - no instantiation needed)
 */
const createConversation = async (
  supabase: SupabaseClient, 
  promptRowId: string, 
  promptName: string, 
  instructions: string = ''
): Promise<string | null> => {
  try {
    const insertData: Record<string, unknown> = {
      prompt_row_id: promptRowId,
      name: promptName,
      status: 'active', // Responses API is always ready
      api_version: 'responses',
      use_global_tool_defaults: true,
    };
    
    if (instructions) {
      insertData.instructions = instructions;
    }
    
    const { data: conversation, error: createError } = await supabase
      .from(import.meta.env.VITE_ASSISTANTS_TBL)
      .insert([insertData])
      .select()
      .maybeSingle();

    if (createError) {
      console.error('Failed to create conversation record:', createError);
      return null;
    }

    console.log('Created conversation record:', conversation?.row_id);
    return conversation?.row_id || null;
  } catch (error) {
    console.error('Error in createConversation:', error);
    return null;
  }
};

/**
 * Get last position_lex at a given level
 */
const getLastPositionKey = async (
  supabase: SupabaseClient, 
  parentRowId: string | null
): Promise<string | null> => {
  let query = supabase
    .from(import.meta.env.VITE_PROMPTS_TBL)
    .select('position_lex')
    .eq('is_deleted', false)
    .not('position_lex', 'is', null)
    .order('position_lex', { ascending: false })
    .limit(1);
  
  if (parentRowId) {
    query = query.eq('parent_row_id', parentRowId);
  } else {
    query = query.is('parent_row_id', null);
  }
  
  const { data } = await query;
  return data?.[0]?.position_lex || null;
};

/**
 * Add a new prompt
 * 
 * @param supabase - Supabase client instance
 * @param parentId - Parent prompt ID (null for top-level)
 * @param defaultAdminPrompt - Default system prompt content
 * @param userId - User ID (required for RLS)
 * @param defaultConversationInstructions - Instructions for conversation
 * @param insertAfterPromptId - Insert as sibling after this prompt
 * @returns Created prompt data
 */
export const addPrompt = async (
  supabase: SupabaseClient, 
  parentId: string | null = null, 
  defaultAdminPrompt: string = '', 
  userId: string | null = null, 
  defaultConversationInstructions: string = '', 
  insertAfterPromptId: string | null = null
): Promise<PromptData[]> => {
  // CRITICAL: Validate userId to prevent RLS issues where INSERT succeeds but SELECT fails
  if (!userId) {
    const authError = new Error('Cannot create prompt: User ID is required. Please ensure you are logged in.');
    (authError as Error & { code?: string }).code = 'AUTH_REQUIRED';
    console.error('[addPrompt] Missing userId - user may not be logged in');
    throw authError;
  }

  // Calculate position based on insertion context
  let newPositionLex: string | undefined;
  let effectiveParentId = parentId;
  
  if (insertAfterPromptId) {
    // Insert as sibling right after the specified prompt
    const { data: referencePrompt } = await supabase
      .from(import.meta.env.VITE_PROMPTS_TBL)
      .select('row_id, position_lex, parent_row_id')
      .eq('row_id', insertAfterPromptId)
      .maybeSingle();
    
    if (referencePrompt) {
      // Use the same parent as the reference prompt (insert as sibling)
      effectiveParentId = referencePrompt.parent_row_id;
      
      // Find the next sibling's position
      let nextQuery = supabase
        .from(import.meta.env.VITE_PROMPTS_TBL)
        .select('position_lex')
        .eq('is_deleted', false)
        .gt('position_lex', referencePrompt.position_lex)
        .order('position_lex', { ascending: true })
        .limit(1);
      
      if (effectiveParentId) {
        nextQuery = nextQuery.eq('parent_row_id', effectiveParentId);
      } else {
        nextQuery = nextQuery.is('parent_row_id', null);
      }
      
      const { data: nextSibling } = await nextQuery;
      
      if (nextSibling?.[0]?.position_lex) {
        // Insert between reference and next sibling
        newPositionLex = generatePositionBetween(referencePrompt.position_lex, nextSibling[0].position_lex);
      } else {
        // No next sibling, insert after reference
        newPositionLex = generatePositionAtEnd(referencePrompt.position_lex);
      }
    }
  }
  
  // Fallback: get last position at the target level (append to end)
  if (!newPositionLex) {
    const lastKey = await getLastPositionKey(supabase, effectiveParentId);
    newPositionLex = generatePositionAtEnd(lastKey);
  }
  
  // Get context for naming (use effectiveParentId for correct level calculation)
  const { level, topLevelName } = await getPromptContext(supabase, effectiveParentId);
  
  // Fetch parent properties to inherit for child prompts
  let inheritedProps: InheritedProps = {};
  if (effectiveParentId) {
    const { data: parentPrompt } = await supabase
      .from(import.meta.env.VITE_PROMPTS_TBL)
      .select('thread_mode, child_thread_strategy, default_child_thread_strategy, model, model_on, web_search_on, confluence_enabled')
      .eq('row_id', effectiveParentId)
      .maybeSingle();
    
    if (parentPrompt) {
      inheritedProps = {
        thread_mode: parentPrompt.thread_mode,
        // Use parent's default_child_thread_strategy for the child's child_thread_strategy
        child_thread_strategy: parentPrompt.default_child_thread_strategy || parentPrompt.child_thread_strategy,
        default_child_thread_strategy: parentPrompt.default_child_thread_strategy,
        model: parentPrompt.model,
        model_on: parentPrompt.model_on,
        web_search_on: parentPrompt.web_search_on,
        confluence_enabled: parentPrompt.confluence_enabled,
      };
    }
  }
  
  // Fetch global model defaults (same as template-based creation)
  const modelDefaults: Record<string, unknown> = {};
  const { data: defaultModelSetting } = await supabase
    .from(import.meta.env.VITE_SETTINGS_TBL)
    .select('setting_value')
    .eq('setting_key', 'default_model')
    .maybeSingle();

  const defaultModelId = defaultModelSetting?.setting_value;

  if (defaultModelId) {
    const { data: defaultsData } = await supabase
      .from(import.meta.env.VITE_MODEL_DEFAULTS_TBL)
      .select('*')
      .eq('model_id', defaultModelId)
      .maybeSingle();

    if (defaultsData) {
      // All model settings fields that can have defaults
      // CRITICAL: max_tokens and max_completion_tokens are separate - GPT-4 vs GPT-5
      const defaultSettingFields = ['temperature', 'max_tokens', 'max_completion_tokens', 'top_p', 'frequency_penalty', 
        'presence_penalty', 'reasoning_effort', 'stop', 'n', 'stream', 'response_format', 'logit_bias', 'o_user', 'seed', 'tool_choice'];
      
      defaultSettingFields.forEach(field => {
        if ((defaultsData as Record<string, unknown>)[`${field}_on`]) {
          modelDefaults[field] = (defaultsData as Record<string, unknown>)[field];
          modelDefaults[`${field}_on`] = true;
        }
      });
      
      // Only set default model if not inheriting from parent
      if (!inheritedProps.model) {
        modelDefaults.model = defaultModelId;
        modelDefaults.model_on = true;
      }
    }
  }
  
  // Fetch global naming settings (stored as JSON in prompt_naming_defaults)
  const { data: namingSettingData } = await supabase
    .from(import.meta.env.VITE_SETTINGS_TBL)
    .select('setting_value')
    .eq('setting_key', 'prompt_naming_defaults')
    .maybeSingle();
  
  let namingConfig = null;
  if (namingSettingData?.setting_value) {
    try {
      namingConfig = JSON.parse(namingSettingData.setting_value);
    } catch (e) {
      console.error('Failed to parse naming config:', e);
    }
  }
  
  // Get naming config for this level (getLevelNamingConfig expects: namingConfig, level, topLevelName)
  const levelConfig = getLevelNamingConfig(namingConfig, level, topLevelName);
  
  // Get sibling count for ordering
  let siblingQuery = supabase
    .from(import.meta.env.VITE_PROMPTS_TBL)
    .select('row_id', { count: 'exact' })
    .eq('is_deleted', false);
    
  if (effectiveParentId) {
    siblingQuery = siblingQuery.eq('parent_row_id', effectiveParentId);
  } else {
    siblingQuery = siblingQuery.is('parent_row_id', null);
  }
  
  const { count: siblingCount } = await siblingQuery;
  
  // Generate prompt name (expects: levelConfig, sequenceNumber, date)
  const promptName = generatePromptName(levelConfig, siblingCount || 0, new Date());
  
  // Prepare insert data - apply model defaults first, then inherit/override from parent
  const insertData: Record<string, unknown> = {
    parent_row_id: effectiveParentId,
    prompt_name: promptName,
    input_admin_prompt: defaultAdminPrompt || null,
    position_lex: newPositionLex,
    is_deleted: false,
    owner_id: userId,
    // Apply global model defaults first
    ...modelDefaults,
    // Then apply inherited properties from parent (overrides defaults where set)
    is_assistant: true,
    thread_mode: inheritedProps.thread_mode || null,
    child_thread_strategy: inheritedProps.child_thread_strategy || null,
    default_child_thread_strategy: inheritedProps.default_child_thread_strategy || null,
    web_search_on: inheritedProps.web_search_on || false,
    confluence_enabled: inheritedProps.confluence_enabled || false,
  };
  
  // Override model from parent if set
  if (inheritedProps.model) {
    insertData.model = inheritedProps.model;
    insertData.model_on = inheritedProps.model_on;
  }
  
  // Insert the new prompt
  const { data, error } = await supabase
    .from(import.meta.env.VITE_PROMPTS_TBL)
    .insert([insertData])
    .select();

  if (error) {
    console.error('Failed to add prompt:', error);
    trackException(error, { context: 'promptMutations.addPrompt' });
    throw error;
  }

  // CRITICAL: Detect RLS SELECT block (INSERT succeeded but SELECT returned empty)
  // This happens when owner_id doesn't match auth.uid() in the SELECT policy
  if (!data || data.length === 0) {
    const rlsError = new Error(
      'Prompt was created but could not be retrieved. ' +
      'This usually means the owner_id does not match your user ID. ' +
      'Please ensure you are logged in.'
    );
    (rlsError as Error & { code?: string }).code = 'RLS_SELECT_BLOCKED';
    console.error('[addPrompt] Empty data after INSERT:', { 
      userId, 
      effectiveParentId,
      insertData 
    });
    trackException(rlsError, { 
      context: 'promptMutations.addPrompt.emptyData', 
      userId, 
      parentId: effectiveParentId 
    });
    throw rlsError;
  }
  
  // If this is a top-level prompt, create a conversation record
  if (effectiveParentId === null && data?.[0]?.row_id) {
    await createConversation(supabase, data[0].row_id, promptName, defaultConversationInstructions);
  }

  trackEvent('prompt_created', { 
    prompt_id: data?.[0]?.row_id, 
    is_top_level: effectiveParentId === null,
    level 
  });

  return data as PromptData[];
};

/**
 * Helper for duplicating child prompts (not top-level, so no assistant needed)
 */
const duplicateChildPrompt = async (
  supabase: SupabaseClient, 
  sourcePromptId: string, 
  newParentId: string, 
  userId: string
): Promise<PromptData> => {
  const { data: sourcePrompt, error: fetchError } = await supabase
    .from(import.meta.env.VITE_PROMPTS_TBL)
    .select('*')
    .eq('row_id', sourcePromptId)
    .maybeSingle();

  if (fetchError) throw fetchError;
  if (!sourcePrompt) throw new Error('Source prompt not found');

  // Get last position for the new parent's children
  const lastKey = await getLastPositionKey(supabase, newParentId);
  const newPositionLex = generatePositionAtEnd(lastKey);

  const { 
    row_id, 
    created_at, 
    updated_at, 
    parent_row_id, 
    position, 
    position_lex, 
    ...promptFields 
  } = sourcePrompt;
  
  const { data: newPrompt, error: insertError } = await supabase
    .from(import.meta.env.VITE_PROMPTS_TBL)
    .insert([{
      ...promptFields,
      parent_row_id: newParentId,
      position_lex: newPositionLex,
      owner_id: userId, // Always use authenticated user's ID
    }])
    .select()
    .maybeSingle();

  if (insertError) throw insertError;

  // Recursively duplicate children of this child
  const { data: children } = await supabase
    .from(import.meta.env.VITE_PROMPTS_TBL)
    .select('row_id')
    .eq('parent_row_id', sourcePromptId)
    .eq('is_deleted', false)
    .order('position_lex');

  if (children && children.length > 0) {
    for (const child of children) {
      await duplicateChildPrompt(supabase, child.row_id, newPrompt.row_id, userId);
    }
  }

  return newPrompt as PromptData;
};

/**
 * Duplicate a prompt and all its children
 * 
 * @param supabase - Supabase client instance
 * @param sourcePromptId - Prompt ID to duplicate
 * @param userId - User ID (required for RLS)
 * @returns Duplicated prompt data
 */
export const duplicatePrompt = async (
  supabase: SupabaseClient, 
  sourcePromptId: string, 
  userId: string | null = null
): Promise<PromptData> => {
  // CRITICAL: Validate userId to prevent orphaned duplicates that user can't see
  if (!userId) {
    const authError = new Error('Cannot duplicate prompt: User ID is required. Please ensure you are logged in.');
    (authError as Error & { code?: string }).code = 'AUTH_REQUIRED';
    console.error('[duplicatePrompt] Missing userId - user may not be logged in');
    throw authError;
  }

  // Fetch the source prompt
  const { data: sourcePrompt, error: fetchError } = await supabase
    .from(import.meta.env.VITE_PROMPTS_TBL)
    .select('*')
    .eq('row_id', sourcePromptId)
    .maybeSingle();

  if (fetchError) throw fetchError;
  if (!sourcePrompt) throw new Error('Source prompt not found');

  // Get last position_lex at same level
  const lastKey = await getLastPositionKey(supabase, sourcePrompt.parent_row_id);
  const newPositionLex = generatePositionAtEnd(lastKey);

  // Create duplicate with "(copy)" suffix
  const { row_id, created_at, updated_at, position, position_lex, ...promptFields } = sourcePrompt;
  
  const { data: newPrompt, error: insertError } = await supabase
    .from(import.meta.env.VITE_PROMPTS_TBL)
    .insert([{
      ...promptFields,
      prompt_name: `${sourcePrompt.prompt_name} (copy)`,
      position_lex: newPositionLex,
      owner_id: userId, // Always use authenticated user's ID
    }])
    .select()
    .maybeSingle();

  if (insertError) {
    trackException(insertError, { context: 'promptMutations.duplicatePrompt' });
    throw insertError;
  }

  // If duplicating a top-level prompt, also create a conversation record
  if (!sourcePrompt.parent_row_id && newPrompt?.row_id) {
    // Fetch the source conversation for instructions
    const { data: sourceConversation } = await supabase
      .from(import.meta.env.VITE_ASSISTANTS_TBL)
      .select('instructions')
      .eq('prompt_row_id', sourcePromptId)
      .maybeSingle();

    await createConversation(
      supabase, 
      newPrompt.row_id, 
      `${sourcePrompt.prompt_name} (copy)`,
      sourceConversation?.instructions || ''
    );
  }

  // Recursively duplicate children
  const { data: children } = await supabase
    .from(import.meta.env.VITE_PROMPTS_TBL)
    .select('row_id')
    .eq('parent_row_id', sourcePromptId)
    .eq('is_deleted', false)
    .order('position_lex');

  if (children && children.length > 0) {
    for (const child of children) {
      await duplicateChildPrompt(supabase, child.row_id, newPrompt.row_id, userId);
    }
  }

  trackEvent('prompt_duplicated', { 
    source_id: sourcePromptId, 
    new_id: newPrompt?.row_id,
    is_top_level: !sourcePrompt.parent_row_id 
  });

  return newPrompt as PromptData;
};

/**
 * Update a single field on a prompt
 * 
 * @param supabase - Supabase client instance
 * @param promptId - Prompt row ID
 * @param field - Field name to update
 * @param value - New value for the field
 */
export const updatePromptField = async (
  supabase: SupabaseClient, 
  promptId: string, 
  field: string, 
  value: unknown
): Promise<void> => {
  const { error } = await supabase
    .from(import.meta.env.VITE_PROMPTS_TBL)
    .update({ [field]: value })
    .eq('row_id', promptId);

  if (error) throw error;
};

/**
 * Update a prompt's icon
 * 
 * @param supabase - Supabase client instance
 * @param promptId - Prompt row ID
 * @param iconName - New icon name
 */
export const updatePromptIcon = async (
  supabase: SupabaseClient, 
  promptId: string, 
  iconName: string | null
): Promise<void> => {
  const { error } = await supabase
    .from(import.meta.env.VITE_PROMPTS_TBL)
    .update({ icon_name: iconName })
    .eq('row_id', promptId);

  if (error) throw error;
};

// Re-export deletePrompt from promptDeletion
export { deletePrompt };
