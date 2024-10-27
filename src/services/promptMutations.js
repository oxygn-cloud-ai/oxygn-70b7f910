export const addPrompt = async (supabase, parentId = null, defaultAdminPrompt = '') => {
  const timestamp = new Date().toISOString().slice(0, 19).replace('T', ' ');
  const { data, error } = await supabase
    .from(import.meta.env.VITE_PROMPTS_TBL)
    .insert([{
      parent_row_id: parentId,
      input_admin_prompt: defaultAdminPrompt,
      is_deleted: false,
      prompt_name: `New Prompt ${timestamp}`
    }])
    .select();

  if (error) throw error;
  return data[0].row_id;
};

export const deletePrompt = async (supabase, itemId) => {
  const { error } = await supabase
    .from(import.meta.env.VITE_PROMPTS_TBL)
    .update({ is_deleted: true })
    .eq('row_id', itemId);

  if (error) throw error;
  return true;
};

export const duplicatePrompt = async (supabase, itemId) => {
  const { data: sourceData, error: fetchError } = await supabase
    .from(import.meta.env.VITE_PROMPTS_TBL)
    .select('*')
    .eq('row_id', itemId)
    .single();

  if (fetchError) throw fetchError;

  const { parent_row_id, input_admin_prompt, input_user_prompt } = sourceData;
  
  const { data: newData, error: insertError } = await supabase
    .from(import.meta.env.VITE_PROMPTS_TBL)
    .insert([{
      parent_row_id,
      input_admin_prompt,
      input_user_prompt,
      prompt_name: `${sourceData.prompt_name || 'New Prompt'} (copy)`,
      is_deleted: false
    }])
    .select();

  if (insertError) throw insertError;
  return newData[0].row_id;
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