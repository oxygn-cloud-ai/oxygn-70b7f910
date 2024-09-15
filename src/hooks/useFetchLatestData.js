import { useState } from 'react';
import { supabase } from '../lib/supabase';
import { toast } from 'sonner';

const MAX_RETRIES = 3;
const RETRY_DELAY = 1000; // 1 second

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

export const useFetchLatestData = (projectRowId) => {
  const [isLoading, setIsLoading] = useState(false);

  const fetchWithRetry = async (retries = 0) => {
    try {
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
        .eq('project_row_id', projectRowId)
        .maybeSingle();

      if (error) throw error;

      if (!data) {
        console.warn(`No data found for project row ID: ${projectRowId}`);
        toast.warning('No data found for this project');
        return null;
      }

      return data;
    } catch (error) {
      if (retries < MAX_RETRIES) {
        console.warn(`Fetch attempt ${retries + 1} failed. Retrying...`);
        await delay(RETRY_DELAY);
        return fetchWithRetry(retries + 1);
      }
      throw error;
    }
  };

  const fetchLatestData = async () => {
    setIsLoading(true);
    try {
      const data = await fetchWithRetry();
      return data;
    } catch (error) {
      console.error('Error fetching latest data:', error);
      toast.error(`Failed to fetch project data: ${error.message}`);
      return null;
    } finally {
      setIsLoading(false);
    }
  };

  return { fetchLatestData, isLoading };
};
