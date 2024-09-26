import React from 'react';
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import SettingField from './SettingField';
import { Save, RotateCcw } from 'lucide-react';

const SettingsPanel = ({ localData, selectedItemData, models, handleChange, handleSave, handleReset }) => {
  const handleCheckChange = (fieldName, checked) => {
    handleChange(`${fieldName}_on`, checked);
  };

  const renderSettingFields = () => {
    const fields = [
      'temperature', 'max_tokens', 'response_format', 'top_p', 'frequency_penalty', 'presence_penalty',
      'stop', 'n', 'logit_bias', 'o_user', 'stream', 'best_of', 'logprobs', 'echo', 'suffix',
      'temperature_scaling', 'prompt_tokens', 'response_tokens', 'batch_size',
      'learning_rate_multiplier', 'n_epochs', 'validation_file', 'training_file', 'engine',
      'input', 'context_length', 'custom_finetune'
    ];

    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <div className="col-span-1">
          <div className="flex items-center space-x-2 mb-2">
            <Checkbox
              id="model-checkbox"
              checked={localData.model_on || false}
              onCheckedChange={(checked) => handleCheckChange('model', checked)}
            />
            <label htmlFor="model" className="text-sm font-medium text-gray-700 flex-grow">
              Model
            </label>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => handleSave('model')}
              disabled={localData.model === selectedItemData.model}
              className="h-6 w-6"
            >
              <Save className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => handleReset('model')}
              disabled={localData.model === selectedItemData.model}
              className="h-6 w-6"
            >
              <RotateCcw className="h-4 w-4" />
            </Button>
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
        {fields.map(field => (
          <div key={field} className="relative">
            <div className="flex items-center space-x-2 mb-2">
              <Checkbox
                id={`${field}-checkbox`}
                checked={localData[`${field}_on`] || false}
                onCheckedChange={(checked) => handleCheckChange(field, checked)}
              />
              <label htmlFor={field} className="text-sm font-medium text-gray-700 flex-grow">
                {field}
              </label>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => handleSave(field)}
                disabled={localData[field] === selectedItemData[field]}
                className="h-6 w-6"
              >
                <Save className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => handleReset(field)}
                disabled={localData[field] === selectedItemData[field]}
                className="h-6 w-6"
              >
                <RotateCcw className="h-4 w-4" />
              </Button>
            </div>
            <SettingField
              id={field}
              value={localData[field] || ''}
              onChange={(value) => handleChange(field, value)}
              disabled={!localData[`${field}_on`]}
            />
          </div>
        ))}
      </div>
    );
  };

  return (
    <>
      {renderSettingFields()}
    </>
  );
};

export default SettingsPanel;
