import React, { useEffect } from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import SettingField from './settings/SettingField';
import { useSupabase } from '../hooks/useSupabase';
import { toast } from 'sonner';

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
          model: models[0]?.model || 'gpt-3.5-turbo'
        };

        if (defaultValues[fieldName]) {
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

  useEffect(() => {
    const loadSettings = async () => {
      if (selectedItemData?.row_id) {
        try {
          const { data, error } = await supabase
            .from(import.meta.env.VITE_PROMPTS_TBL)
            .select('*')
            .eq('row_id', selectedItemData.row_id)
            .single();

          if (error) throw error;

          Object.keys(data).forEach(key => {
            if (key.endsWith('_on') || key in localData) {
              handleChange(key, data[key]);
            }
          });
        } catch (error) {
          console.error('Error loading settings:', error);
          toast.error('Failed to load settings');
        }
      }
    };

    loadSettings();
  }, [selectedItemData?.row_id]);

  const handleModelChange = async (value) => {
    handleChange('model', value);
    try {
      const { error } = await supabase
        .from(import.meta.env.VITE_PROMPTS_TBL)
        .update({ model: value })
        .eq('row_id', selectedItemData.row_id);

      if (error) throw error;
      toast.success('Model updated successfully');
    } catch (error) {
      console.error('Error updating model:', error);
      toast.error(`Failed to update model: ${error.message}`);
    }
  };

  const fields = [
    'max_tokens', 'top_p', 'frequency_penalty', 'presence_penalty',
    'stop', 'n', 'logit_bias', 'o_user', 'stream', 'best_of', 'logprobs', 
    'echo', 'suffix', 'temperature_scaling', 'prompt_tokens', 'response_tokens', 
    'batch_size', 'learning_rate_multiplier', 'n_epochs', 'validation_file', 
    'training_file', 'engine', 'input', 'context_length', 'custom_finetune'
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      <div className="col-span-1">
        <SettingField
          field="model"
          label="Model"
          localData={localData}
          handleChange={handleChange}
          handleSave={handleSave}
          handleReset={handleReset}
          hasUnsavedChanges={hasUnsavedChanges}
          handleCheckChange={handleCheckChange}
          customInput={
            <Select
              value={localData.model || ''}
              onValueChange={handleModelChange}
              disabled={!localData.model_on}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select a model" />
              </SelectTrigger>
              <SelectContent>
                {models.map((model) => (
                  <SelectItem key={model.model} value={model.model}>
                    {model.model}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          }
        />
      </div>

      <div className="col-span-1">
        <SettingField
          field="temperature"
          label="Temperature"
          localData={localData}
          handleChange={handleChange}
          handleSave={handleSave}
          handleReset={handleReset}
          hasUnsavedChanges={hasUnsavedChanges}
          handleCheckChange={handleCheckChange}
        />
      </div>

      {fields.map(field => (
        <SettingField
          key={field}
          field={field}
          localData={localData}
          handleChange={handleChange}
          handleSave={handleSave}
          handleReset={handleReset}
          hasUnsavedChanges={hasUnsavedChanges}
          handleCheckChange={handleCheckChange}
        />
      ))}
    </div>
  );
};

export default SettingsPanel;