import { deletePrompt } from './promptDeletion';
import { getLevelNamingConfig, generatePromptName } from '@/utils/namingTemplates';

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

// Helper to create and instantiate an assistant for a top-level prompt
const createAndInstantiateAssistant = async (supabase, promptRowId, promptName) => {
  try {
    // Create cyg_assistants record
    const { data: assistant, error: createError } = await supabase
      .from('cyg_assistants')
      .insert([{
        prompt_row_id: promptRowId,
        name: promptName,
        status: 'not_instantiated',
        use_global_tool_defaults: true,
      }])
      .select()
      .single();

    if (createError) {
      console.error('Failed to create assistant record:', createError);
      return null;
    }

    console.log('Created assistant record:', assistant.row_id);

    // Call edge function to instantiate in OpenAI
    const { data: instantiateResult, error: instantiateError } = await supabase.functions.invoke('assistant-manager', {
      body: {
        action: 'instantiate',
        assistant_row_id: assistant.row_id,
      },
    });

    if (instantiateError) {
      console.error('Failed to instantiate assistant:', instantiateError);
      // Don't fail the prompt creation, just log the error
      return assistant.row_id;
    }

    if (instantiateResult?.error) {
      console.error('Assistant instantiation error:', instantiateResult.error);
      return assistant.row_id;
    }

    console.log('Instantiated assistant in OpenAI:', instantiateResult?.assistant_id);
    return assistant.row_id;
  } catch (error) {
    console.error('Error in createAndInstantiateAssistant:', error);
    return null;
  }
};

export const addPrompt = async (supabase, parentId = null, defaultAdminPrompt = '') => {
  // First, get the maximum position value for the current level
  let query = supabase
    .from(import.meta.env.VITE_PROMPTS_TBL)
    .select('position')
    .eq('is_deleted', false)
    .order('position', { ascending: false })
    .limit(1);
  
  // Handle null parent_row_id correctly
  if (parentId === null) {
    query = query.is('parent_row_id', null);
  } else {
    query = query.eq('parent_row_id', parentId);
  }

  const { data: maxPositionData, error: positionError } = await query;

  if (positionError) throw positionError;

  // Calculate the new position (either max + 1000000 or start at 1000000)
  const newPosition = maxPositionData && maxPositionData.length > 0
    ? (maxPositionData[0].position || 0) + 1000000
    : 1000000;

  // Get sibling count for sequence number
  let siblingsQuery = supabase
    .from(import.meta.env.VITE_PROMPTS_TBL)
    .select('row_id', { count: 'exact', head: true })
    .eq('is_deleted', false);
  
  if (parentId === null) {
    siblingsQuery = siblingsQuery.is('parent_row_id', null);
  } else {
    siblingsQuery = siblingsQuery.eq('parent_row_id', parentId);
  }
  
  const { count: siblingCount, error: countError } = await siblingsQuery;
  
  // Ensure siblingCount is a valid number
  const sequenceNumber = typeof siblingCount === 'number' ? siblingCount : parseInt(siblingCount, 10) || 0;
  console.log('Sibling count query result:', { siblingCount, countError, parentId, sequenceNumber });

  // Get prompt context (level and top-level name)
  const { level, topLevelName } = await getPromptContext(supabase, parentId);

  // Get naming settings
  const { data: namingSettingsData } = await supabase
    .from(import.meta.env.VITE_SETTINGS_TBL)
    .select('setting_value')
    .eq('setting_key', 'prompt_naming_defaults')
    .maybeSingle();

  let newPromptName;
  
  console.log('Naming context:', { level, topLevelName, sequenceNumber, hasNamingSettings: !!namingSettingsData?.setting_value });
  
  if (namingSettingsData?.setting_value) {
    try {
      const namingConfig = JSON.parse(namingSettingsData.setting_value);
      const levelConfig = getLevelNamingConfig(namingConfig, level, topLevelName);
      console.log('Level config:', levelConfig);
      newPromptName = generatePromptName(levelConfig, sequenceNumber);
      console.log('Generated name:', newPromptName);
    } catch (e) {
      console.error('Failed to parse naming config:', e);
    }
  }

  // Fallback to old naming logic if no naming config or parsing failed
  if (!newPromptName) {
    const { data: existingPrompts, error: nameError } = await supabase
      .from(import.meta.env.VITE_PROMPTS_TBL)
      .select('prompt_name')
      .eq('is_deleted', false);

    if (nameError) throw nameError;

    let maxNumber = 0;
    const newPromptRegex = /^New Prompt(?: (\d+))?$/;
    
    if (existingPrompts) {
      existingPrompts.forEach(prompt => {
        const match = prompt.prompt_name?.match(newPromptRegex);
        if (match) {
          const num = match[1] ? parseInt(match[1], 10) : 1;
          if (num > maxNumber) {
            maxNumber = num;
          }
        }
      });
    }

    newPromptName = `New Prompt ${maxNumber + 1}`;
  }

  // Get default model from settings
  const { data: settingsData } = await supabase
    .from(import.meta.env.VITE_SETTINGS_TBL)
    .select('setting_value')
    .eq('setting_key', 'default_model')
    .maybeSingle();

  const defaultModelId = settingsData?.setting_value;

  // Get model defaults if a default model is set
  let modelDefaults = {};
  if (defaultModelId) {
    const { data: defaultsData } = await supabase
      .from('cyg_model_defaults')
      .select('*')
      .eq('model_id', defaultModelId)
      .maybeSingle();

    if (defaultsData) {
      // Copy over all enabled settings from model defaults
      const settingFields = ['temperature', 'max_tokens', 'top_p', 'frequency_penalty', 
        'presence_penalty', 'stop', 'n', 'stream', 'response_format', 'logit_bias', 'o_user'];
      
      settingFields.forEach(field => {
        if (defaultsData[`${field}_on`]) {
          modelDefaults[field] = defaultsData[field];
          modelDefaults[`${field}_on`] = true;
        }
      });
      
      // Set the model
      modelDefaults.model = defaultModelId;
      modelDefaults.model_on = true;
    }
  }

  // For top-level prompts, set is_assistant to true
  const isTopLevel = parentId === null;

  const { data, error } = await supabase
    .from(import.meta.env.VITE_PROMPTS_TBL)
    .insert([{
      parent_row_id: parentId,
      input_admin_prompt: defaultAdminPrompt || '',
      is_deleted: false,
      prompt_name: newPromptName,
      position: newPosition,
      is_assistant: isTopLevel, // Auto-set for top-level prompts
      ...modelDefaults
    }])
    .select();

  if (error) throw error;

  const newPromptRowId = data[0].row_id;

  // For top-level prompts, create and instantiate assistant (non-blocking for speed)
  if (isTopLevel) {
    // Fire-and-forget: don't await, let it complete in background
    createAndInstantiateAssistant(supabase, newPromptRowId, newPromptName)
      .catch(err => console.error('Background assistant creation failed:', err));
  }

  return newPromptRowId;
};

export const duplicatePrompt = async (supabase, itemId) => {
  // Helper function to duplicate a single prompt and get its new ID
  const duplicateSinglePrompt = async (sourceData, newParentId = null) => {
    const newPromptData = {
      parent_row_id: newParentId ?? sourceData.parent_row_id,
      input_admin_prompt: sourceData.input_admin_prompt || '',
      input_user_prompt: sourceData.input_user_prompt || '',
      output_response: sourceData.output_response || '',
      prompt_name: `${sourceData.prompt_name || 'New Prompt'} (copy)`,
      is_deleted: false,
      position: (sourceData.position || 0) + 1
    };

    const { data: newData, error: insertError } = await supabase
      .from(import.meta.env.VITE_PROMPTS_TBL)
      .insert([newPromptData])
      .select()
      .single();

    if (insertError) throw insertError;
    return newData.row_id;
  };

  // Recursive function to duplicate a prompt and all its descendants
  const duplicatePromptTree = async (promptId, newParentId = null) => {
    // Fetch the source prompt
    const { data: sourceData, error: fetchError } = await supabase
      .from(import.meta.env.VITE_PROMPTS_TBL)
      .select('*')
      .eq('row_id', promptId)
      .single();

    if (fetchError) throw fetchError;

    // Duplicate the current prompt
    const newPromptId = await duplicateSinglePrompt(sourceData, newParentId);

    // Fetch all children of the source prompt
    const { data: children, error: childrenError } = await supabase
      .from(import.meta.env.VITE_PROMPTS_TBL)
      .select('*')
      .eq('parent_row_id', promptId)
      .eq('is_deleted', false);

    if (childrenError) throw childrenError;

    // Recursively duplicate all children
    if (children && children.length > 0) {
      for (const child of children) {
        await duplicatePromptTree(child.row_id, newPromptId);
      }
    }

    return newPromptId;
  };

  // Start the duplication process from the root prompt
  return await duplicatePromptTree(itemId);
};

export const movePromptPosition = async (supabase, itemId, siblings, currentIndex, direction) => {
  if (!supabase || !itemId || !siblings || currentIndex === undefined || !direction) {
    return false;
  }

  try {
    let newPosition;
    
    if (direction === 'up' && currentIndex > 0) {
      newPosition = (siblings[currentIndex - 1].position + (siblings[currentIndex - 2]?.position || 0)) / 2;
    } else if (direction === 'down' && currentIndex < siblings.length - 1) {
      newPosition = (siblings[currentIndex + 1].position + (siblings[currentIndex + 2]?.position || siblings[currentIndex + 1].position + 1000000)) / 2;
    } else {
      return false;
    }

    const { error } = await supabase
      .from(import.meta.env.VITE_PROMPTS_TBL)
      .update({ position: newPosition })
      .eq('row_id', itemId);

    if (error) throw error;
    return true;
  } catch (error) {
    console.error('Error moving prompt position:', error);
    throw error;
  }
};