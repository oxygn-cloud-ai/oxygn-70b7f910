import { useState, useEffect, useRef } from 'react';
import { toast } from '@/components/ui/sonner';
import { supabase } from '@/integrations/supabase/client';

export interface OpenAIModel {
  row_id: string;
  model_id: string;
  model_name: string;
  provider?: string | null;
  context_window?: number | null;
  max_output_tokens?: number | null;
  is_active?: boolean | null;
  supports_temperature?: boolean | null;
  supports_reasoning_effort?: boolean | null;
  supported_settings?: string[] | null;
  supported_tools?: string[] | null;
  cost_per_1k_input_tokens?: number | null;
  cost_per_1k_output_tokens?: number | null;
}

interface UseOpenAIModelsReturn {
  models: OpenAIModel[];
  isLoading: boolean;
}

export const useOpenAIModels = (): UseOpenAIModelsReturn => {
  const [models, setModels] = useState<OpenAIModel[]>([]);
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
        if (isMountedRef.current) setModels((data as OpenAIModel[]) || []);
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
