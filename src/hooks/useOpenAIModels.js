import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { toast } from 'sonner';

export const useOpenAIModels = () => {
  const [models, setModels] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchModels();
  }, []);

  const fetchModels = async () => {
    try {
      setIsLoading(true);
      console.log('Supabase API Call:', {
        table: 'openai_models',
        action: 'select',
        query: 'Select model, max_tokens',
      });

      const { data, error } = await supabase
        .from('openai_models')
        .select('model, max_tokens');

      console.log('Supabase API Response:', {
        data,
        error,
      });

      if (error) throw error;

      if (data.length === 0) {
        toast.warning('No OpenAI models found in the database');
      }

      setModels(data);
      console.log('Fetched OpenAI models:', data);
    } catch (error) {
      console.error('Error fetching OpenAI models:', error);
      toast.error(`Failed to fetch OpenAI models: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  return { models, isLoading };
};
