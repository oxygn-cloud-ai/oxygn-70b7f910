import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { useSupabase } from './useSupabase';

export const useOpenAIModels = () => {
  const [models, setModels] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const supabase = useSupabase();

  useEffect(() => {
    const fetchModels = async () => {
      if (!supabase) return;
      
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
  }, [supabase]);

  return { models, isLoading };
};