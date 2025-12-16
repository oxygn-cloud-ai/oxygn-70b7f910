import { deletePrompt } from './promptDeletion';

export const addPrompt = async (supabase, parentId = null, defaultAdminPrompt = '') => {
  // First, get the maximum position value for the current level
  const { data: maxPositionData, error: positionError } = await supabase
    .from(import.meta.env.VITE_PROMPTS_TBL)
    .select('position')
    .eq('parent_row_id', parentId)
    .eq('is_deleted', false)
    .order('position', { ascending: false })
    .limit(1);

  if (positionError) throw positionError;

  // Calculate the new position (either max + 1000000 or start at 1000000)
  const newPosition = maxPositionData && maxPositionData.length > 0
    ? (maxPositionData[0].position || 0) + 1000000
    : 1000000;

  const { data, error } = await supabase
    .from(import.meta.env.VITE_PROMPTS_TBL)
    .insert([{
      parent_row_id: parentId,
      input_admin_prompt: defaultAdminPrompt || '',
      is_deleted: false,
      prompt_name: 'New Prompt',
      position: newPosition
    }])
    .select();

  if (error) throw error;
  return data[0].row_id;
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
