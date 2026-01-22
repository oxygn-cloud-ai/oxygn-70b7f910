import { useState, useEffect, useCallback } from 'react';
import { toast } from '@/components/ui/sonner';
import { supabase } from '@/integrations/supabase/client';

export interface ModelRow {
  row_id: string;
  model_id: string;
  model_name: string | null;
  provider?: string | null;
  is_active?: boolean | null;
  context_window?: number | null;
  max_output_tokens?: number | null;
  token_param?: string | null;
  supports_temperature?: boolean | null;
  supports_reasoning_effort?: boolean | null;
  reasoning_effort_levels?: string[] | null;
  supported_settings?: string[] | null;
  supported_tools?: string[] | null;
  api_model_id?: string | null;
  input_cost_per_million?: number | null;
  output_cost_per_million?: number | null;
  api_base_url?: string | null;
  auth_header_name?: string | null;
  auth_header_format?: string | null;
  updated_at?: string;
}

export interface ModelConfig {
  maxTokens: number | null;
  tokenParam: string | null;
  supportsTemperature: boolean | null;
  supportsReasoningEffort: boolean | null;
  reasoningEffortLevels: string[];
  supportedSettings: string[];
  supportedTools: string[];
  apiModelId: string;
  contextWindow: number | null;
}

interface ModelInsertData {
  model_id: string;
  model_name?: string;
  provider?: string;
  context_window?: number | null;
  max_output_tokens?: number | null;
  input_cost_per_million?: number | null;
  output_cost_per_million?: number | null;
  supports_temperature?: boolean;
  api_model_id?: string;
  token_param?: string;
  supports_reasoning_effort?: boolean;
  reasoning_effort_levels?: string[] | null;
  supported_settings?: string[];
  supported_tools?: string[];
  api_base_url?: string | null;
  auth_header_name?: string;
  auth_header_format?: string;
}

interface UseModelsReturn {
  models: ModelRow[];
  isLoading: boolean;
  toggleModelActive: (modelId: string) => Promise<void>;
  addModel: (modelData: ModelInsertData) => Promise<ModelRow | null>;
  updateModel: (rowId: string, updates: Partial<ModelRow>) => Promise<ModelRow | null>;
  deleteModel: (rowId: string) => Promise<void>;
  getModelConfig: (modelId: string) => ModelConfig;
  getActiveModels: () => ModelRow[];
  resolveApiModelId: (modelId: string) => string;
  supportsTemperature: (modelId: string) => boolean;
  isSettingSupported: (setting: string, modelId: string) => boolean;
  isToolSupported: (tool: string, modelId: string) => boolean;
  getModelsByProvider: (providerFilter: string) => ModelRow[];
  getProviderForModel: (modelId: string) => string;
  isManusModel: (modelId: string) => boolean;
  addModels: (modelsArray: ModelInsertData[]) => Promise<ModelRow[] | null>;
  refetch: () => Promise<void>;
}

export const useModels = (): UseModelsReturn => {
  const [models, setModels] = useState<ModelRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchModels = useCallback(async (): Promise<void> => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from(import.meta.env.VITE_MODELS_TBL)
        .select('*')
        .order('model_name', { ascending: true });

      if (error) throw error;
      setModels((data as ModelRow[]) || []);
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

  const toggleModelActive = async (modelId: string): Promise<void> => {
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

  const addModel = async (modelData: ModelInsertData): Promise<ModelRow | null> => {
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

      const newModel = data as ModelRow;
      setModels(prev => [...prev, newModel].sort((a, b) => 
        (a.model_name || '').localeCompare(b.model_name || '')
      ));
      toast.success('Model added successfully');
      return newModel;
    } catch (error) {
      console.error('Error adding model:', error);
      toast.error('Failed to add model');
      return null;
    }
  };

  const updateModel = async (
    rowId: string, 
    updates: Partial<ModelRow>
  ): Promise<ModelRow | null> => {
    try {
      const { data, error } = await supabase
        .from(import.meta.env.VITE_MODELS_TBL)
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('row_id', rowId)
        .select()
        .maybeSingle();

      if (error) throw error;

      const updatedModel = data as ModelRow;
      setModels(prev =>
        prev.map(m => m.row_id === rowId ? { ...m, ...updatedModel } : m)
      );
      toast.success('Model updated');
      return updatedModel;
    } catch (error) {
      console.error('Error updating model:', error);
      toast.error('Failed to update model');
      return null;
    }
  };

  const deleteModel = async (rowId: string): Promise<void> => {
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
  const getModelConfig = useCallback((modelId: string): ModelConfig => {
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

  const getActiveModels = useCallback((): ModelRow[] => {
    return models.filter(m => m.is_active);
  }, [models]);

  const resolveApiModelId = useCallback((modelId: string): string => {
    const model = models.find(m => m.model_id === modelId);
    return model?.api_model_id || modelId;
  }, [models]);

  const supportsTemperature = useCallback((modelId: string): boolean => {
    const model = models.find(m => m.model_id === modelId);
    return model?.supports_temperature ?? true;
  }, [models]);

  const isSettingSupported = useCallback((setting: string, modelId: string): boolean => {
    const model = models.find(m => m.model_id === modelId);
    if (!model?.supported_settings) return true;
    return model.supported_settings.includes(setting);
  }, [models]);

  const isToolSupported = useCallback((tool: string, modelId: string): boolean => {
    const model = models.find(m => m.model_id === modelId);
    if (!model?.supported_tools) return false;
    return model.supported_tools.includes(tool);
  }, [models]);

  // Get models filtered by provider
  const getModelsByProvider = useCallback((providerFilter: string): ModelRow[] => {
    return models.filter(m => (m.provider || 'openai') === providerFilter);
  }, [models]);

  // Get provider for a specific model
  const getProviderForModel = useCallback((modelId: string): string => {
    const model = models.find(m => m.model_id === modelId);
    return model?.provider || 'openai';
  }, [models]);

  // Check if a model is a Manus model
  const isManusModel = useCallback((modelId: string): boolean => {
    return getProviderForModel(modelId) === 'manus';
  }, [getProviderForModel]);

  // Bulk add multiple models at once
  const addModels = async (modelsArray: ModelInsertData[]): Promise<ModelRow[] | null> => {
    if (!modelsArray || modelsArray.length === 0) {
      toast.error('No models to add');
      return null;
    }

    try {
      const inserts = modelsArray.map(m => ({
        model_id: m.model_id,
        model_name: m.model_name || m.model_id,
        provider: m.provider || 'openai',
        is_active: false, // Start inactive
        api_model_id: m.api_model_id || m.model_id,
        context_window: m.context_window || null,
        max_output_tokens: m.max_output_tokens || null,
        token_param: m.token_param || 'max_tokens',
        supports_temperature: m.supports_temperature ?? true,
        supports_reasoning_effort: m.supports_reasoning_effort ?? false,
        reasoning_effort_levels: m.reasoning_effort_levels || null,
        supported_settings: m.supported_settings || [],
        supported_tools: m.supported_tools || [],
        input_cost_per_million: m.input_cost_per_million ?? null,
        output_cost_per_million: m.output_cost_per_million ?? null,
        api_base_url: m.api_base_url || null,
        auth_header_name: m.auth_header_name || 'Authorization',
        auth_header_format: m.auth_header_format || 'Bearer {key}',
      }));

      const { data, error } = await supabase
        .from(import.meta.env.VITE_MODELS_TBL)
        .insert(inserts)
        .select();

      if (error) throw error;

      const newModels = data as ModelRow[];
      setModels(prev => [...prev, ...newModels].sort((a, b) =>
        (a.model_name || '').localeCompare(b.model_name || '')
      ));

      toast.success(`Added ${newModels.length} model${newModels.length !== 1 ? 's' : ''}`);
      return newModels;
    } catch (error) {
      console.error('Error adding models:', error);
      // Handle duplicate key error specifically
      if ((error as { code?: string }).code === '23505') {
        toast.error('One or more models already exist');
      } else {
        toast.error('Failed to add models');
      }
      return null;
    }
  };

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
    addModels,
    refetch: fetchModels
  };
};
