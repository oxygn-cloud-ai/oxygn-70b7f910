import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { supabase } from '../lib/supabase';

export const useOpenAIModels = () => {
  const [models, setModels] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchModels = async () => {
      try {
        const { data, error } = await supabase
          .from(import.meta.env.VITE_MODELS_TBL)
          .select('*')
          .eq('is_deleted', false)
          .order('model', { ascending: true });

        if (error) throw error;
        setModels(data || []);
      } catch (error) {
        console.error('Error fetching models:', error);
        toast.error('Failed to fetch models');
        setModels([]);
      } finally {
        setIsLoading(false);
      }
    };

    fetchModels();
  }, []);

  return { models, isLoading };
};