import { useState, useEffect, useCallback } from 'react';
import { toast } from '@/components/ui/sonner';
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

  const toggleModelActive = async (modelId) => {
    const model = models.find(m => m.model_id === modelId);
    if (!model) return;
    
    const newActive = !model.is_active;
    
    try {
      const { error } = await supabase
        .from(import.meta.env.VITE_MODELS_TBL)
        .update({ is_active: newActive, updated_at: new Date().toISOString() })
        .eq('model_id', modelId);

      if (error) throw error;

      setModels(prev =>
        prev.map(m =>
          m.model_id === modelId ? { ...m, is_active: newActive } : m
        )
      );
      
      toast.success(`Model ${newActive ? 'activated' : 'deactivated'}`);
    } catch (error) {
      console.error('Error updating model:', error);
      toast.error('Failed to update model');
    }
  };

  const addModel = async (modelData) => {
    try {
      const { data, error } = await supabase
        .from(import.meta.env.VITE_MODELS_TBL)
        .insert([{ 
          model_id: modelData.model_id, 
          model_name: modelData.model_name, 
          provider: modelData.provider || 'openai', 
          is_active: true,
          context_window: modelData.context_window || null,
          max_output_tokens: modelData.max_output_tokens || null,
          input_cost_per_million: modelData.input_cost_per_million || null,
          output_cost_per_million: modelData.output_cost_per_million || null,
          supports_temperature: modelData.supports_temperature ?? true,
          api_model_id: modelData.api_model_id || modelData.model_id,
        }])
        .select()
        .maybeSingle();

      if (error) throw error;

      setModels(prev => [...prev, data].sort((a, b) => (a.model_name || '').localeCompare(b.model_name || '')));
      toast.success('Model added successfully');
      return data;
    } catch (error) {
      console.error('Error adding model:', error);
      toast.error('Failed to add model');
      return null;
    }
  };

  const updateModel = async (rowId, updates) => {
    try {
      const { data, error } = await supabase
        .from(import.meta.env.VITE_MODELS_TBL)
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('row_id', rowId)
        .select()
        .maybeSingle();

      if (error) throw error;

      setModels(prev =>
        prev.map(m => m.row_id === rowId ? { ...m, ...data } : m)
      );
      toast.success('Model updated');
      return data;
    } catch (error) {
      console.error('Error updating model:', error);
      toast.error('Failed to update model');
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

  // Get model config from database record
  const getModelConfig = useCallback((modelId) => {
    const model = models.find(m => m.model_id === modelId);
    if (model) {
      return {
        maxTokens: model.max_output_tokens || 4096,
        tokenParam: model.token_param || 'max_tokens',
        supportsTemperature: model.supports_temperature ?? true,
        supportsReasoningEffort: model.supports_reasoning_effort ?? false,
        reasoningEffortLevels: model.reasoning_effort_levels || ['low', 'medium', 'high'],
        supportedSettings: model.supported_settings || ['temperature', 'max_tokens'],
        supportedTools: model.supported_tools || [],
        apiModelId: model.api_model_id || modelId,
        contextWindow: model.context_window || 128000
      };
    }
    // Fallback for unknown models - return null/empty values to indicate model needs DB config
    console.warn(`Model config not found in database for: ${modelId}`);
    return {
      maxTokens: null,
      tokenParam: null,
      supportsTemperature: null,
      supportsReasoningEffort: null,
      reasoningEffortLevels: [],
      supportedSettings: [],
      supportedTools: [],
      apiModelId: modelId,
      contextWindow: null
    };
  }, [models]);

  const getActiveModels = useCallback(() => {
    return models.filter(m => m.is_active);
  }, [models]);

  const resolveApiModelId = useCallback((modelId) => {
    const model = models.find(m => m.model_id === modelId);
    return model?.api_model_id || modelId;
  }, [models]);

  const supportsTemperature = useCallback((modelId) => {
    const model = models.find(m => m.model_id === modelId);
    return model?.supports_temperature ?? true;
  }, [models]);

  const isSettingSupported = useCallback((setting, modelId) => {
    const model = models.find(m => m.model_id === modelId);
    if (!model?.supported_settings) return true;
    return model.supported_settings.includes(setting);
  }, [models]);

  const isToolSupported = useCallback((tool, modelId) => {
    const model = models.find(m => m.model_id === modelId);
    if (!model?.supported_tools) return false;
    return model.supported_tools.includes(tool);
  }, [models]);

  // Get models filtered by provider
  const getModelsByProvider = useCallback((providerFilter) => {
    return models.filter(m => (m.provider || 'openai') === providerFilter);
  }, [models]);

  // Get provider for a specific model
  const getProviderForModel = useCallback((modelId) => {
    const model = models.find(m => m.model_id === modelId);
    return model?.provider || 'openai';
  }, [models]);

  // Check if a model is a Manus model
  const isManusModel = useCallback((modelId) => {
    return getProviderForModel(modelId) === 'manus';
  }, [getProviderForModel]);

  return {
    models,
    isLoading,
    toggleModelActive,
    addModel,
    updateModel,
    deleteModel,
    getModelConfig,
    getActiveModels,
    resolveApiModelId,
    supportsTemperature,
    isSettingSupported,
    isToolSupported,
    getModelsByProvider,
    getProviderForModel,
    isManusModel,
    refetch: fetchModels
  };
};
