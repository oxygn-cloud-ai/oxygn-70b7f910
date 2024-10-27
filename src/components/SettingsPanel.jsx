import React from 'react';
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import SettingField from './SettingField';
import { Save, RotateCcw } from 'lucide-react';

const SettingsPanel = ({ localData, selectedItemData, models, handleChange, handleSave, handleReset, hasUnsavedChanges }) => {
  const handleCheckChange = (fieldName, checked) => {
    // Update both the _on field and initialize the value field if it's being enabled
    handleChange(`${fieldName}_on`, checked);
    
    // If checkbox is being checked and the field doesn't have a value, initialize it
    if (checked && !localData[fieldName]) {
      // Initialize with appropriate default values based on field type
      switch (fieldName) {
        case 'temperature':
          handleChange(fieldName, '0.7');
          break;
        case 'max_tokens':
          handleChange(fieldName, '2048');
          break;
        case 'top_p':
          handleChange(fieldName, '1');
          break;
        case 'frequency_penalty':
        case 'presence_penalty':
          handleChange(fieldName, '0');
          break;
        case 'n':
          handleChange(fieldName, '1');
          break;
        case 'stream':
        case 'echo':
          handleChange(fieldName, false);
          break;
        case 'response_format':
          handleChange(fieldName, '{"type": "text"}');
          break;
        default:
          handleChange(fieldName, '');
      }
    }
  };

  const renderSettingFields = () => {
    const fields = [
      'max_tokens', 'top_p', 'frequency_penalty', 'presence_penalty',
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
              disabled={!hasUnsavedChanges('model')}
              className="h-6 w-6"
            >
              <Save className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => handleReset('model')}
              disabled={!hasUnsavedChanges('model')}
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
        <div className="col-span-1">
          <div className="relative">
            <div className="flex items-center space-x-2 mb-2">
              <Checkbox
                id="temperature-checkbox"
                checked={localData.temperature_on || false}
                onCheckedChange={(checked) => handleCheckChange('temperature', checked)}
              />
              <label htmlFor="temperature" className="text-sm font-medium text-gray-700 flex-grow">
                temperature
              </label>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => handleSave('temperature')}
                disabled={!hasUnsavedChanges('temperature')}
                className="h-6 w-6"
              >
                <Save className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => handleReset('temperature')}
                disabled={!hasUnsavedChanges('temperature')}
                className="h-6 w-6"
              >
                <RotateCcw className="h-4 w-4" />
              </Button>
            </div>
            <SettingField
              id="temperature"
              value={localData.temperature || ''}
              onChange={(value) => handleChange('temperature', value)}
              disabled={!localData.temperature_on}
            />
          </div>
        </div>
        <div className="col-span-full">
          <div className="relative">
            <div className="flex items-center space-x-2 mb-2">
              <Checkbox
                id="response_format-checkbox"
                checked={localData.response_format_on || false}
                onCheckedChange={(checked) => handleCheckChange('response_format', checked)}
              />
              <label htmlFor="response_format" className="text-sm font-medium text-gray-700 flex-grow">
                response_format
              </label>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => handleSave('response_format')}
                disabled={!hasUnsavedChanges('response_format')}
                className="h-6 w-6"
              >
                <Save className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => handleReset('response_format')}
                disabled={!hasUnsavedChanges('response_format')}
                className="h-6 w-6"
              >
                <RotateCcw className="h-4 w-4" />
              </Button>
            </div>
            <SettingField
              id="response_format"
              value={localData.response_format || ''}
              onChange={(value) => handleChange('response_format', value)}
              disabled={!localData.response_format_on}
            />
          </div>
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
                disabled={!hasUnsavedChanges(field)}
                className="h-6 w-6"
              >
                <Save className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => handleReset(field)}
                disabled={!hasUnsavedChanges(field)}
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