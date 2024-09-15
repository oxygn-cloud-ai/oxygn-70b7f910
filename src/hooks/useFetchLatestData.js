import { useState } from 'react';
import { supabase } from '../lib/supabase';
import { toast } from 'sonner';

export const useFetchLatestData = () => {
  const [isLoading, setIsLoading] = useState(false);

  const fetchData = async (projectRowId) => {
    setIsLoading(true);
    try {
      console.log('Fetching data for project:', projectRowId);
      const { data, error } = await supabase
        .from('projects')
        .select(`
          admin_prompt_result,
          user_prompt_result,
          input_admin_prompt,
          input_user_prompt,
          model,
          model_on,
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
        .eq('project_id', projectRowId)
        .eq('level', 1)
        .single();

      if (error) throw error;
      if (!data) throw new Error('No data found');
      return data;
    } catch (error) {
      console.error('Error fetching data:', error);
      toast.error(`Failed to fetch project data: ${error.message}`);
      return null;
    } finally {
      setIsLoading(false);
    }
  };

  return { fetchLatestData: fetchData, isLoading };
};
