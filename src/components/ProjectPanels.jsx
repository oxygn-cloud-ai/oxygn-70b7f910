import React, { useState, useEffect } from 'react';
import { useOpenAIModels } from '../hooks/useOpenAIModels';
import PromptField from './PromptField';
import SettingField from './SettingField';

const ProjectPanels = ({ selectedItemData, projectRowId, onUpdateField }) => {
  const [localData, setLocalData] = useState(selectedItemData || {});
  const { models } = useOpenAIModels();

  useEffect(() => {
    setLocalData(selectedItemData || {});
  }, [selectedItemData]);

  const handleSave = (fieldName, value) => {
    setLocalData(prevData => ({ ...prevData, [fieldName]: value }));
    onUpdateField(fieldName, value);
  };

  const handleReset = (fieldName) => {
    setLocalData(prevData => ({ ...prevData, [fieldName]: selectedItemData[fieldName] }));
  };

  const handleCheckChange = (fieldName, newValue) => {
    setLocalData(prevData => ({ ...prevData, [fieldName]: newValue }));
    onUpdateField(fieldName, newValue);
  };

  if (!projectRowId) {
    return <div>No project selected</div>;
  }

  const promptFields = [
    { name: 'admin_prompt_result', label: 'Admin Prompt' },
    { name: 'user_prompt_result', label: 'User Prompt' },
    { name: 'input_admin_prompt', label: 'Input Admin Prompt' },
    { name: 'input_user_prompt', label: 'Input User Prompt' },
    { name: 'note', label: 'Notes' }
  ];

  const settingFields = [
    'model', 'temperature', 'max_tokens', 'top_p', 'frequency_penalty', 'presence_penalty',
    'stop', 'n', 'logit_bias', 'o_user', 'stream', 'best_of', 'logprobs', 'echo', 'suffix',
    'temperature_scaling', 'prompt_tokens', 'response_tokens', 'batch_size',
    'learning_rate_multiplier', 'n_epochs', 'validation_file', 'training_file', 'engine',
    'input', 'context_length', 'custom_finetune'
  ];

  return (
    <div className="flex flex-col gap-4 h-[calc(100vh-8rem)] overflow-auto p-4">
      {promptFields.map(field => (
        <PromptField
          key={field.name}
          label={field.label}
          value={localData[field.name] || ''}
          onChange={(value) => handleSave(field.name, value)}
          onReset={() => handleReset(field.name)}
          initialValue={selectedItemData[field.name] || ''}
        />
      ))}
      <div className="border rounded-lg p-4">
        <h3 className="text-lg font-semibold mb-4">Prompt Settings</h3>
        <div className="grid grid-cols-2 gap-4">
          {settingFields.map(field => (
            <SettingField
              key={field}
              label={field}
              value={localData[field] || ''}
              onChange={(value) => handleSave(field, value)}
              checked={localData[`${field}_on`] || false}
              onCheckChange={(newValue) => handleCheckChange(`${field}_on`, newValue)}
              isSelect={field === 'model'}
              options={models}
              isTemperature={field === 'temperature'}
            />
          ))}
        </div>
      </div>
    </div>
  );
};

export default ProjectPanels;
