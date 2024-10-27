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
      const modelsTable = import.meta.env.VITE_MODELS_TBL;
      
      if (!modelsTable) {
        throw new Error('Models table environment variable is not defined');
      }

      const query = supabase
        .from(modelsTable)
        .select('model, max_tokens')
        .eq('is_deleted', false);
      
      console.log('Supabase API Call:', {
        url: query.url.toString(),
        method: 'GET',
        headers: query.headers,
        body: null,
      });

      const { data, error } = await query;

      console.log('Supabase API Response:', {
        status: data ? 200 : 500,
        data: data,
        error: error,
      });

      if (error) throw error;

      if (data.length === 0) {
        toast.warning('No active OpenAI models found in the database');
      }

      setModels(data);
    } catch (error) {
      console.error('Error fetching OpenAI models:', error);
      toast.error(`Failed to fetch OpenAI models: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  return { models, isLoading };
};