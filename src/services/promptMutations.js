import { deletePrompt } from './promptDeletion';
import { getLevelNamingConfig, generatePromptName } from '@/utils/namingTemplates';
import { calculateNewPositions } from '@/utils/positionUtils';
import { generatePositionAtEnd, generatePositionBetween } from '@/utils/lexPosition';
import { trackEvent, trackException } from '@/lib/posthog';

export const movePromptPosition = async (supabase, itemId, siblings, currentIndex, direction) => {
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

// Helper to calculate the depth level and find top-level ancestor
const getPromptContext = async (supabase, parentId) => {
  if (!parentId) {
    return { level: 0, topLevelName: null };
  }

  let currentId = parentId;
  let level = 1;
  let topLevelName = null;
  
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

// Helper to create a conversation record for a top-level prompt (Responses API - no instantiation needed)
const createConversation = async (supabase, promptRowId, promptName, instructions = '') => {
  try {
    const insertData = {
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

    console.log('Created conversation record:', conversation.row_id);
    return conversation.row_id;
  } catch (error) {
    console.error('Error in createConversation:', error);
    return null;
  }
};

// Helper to get last position_lex at a given level
const getLastPositionKey = async (supabase, parentRowId) => {
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

export const addPrompt = async (supabase, parentId = null, defaultAdminPrompt = '', userId = null, defaultConversationInstructions = '', insertAfterPromptId = null) => {
  // CRITICAL: Validate userId to prevent RLS issues where INSERT succeeds but SELECT fails
  if (!userId) {
    const authError = new Error('Cannot create prompt: User ID is required. Please ensure you are logged in.');
    authError.code = 'AUTH_REQUIRED';
    console.error('[addPrompt] Missing userId - user may not be logged in');
    throw authError;
  }

  // Calculate position based on insertion context
  let newPositionLex;
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
  let inheritedProps = {};
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
  let modelDefaults = {};
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
        if (defaultsData[`${field}_on`]) {
          modelDefaults[field] = defaultsData[field];
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
  const insertData = {
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
  };
  
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
    rlsError.code = 'RLS_SELECT_BLOCKED';
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

  return data;
};

export const duplicatePrompt = async (supabase, sourcePromptId, userId = null) => {
  // CRITICAL: Validate userId to prevent orphaned duplicates that user can't see
  if (!userId) {
    const authError = new Error('Cannot duplicate prompt: User ID is required. Please ensure you are logged in.');
    authError.code = 'AUTH_REQUIRED';
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

  return newPrompt;
};

// Helper for duplicating child prompts (not top-level, so no assistant needed)
const duplicateChildPrompt = async (supabase, sourcePromptId, newParentId, userId) => {
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

  const { row_id, created_at, updated_at, parent_row_id, position, position_lex, ...promptFields } = sourcePrompt;
  
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

  return newPrompt;
};

export const updatePromptField = async (supabase, promptId, field, value) => {
  const { error } = await supabase
    .from(import.meta.env.VITE_PROMPTS_TBL)
    .update({ [field]: value })
    .eq('row_id', promptId);

  if (error) throw error;
};

export const updatePromptIcon = async (supabase, promptId, iconName) => {
  const { error } = await supabase
    .from(import.meta.env.VITE_PROMPTS_TBL)
    .update({ icon_name: iconName })
    .eq('row_id', promptId);

  if (error) throw error;
};

export { deletePrompt };
