export const addPrompt = async (supabase, parentId = null, defaultAdminPrompt = '') => {
  const timestamp = new Date().toISOString().slice(0, 19).replace('T', ' ');

  // First, get the maximum position value for the current level
  const { data: maxPositionData, error: positionError } = await supabase
    .from(import.meta.env.VITE_PROMPTS_TBL)
    .select('position')
    .eq('parent_row_id', parentId)
    .eq('is_deleted', false)
    .order('position', { ascending: false })
    .limit(1);

  if (positionError) throw positionError;

  // Get default settings from the settings table
  const { data: settingsData, error: settingsError } = await supabase
    .from(import.meta.env.VITE_SETTINGS_TBL)
    .select('*')
    .limit(1)
    .single();

  if (settingsError) throw settingsError;

  // Calculate the new position (either max + 1000000 or start at 1000000)
  const newPosition = maxPositionData && maxPositionData.length > 0
    ? maxPositionData[0].position + 1000000
    : 1000000;

  const { data, error } = await supabase
    .from(import.meta.env.VITE_PROMPTS_TBL)
    .insert([{
      parent_row_id: parentId,
      input_admin_prompt: defaultAdminPrompt || settingsData?.def_admin_prompt || '',
      is_deleted: false,
      prompt_name: 'New Prompt',
      position: newPosition,
      // Default settings for new prompts
      temperature: '0.7',
      max_tokens: '2048',
      top_p: '1',
      frequency_penalty: '0',
      presence_penalty: '0',
      n: '1',
      stream: false,
      echo: false,
      response_format: '{"type": "text"}',
      model: 'gpt-3.5-turbo',
      // Default settings toggles - set to true by default for essential parameters
      temperature_on: true,
      max_tokens_on: true,
      top_p_on: true,
      frequency_penalty_on: false,
      presence_penalty_on: false,
      n_on: false,
      stream_on: false,
      echo_on: false,
      response_format_on: true,
      model_on: true,
      stop_on: false,
      logit_bias_on: false,
      o_user_on: false,
      best_of_on: false,
      logprobs_on: false,
      suffix_on: false,
      temperature_scaling_on: false,
      prompt_tokens_on: false,
      response_tokens_on: false,
      batch_size_on: false,
      learning_rate_multiplier_on: false,
      n_epochs_on: false,
      validation_file_on: false,
      training_file_on: false,
      engine_on: false,
      input_on: false,
      context_length_on: false,
      custom_finetune_on: false,
      prompt_settings_open: true
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

  // Set required fields with default values if they're null
  const newPromptData = {
    ...sourceData,
    parent_row_id: sourceData.parent_row_id,
    input_admin_prompt: sourceData.input_admin_prompt,
    input_user_prompt: sourceData.input_user_prompt,
    prompt_name: `${sourceData.prompt_name || 'New Prompt'} (copy)`,
    is_deleted: false,
    // Ensure all required boolean fields have default values
    frequency_penalty_on: sourceData.frequency_penalty_on ?? false,
    presence_penalty_on: sourceData.presence_penalty_on ?? false,
    temperature_on: sourceData.temperature_on ?? true,
    max_tokens_on: sourceData.max_tokens_on ?? true,
    top_p_on: sourceData.top_p_on ?? true,
    n_on: sourceData.n_on ?? false,
    stream_on: sourceData.stream_on ?? false,
    echo_on: sourceData.echo_on ?? false,
    response_format_on: sourceData.response_format_on ?? true,
    model_on: sourceData.model_on ?? true,
    stop_on: sourceData.stop_on ?? false,
    logit_bias_on: sourceData.logit_bias_on ?? false,
    o_user_on: sourceData.o_user_on ?? false,
    best_of_on: sourceData.best_of_on ?? false,
    logprobs_on: sourceData.logprobs_on ?? false,
    suffix_on: sourceData.suffix_on ?? false,
    temperature_scaling_on: sourceData.temperature_scaling_on ?? false,
    prompt_tokens_on: sourceData.prompt_tokens_on ?? false,
    response_tokens_on: sourceData.response_tokens_on ?? false,
    batch_size_on: sourceData.batch_size_on ?? false,
    learning_rate_multiplier_on: sourceData.learning_rate_multiplier_on ?? false,
    n_epochs_on: sourceData.n_epochs_on ?? false,
    validation_file_on: sourceData.validation_file_on ?? false,
    training_file_on: sourceData.training_file_on ?? false,
    engine_on: sourceData.engine_on ?? false,
    input_on: sourceData.input_on ?? false,
    context_length_on: sourceData.context_length_on ?? false,
    custom_finetune_on: sourceData.custom_finetune_on ?? false,
    prompt_settings_open: sourceData.prompt_settings_open ?? true
  };

  // Remove the row_id so a new one will be generated
  delete newPromptData.row_id;
  delete newPromptData.created;

  const { data: newData, error: insertError } = await supabase
    .from(import.meta.env.VITE_PROMPTS_TBL)
    .insert([newPromptData])
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