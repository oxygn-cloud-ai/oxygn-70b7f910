import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

export const useOpenAIModels = () => {
  const [models, setModels] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchModels();
  }, []);

  const fetchModels = async () => {
    try {
      const { data, error } = await supabase
        .from('openai_models')
        .select('model, max_tokens');

      if (error) throw error;

      setModels(data);
    } catch (error) {
      console.error('Error fetching OpenAI models:', error);
    } finally {
      setIsLoading(false);
    }
  };

  return { models, isLoading };
};