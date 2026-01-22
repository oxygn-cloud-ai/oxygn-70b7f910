import { useState, useEffect, useCallback, useRef } from 'react';
import { toast } from '@/components/ui/sonner';
import { supabase } from '@/integrations/supabase/client';
import { trackEvent } from '@/lib/posthog';

export interface ModelDefaultRow {
  row_id?: string;
  model_id: string;
  temperature?: number | null;
  max_tokens?: number | null;
  top_p?: number | null;
  frequency_penalty?: number | null;
  presence_penalty?: number | null;
  reasoning_effort?: string | null;
  updated_at?: string;
  [key: string]: unknown;
}

type ModelDefaultsMap = Record<string, ModelDefaultRow>;

interface UseModelDefaultsReturn {
  modelDefaults: ModelDefaultsMap;
  isLoading: boolean;
  updateModelDefault: (modelId: string, field: string, value: unknown) => Promise<boolean>;
  getModelDefault: (modelId: string) => ModelDefaultRow | null;
  refetch: () => Promise<void>;
}

export const useModelDefaults = (): UseModelDefaultsReturn => {
  const [modelDefaults, setModelDefaults] = useState<ModelDefaultsMap>({});
  const [isLoading, setIsLoading] = useState(true);
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => { isMountedRef.current = false; };
  }, []);

  const fetchModelDefaults = useCallback(async (): Promise<void> => {
    try {
      const { data, error } = await supabase
        .from(import.meta.env.VITE_MODEL_DEFAULTS_TBL)
        .select('*');

      if (error) throw error;

      // Convert array to object keyed by model_id
      const defaultsObj: ModelDefaultsMap = {};
      if (data) {
        data.forEach((row: ModelDefaultRow) => {
          defaultsObj[row.model_id] = row;
        });
      }
      
      if (isMountedRef.current) setModelDefaults(defaultsObj);
    } catch (error) {
      console.error('Error fetching model defaults:', error);
      if (isMountedRef.current) {
        toast.error('Failed to fetch model defaults', {
          source: 'useModelDefaults.fetchModelDefaults',
          errorCode: (error as { code?: string })?.code || 'MODEL_DEFAULTS_FETCH_ERROR',
          details: JSON.stringify({ 
            error: (error as Error)?.message, 
            stack: (error as Error)?.stack 
          }, null, 2),
        });
      }
    } finally {
      if (isMountedRef.current) setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchModelDefaults();
  }, [fetchModelDefaults]);

  const updateModelDefault = async (
    modelId: string, 
    field: string, 
    value: unknown
  ): Promise<boolean> => {
    try {
      const existing = modelDefaults[modelId];
      
      if (existing) {
        // Update existing record
        const { error } = await supabase
          .from(import.meta.env.VITE_MODEL_DEFAULTS_TBL)
          .update({ [field]: value, updated_at: new Date().toISOString() })
          .eq('model_id', modelId);

        if (error) throw error;
      } else {
        // Insert new record
        const { error } = await supabase
          .from(import.meta.env.VITE_MODEL_DEFAULTS_TBL)
          .insert({ model_id: modelId, [field]: value });

        if (error) throw error;
      }

      // Update local state
      setModelDefaults(prev => ({
        ...prev,
        [modelId]: {
          ...prev[modelId],
          model_id: modelId,
          [field]: value
        }
      }));

      trackEvent('model_default_updated', { model_id: modelId, field });
      return true;
    } catch (error) {
      console.error('Error updating model default:', error);
      toast.error(`Failed to update: ${(error as Error).message}`, {
        source: 'useModelDefaults.updateModelDefault',
        errorCode: (error as { code?: string })?.code || 'MODEL_DEFAULT_UPDATE_ERROR',
        details: JSON.stringify({ 
          modelId, 
          field, 
          error: (error as Error)?.message, 
          stack: (error as Error)?.stack 
        }, null, 2),
      });
      return false;
    }
  };

  const getModelDefault = useCallback((modelId: string): ModelDefaultRow | null => {
    return modelDefaults[modelId] || null;
  }, [modelDefaults]);

  return {
    modelDefaults,
    isLoading,
    updateModelDefault,
    getModelDefault,
    refetch: fetchModelDefaults
  };
};
