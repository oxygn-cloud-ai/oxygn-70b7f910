import { calculatePosition, getInitialPosition } from '../utils/positionUtils';
import { handleSupabaseError } from './errorHandling';

export const addPrompt = async (supabase, parentId, defaultAdminPrompt) => {
  try {
    const { data: siblings } = await supabase
      .from(import.meta.env.VITE_PROMPTS_TBL)
      .select('position')
      .eq('parent_row_id', parentId)
      .order('position', { ascending: false })
      .limit(1);

    const lastPosition = siblings?.[0]?.position;
    const newPosition = lastPosition ? calculatePosition(lastPosition, null) : getInitialPosition();

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
    return data.row_id;
  } catch (error) {
    handleSupabaseError(error, 'adding new prompt');
  }
};