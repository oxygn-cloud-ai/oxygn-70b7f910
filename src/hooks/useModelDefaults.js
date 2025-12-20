import { useState, useEffect, useCallback } from 'react';
import { toast } from '@/components/ui/sonner';
import { supabase } from '@/integrations/supabase/client';

export const useModelDefaults = () => {
  const [modelDefaults, setModelDefaults] = useState({});
  const [isLoading, setIsLoading] = useState(true);

  const fetchModelDefaults = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from(import.meta.env.VITE_MODEL_DEFAULTS_TBL)
        .select('*');

      if (error) throw error;

      // Convert array to object keyed by model_id
      const defaultsObj = {};
      if (data) {
        data.forEach(row => {
          defaultsObj[row.model_id] = row;
        });
      }
      
      setModelDefaults(defaultsObj);
    } catch (error) {
      console.error('Error fetching model defaults:', error);
      toast.error('Failed to fetch model defaults');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchModelDefaults();
  }, [fetchModelDefaults]);

  const updateModelDefault = async (modelId, field, value) => {
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

      return true;
    } catch (error) {
      console.error('Error updating model default:', error);
      toast.error(`Failed to update: ${error.message}`);
      return false;
    }
  };

  const getModelDefault = useCallback((modelId) => {
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
