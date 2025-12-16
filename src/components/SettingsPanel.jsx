import React, { useEffect, useState, useMemo } from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import SettingField from './settings/SettingField';
import { useSupabase } from '../hooks/useSupabase';
import { useSettings } from '../hooks/useSettings';
import { toast } from 'sonner';
import { ALL_SETTINGS, getModelCapabilities, isSettingSupported } from '../config/modelCapabilities';

const SettingsPanel = ({ 
  localData, 
  selectedItemData, 
  models, 
  handleChange, 
  handleSave, 
  handleReset, 
  hasUnsavedChanges 
}) => {
  const supabase = useSupabase();
  const { settings, isLoading: settingsLoading } = useSettings(supabase);

  // Get default model from global settings
  const defaultModel = useMemo(() => {
    return settings?.default_model?.value || models[0]?.model_id || '';
  }, [settings, models]);

  // Get the currently selected model (prompt's model or default)
  const currentModel = localData.model || defaultModel;
  const currentModelData = models.find(m => m.model_id === currentModel || m.model_name === currentModel);
  const currentProvider = currentModelData?.provider || 'openai';

  const handleCheckChange = async (fieldName, checked) => {
    handleChange(`${fieldName}_on`, checked);
    
    try {
      const { error } = await supabase
        .from(import.meta.env.VITE_PROMPTS_TBL)
        .update({ [`${fieldName}_on`]: checked })
        .eq('row_id', selectedItemData.row_id);

      if (error) throw error;

      if (checked && !localData[fieldName]) {
        const defaultValues = {
          temperature: '0.7',
          max_tokens: '2048',
          top_p: '1',
          frequency_penalty: '0',
          presence_penalty: '0',
          n: '1',
          stream: false,
          echo: false,
          response_format: '{"type": "text"}',
          model: currentModel
        };

        if (defaultValues[fieldName] !== undefined) {
          handleChange(fieldName, defaultValues[fieldName]);
          const { error: saveError } = await supabase
            .from(import.meta.env.VITE_PROMPTS_TBL)
            .update({ [fieldName]: defaultValues[fieldName] })
            .eq('row_id', selectedItemData.row_id);

          if (saveError) throw saveError;
        }
      }
    } catch (error) {
      console.error('Error updating field:', error);
      toast.error(`Failed to update ${fieldName}: ${error.message}`);
    }
  };

  const handleModelChange = async (value) => {
    handleChange('model', value);
    
    try {
      const { error } = await supabase
        .from(import.meta.env.VITE_PROMPTS_TBL)
        .update({ model: value })
        .eq('row_id', selectedItemData.row_id);

      if (error) throw error;
      toast.success('Model updated');
    } catch (error) {
      console.error('Error updating model:', error);
      toast.error(`Failed to update model: ${error.message}`);
    }
  };

  // Get the default model display name
  const defaultModelData = models.find(m => m.model_id === defaultModel);
  const defaultModelName = defaultModelData?.model_name || defaultModel;

  // Settings to display (excluding model which is handled separately)
  const settingKeys = Object.keys(ALL_SETTINGS);

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {/* Model Selection - Always first */}
      <div className="col-span-1">
        <SettingField
          field="model"
          label="Model"
          description={defaultModel ? `Default: ${defaultModelName}` : 'Select a model'}
          localData={localData}
          handleChange={handleChange}
          handleSave={handleSave}
          handleReset={handleReset}
          hasUnsavedChanges={hasUnsavedChanges}
          handleCheckChange={handleCheckChange}
          selectedItemData={selectedItemData}
          isSupported={true}
          customInput={
            <Select
              value={localData.model || ''}
              onValueChange={handleModelChange}
              disabled={!localData.model_on}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder={defaultModel ? `Using default: ${defaultModelName}` : "Select a model"} />
              </SelectTrigger>
              <SelectContent>
                {models.map((model) => (
                  <SelectItem key={model.row_id} value={model.model_id}>
                    {model.model_name} ({model.provider})
                    {model.model_id === defaultModel && ' (default)'}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          }
        />
      </div>

      {/* Render all settings with support status */}
      {settingKeys.map(field => {
        const isSupported = isSettingSupported(field, currentModel, currentProvider);
        const settingInfo = ALL_SETTINGS[field];
        
        return (
          <SettingField
            key={field}
            field={field}
            label={settingInfo.label}
            description={settingInfo.description}
            localData={localData}
            handleChange={handleChange}
            handleSave={handleSave}
            handleReset={handleReset}
            hasUnsavedChanges={hasUnsavedChanges}
            handleCheckChange={handleCheckChange}
            selectedItemData={selectedItemData}
            isSupported={isSupported}
          />
        );
      })}
    </div>
  );
};

export default SettingsPanel;
