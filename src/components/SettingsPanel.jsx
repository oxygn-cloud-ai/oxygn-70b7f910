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
    // Update the _on field
    handleChange(`${fieldName}_on`, checked);
    
    try {
      // Save the _on field change immediately to database
      const { error } = await supabase
        .from(import.meta.env.VITE_PROMPTS_TBL)
        .update({ [`${fieldName}_on`]: checked })
        .eq('row_id', selectedItemData.row_id);

      if (error) throw error;

      // If enabling the field, initialize with default value if not set
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
        };

        if (defaultValues[fieldName]) {
          handleChange(fieldName, defaultValues[fieldName]);
          // Save the default value to database
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

  // Load initial values from database
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

          // Update local state with database values
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
        <div className="flex items-center space-x-2 mb-2">
          <label htmlFor="model" className="text-sm font-medium text-gray-700 flex-grow">
            Model
          </label>
        </div>
        <Select
          value={localData.model || ''}
          onValueChange={(value) => handleChange('model', value)}
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