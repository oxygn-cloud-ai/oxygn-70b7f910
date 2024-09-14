import { useState } from 'react';
import { supabase } from '../lib/supabase';
import { toast } from 'sonner';

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
        .maybeSingle();

      if (error) throw error;

      if (!data) {
        toast.error('No data found for this project');
        return null;
      }

      return data;
    } catch (error) {
      console.error('Error fetching latest data:', error);
      toast.error('Failed to fetch project data');
      return null;
    } finally {
      setIsLoading(false);
    }
  };

  return { fetchLatestData, isLoading };
};
