import { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

export const useModels = () => {
  const [models, setModels] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchModels = useCallback(async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from(import.meta.env.VITE_MODELS_TBL)
        .select('*')
        .order('model_name', { ascending: true });

      if (error) throw error;
      setModels(data || []);
    } catch (error) {
      console.error('Error fetching models:', error);
      toast.error('Failed to fetch models');
      setModels([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchModels();
  }, [fetchModels]);

  const toggleModelActive = async (rowId, isActive) => {
    try {
      const { error } = await supabase
        .from(import.meta.env.VITE_MODELS_TBL)
        .update({ is_active: isActive })
        .eq('row_id', rowId);

      if (error) throw error;

      setModels(prev =>
        prev.map(model =>
          model.row_id === rowId ? { ...model, is_active: isActive } : model
        )
      );
      
      toast.success(`Model ${isActive ? 'activated' : 'deactivated'}`);
    } catch (error) {
      console.error('Error updating model:', error);
      toast.error('Failed to update model');
    }
  };

  const addModel = async (modelId, modelName, provider = 'openai') => {
    try {
      const { data, error } = await supabase
        .from(import.meta.env.VITE_MODELS_TBL)
        .insert([{ model_id: modelId, model_name: modelName, provider, is_active: true }])
        .select()
        .single();

      if (error) throw error;

      setModels(prev => [...prev, data].sort((a, b) => a.model_name.localeCompare(b.model_name)));
      toast.success('Model added successfully');
      return data;
    } catch (error) {
      console.error('Error adding model:', error);
      toast.error('Failed to add model');
      return null;
    }
  };

  const deleteModel = async (rowId) => {
    try {
      const { error } = await supabase
        .from(import.meta.env.VITE_MODELS_TBL)
        .delete()
        .eq('row_id', rowId);

      if (error) throw error;

      setModels(prev => prev.filter(model => model.row_id !== rowId));
      toast.success('Model deleted');
    } catch (error) {
      console.error('Error deleting model:', error);
      toast.error('Failed to delete model');
    }
  };

  return {
    models,
    isLoading,
    toggleModelActive,
    addModel,
    deleteModel,
    refetch: fetchModels
  };
};
