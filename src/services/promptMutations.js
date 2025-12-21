import { deletePrompt } from './promptDeletion';
import { getLevelNamingConfig, generatePromptName } from '@/utils/namingTemplates';
import { calculateNewPositions } from '@/utils/positionUtils';

export const movePromptPosition = async (supabase, itemId, siblings, currentIndex, direction) => {
  const result = calculateNewPositions(siblings, currentIndex, direction);
  
  if (!result) {
    return false;
  }

  const { error } = await supabase
    .from(import.meta.env.VITE_PROMPTS_TBL)
    .update({ position: result.newPosition })
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

export const addPrompt = async (supabase, parentId = null, defaultAdminPrompt = '', userId = null, defaultConversationInstructions = '') => {
  // First, get the maximum position value for the current level
  let query = supabase
    .from(import.meta.env.VITE_PROMPTS_TBL)
    .select('position')
    .eq('is_deleted', false)
    .order('position', { ascending: false })
    .limit(1);
  
  if (parentId) {
    query = query.eq('parent_row_id', parentId);
  } else {
    query = query.is('parent_row_id', null);
  }
  
  const { data: existingPrompts } = await query;
  const maxPosition = existingPrompts?.[0]?.position || 0;
  
  // Get context for naming
  const { level, topLevelName } = await getPromptContext(supabase, parentId);
  
  // Fetch global naming settings
  const { data: settings } = await supabase
    .from(import.meta.env.VITE_SETTINGS_TBL)
    .select('setting_key, setting_value')
    .in('setting_key', ['naming_top_level_template', 'naming_child_template', 'naming_grandchild_template', 'naming_default_template']);
  
  const settingsMap = {};
  (settings || []).forEach(s => {
    settingsMap[s.setting_key] = s.setting_value;
  });
  
  // Get naming config for this level
  const namingConfig = getLevelNamingConfig(level, settingsMap);
  
  // Get sibling count for ordering
  let siblingQuery = supabase
    .from(import.meta.env.VITE_PROMPTS_TBL)
    .select('row_id', { count: 'exact' })
    .eq('is_deleted', false);
    
  if (parentId) {
    siblingQuery = siblingQuery.eq('parent_row_id', parentId);
  } else {
    siblingQuery = siblingQuery.is('parent_row_id', null);
  }
  
  const { count: siblingCount } = await siblingQuery;
  
  // Generate prompt name
  const promptName = generatePromptName(namingConfig, {
    level,
    siblingOrder: (siblingCount || 0) + 1,
    topLevelName,
    parentName: topLevelName,
  });
  
  // Prepare insert data
  const insertData = {
    parent_row_id: parentId,
    prompt_name: promptName,
    input_admin_prompt: defaultAdminPrompt || null,
    is_assistant: parentId === null, // Top-level prompts are conversations
    position: maxPosition + 1000000,
    is_deleted: false,
    owner_id: userId,
  };
  
  // Insert the new prompt
  const { data, error } = await supabase
    .from(import.meta.env.VITE_PROMPTS_TBL)
    .insert([insertData])
    .select();

  if (error) {
    console.error('Failed to add prompt:', error);
    throw error;
  }
  
  // If this is a top-level prompt, create a conversation record
  if (parentId === null && data?.[0]?.row_id) {
    await createConversation(supabase, data[0].row_id, promptName, defaultConversationInstructions);
  }

  return data;
};

export const duplicatePrompt = async (supabase, sourcePromptId, userId = null) => {
  // Fetch the source prompt
  const { data: sourcePrompt, error: fetchError } = await supabase
    .from(import.meta.env.VITE_PROMPTS_TBL)
    .select('*')
    .eq('row_id', sourcePromptId)
    .single();

  if (fetchError) throw fetchError;
  if (!sourcePrompt) throw new Error('Source prompt not found');

  // Get max position at same level
  let query = supabase
    .from(import.meta.env.VITE_PROMPTS_TBL)
    .select('position')
    .eq('is_deleted', false)
    .order('position', { ascending: false })
    .limit(1);

  if (sourcePrompt.parent_row_id) {
    query = query.eq('parent_row_id', sourcePrompt.parent_row_id);
  } else {
    query = query.is('parent_row_id', null);
  }

  const { data: posData } = await query;
  const maxPosition = posData?.[0]?.position || 0;

  // Create duplicate with "(copy)" suffix
  const { row_id, created_at, updated_at, ...promptFields } = sourcePrompt;
  
  const { data: newPrompt, error: insertError } = await supabase
    .from(import.meta.env.VITE_PROMPTS_TBL)
    .insert([{
      ...promptFields,
      prompt_name: `${sourcePrompt.prompt_name} (copy)`,
      position: maxPosition + 1000000,
      owner_id: userId || sourcePrompt.owner_id,
    }])
    .select()
    .single();

  if (insertError) throw insertError;

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
    .order('position');

  if (children && children.length > 0) {
    for (const child of children) {
      await duplicateChildPrompt(supabase, child.row_id, newPrompt.row_id, userId);
    }
  }

  return newPrompt;
};

// Helper for duplicating child prompts (not top-level, so no assistant needed)
const duplicateChildPrompt = async (supabase, sourcePromptId, newParentId, userId) => {
  const { data: sourcePrompt, error: fetchError } = await supabase
    .from(import.meta.env.VITE_PROMPTS_TBL)
    .select('*')
    .eq('row_id', sourcePromptId)
    .single();

  if (fetchError) throw fetchError;

  const { row_id, created_at, updated_at, parent_row_id, ...promptFields } = sourcePrompt;
  
  const { data: newPrompt, error: insertError } = await supabase
    .from(import.meta.env.VITE_PROMPTS_TBL)
    .insert([{
      ...promptFields,
      parent_row_id: newParentId,
      owner_id: userId || sourcePrompt.owner_id,
    }])
    .select()
    .single();

  if (insertError) throw insertError;

  // Recursively duplicate children of this child
  const { data: children } = await supabase
    .from(import.meta.env.VITE_PROMPTS_TBL)
    .select('row_id')
    .eq('parent_row_id', sourcePromptId)
    .eq('is_deleted', false)
    .order('position');

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

export { deletePrompt };
