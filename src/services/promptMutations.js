import { toast } from 'sonner';
import { calculateNewPositions } from '../utils/positionUtils';

export const movePromptPosition = async (supabase, itemId, siblings, currentIndex, direction) => {
  const positions = calculateNewPositions(siblings, currentIndex, direction);
  if (!positions) {
    toast.error(`Cannot move ${direction} any further`);
    return false;
  }

  try {
    const { error } = await supabase
      .from(import.meta.env.VITE_PROMPTS_TBL)
      .update({ position: positions.newPosition })
      .eq('row_id', itemId);

    if (error) throw error;
    return true;
  } catch (error) {
    console.error('Error moving prompt:', error);
    toast.error(`Failed to move prompt ${direction}`);
    return false;
  }
};

export const addPrompt = async (supabase, parentId, defaultAdminPrompt) => {
  try {
    const { data: siblings } = await supabase
      .from(import.meta.env.VITE_PROMPTS_TBL)
      .select('position')
      .eq('parent_row_id', parentId)
      .order('position', { ascending: false })
      .limit(1);

    const lastPosition = siblings?.[0]?.position;
    const newPosition = lastPosition ? lastPosition + 1000000 : Date.now() * 1000;

    const { data, error } = await supabase
      .from(import.meta.env.VITE_PROMPTS_TBL)
      .insert({
        parent_row_id: parentId,
        prompt_name: 'New Prompt',
        position: newPosition,
        input_admin_prompt: defaultAdminPrompt,
        frequency_penalty_on: false,
        model_on: true,
        temperature_on: true,
        max_tokens_on: true,
        top_p_on: false,
        presence_penalty_on: false,
        stop_on: false,
        n_on: false,
        logit_bias_on: false,
        o_user_on: false,
        stream: false,
        stream_on: false,
        best_of_on: false,
        logprobs_on: false,
        echo: false,
        echo_on: false,
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
        response_format_on: false
      })
      .select()
      .single();

    if (error) throw error;
    toast.success('New prompt added successfully');
    return data.row_id;
  } catch (error) {
    console.error('Error adding prompt:', error);
    toast.error('Failed to add new prompt');
    throw error;
  }
};

export const deletePrompt = async (supabase, id) => {
  try {
    const { error } = await supabase
      .from(import.meta.env.VITE_PROMPTS_TBL)
      .update({ is_deleted: true })
      .eq('row_id', id);
    
    if (error) throw error;
    toast.success('Prompt deleted successfully');
  } catch (error) {
    console.error('Error deleting prompt:', error);
    toast.error('Failed to delete prompt');
    throw error;
  }
};