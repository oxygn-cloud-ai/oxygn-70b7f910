import { useState, useEffect, useRef } from 'react';
import { toast } from '@/components/ui/sonner';
import { supabase } from '@/integrations/supabase/client';

export const useOpenAIModels = () => {
  const [models, setModels] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    
    const fetchModels = async () => {
      try {
        if (!import.meta.env.VITE_MODELS_TBL) {
          throw new Error('VITE_MODELS_TBL environment variable is not set');
        }

        const { data, error } = await supabase
          .from(import.meta.env.VITE_MODELS_TBL)
          .select('*')
          .eq('is_active', true)
          .order('model_name', { ascending: true });

        if (error) throw error;
        if (isMountedRef.current) setModels(data || []);
      } catch (error) {
        console.error('Error fetching models:', error);
        if (isMountedRef.current) {
          toast.error('Failed to fetch models');
          setModels([]);
        }
      } finally {
        if (isMountedRef.current) setIsLoading(false);
      }
    };

    fetchModels();
    
    return () => { isMountedRef.current = false; };
  }, []);

  return { models, isLoading };
};