import { useState } from 'react';
import { supabase } from '../lib/supabase';

export const useFetchLatestData = (projectRowId) => {
  const [isLoading, setIsLoading] = useState(false);

  const fetchLatestData = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('projects')
        .select(`
          admin_prompt_result,
          user_prompt_result,
          input_admin_prompt,
          input_user_prompt,
          prompt_settings,
          half_width_box_4,
          model,
          temperature,
          max_tokens,
          top_p,
          frequency_penalty,
          presence_penalty,
          stop,
          n,
          logit_bias,
          user,
          stream,
          best_of,
          logprobs,
          echo,
          suffix,
          temperature_scaling,
          prompt_tokens,
          response_tokens,
          batch_size,
          learning_rate_multiplier,
          n_epochs,
          validation_file,
          training_file,
          engine,
          input,
          context_length,
          custom_finetune
        `)
        .eq('project_row_id', projectRowId)
        .single();

      if (error) throw error;

      return data;
    } catch (error) {
      console.error('Error fetching latest data:', error);
      return null;
    } finally {
      setIsLoading(false);
    }
  };

  return { fetchLatestData, isLoading };
};
