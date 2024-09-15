import React, { useState, useEffect } from 'react';
import { useSaveField } from '../hooks/useSaveField';
import { useFetchLatestData } from '../hooks/useFetchLatestData';
import { useOpenAIModels } from '../hooks/useOpenAIModels';
import { useInfoContent } from '../hooks/useInfoContent';
import { toast } from 'sonner';
import TextAreaWithIcons from './TextAreaWithIcons';
import SettingInput from './SettingInput';

const ProjectPanels = ({ selectedItemData, projectRowId }) => {
  const { saveField, isSaving } = useSaveField(projectRowId);
  const { fetchLatestData, isLoading } = useFetchLatestData(projectRowId);
  const { models, isLoading: isLoadingModels } = useOpenAIModels();
  const { infoContent, isLoading: isLoadingInfo } = useInfoContent();
  const [localData, setLocalData] = useState(selectedItemData || {});
  const [checkedSettings, setCheckedSettings] = useState({});

  useEffect(() => {
    if (selectedItemData) {
      setLocalData(selectedItemData);
      const initialCheckedSettings = {};
      promptSettingsFields.forEach(field => {
        initialCheckedSettings[field] = selectedItemData[`${field}_on`] === 1;
      });
      setCheckedSettings(initialCheckedSettings);
    }
  }, [selectedItemData]);

  const handleSave = async (fieldName, value) => {
    if (projectRowId) {
      await saveField(fieldName, value);
      setLocalData(prevData => ({ ...prevData, [fieldName]: value }));
    }
  };

  const handleReset = async (fieldName) => {
    if (projectRowId) {
      const latestData = await fetchLatestData();
      if (latestData !== null) {
        setLocalData(prevData => ({ ...prevData, ...latestData }));
        return latestData[fieldName];
      }
    }
    return null;
  };

  const handleCheckChange = async (fieldName) => {
    const newCheckedValue = !checkedSettings[fieldName];
    setCheckedSettings(prev => ({ ...prev, [fieldName]: newCheckedValue }));
    await saveField(`${field}_on`, newCheckedValue ? 1 : 0);
  };

  const getMaxTokensLabel = () => {
    const selectedModel = models.find(m => m.model === localData.model);
    return selectedModel ? `max_tokens (<= ${selectedModel.max_tokens})` : 'max_tokens';
  };

  if (!projectRowId) {
    return <div>No project selected</div>;
  }

  const textAreaFields = [
    { name: 'admin_prompt_result', placeholder: 'Admin Prompt' },
    { name: 'user_prompt_result', placeholder: 'User Prompt' },
    { name: 'input_admin_prompt', placeholder: 'Input Admin Prompt' },
    { name: 'input_user_prompt', placeholder: 'Input User Prompt' }
  ];

  const promptSettingsFields = [
    'model', 'temperature', 'max_tokens', 'top_p', 'frequency_penalty', 'presence_penalty',
    'stop', 'n', 'logit_bias', 'user', 'stream', 'best_of', 'logprobs', 'echo', 'suffix',
    'temperature_scaling', 'prompt_tokens', 'response_tokens', 'batch_size',
    'learning_rate_multiplier', 'n_epochs', 'validation_file', 'training_file', 'engine',
    'input', 'context_length', 'custom_finetune'
  ];

  return (
    <div className="flex flex-col gap-4 h-[calc(100vh-8rem)] overflow-auto p-4">
      {textAreaFields.map(field => (
        <TextAreaWithIcons
          key={field.name}
          placeholder={field.placeholder}
          value={localData[field.name] || ''}
          fieldName={field.name}
          onSave={handleSave}
          onReset={handleReset}
          readOnly={false}
        />
      ))}
      <div className="border rounded-lg p-4">
        <h3 className="text-lg font-semibold mb-4">Prompt Settings</h3>
        <div className="grid grid-cols-2 gap-4">
          {promptSettingsFields.map(field => (
            <SettingInput
              key={field}
              label={field === 'max_tokens' ? getMaxTokensLabel() : field}
              value={localData[field] || ''}
              onChange={(value) => {
                setLocalData(prev => ({ ...prev, [field]: value }));
                handleSave(field, value);
              }}
              checked={checkedSettings[field]}
              onCheckChange={() => handleCheckChange(field)}
              isSelect={field === 'model'}
              options={models}
              isTemperature={field === 'temperature'}
              infoContent={infoContent[field] || 'No information available'}
            />
          ))}
        </div>
      </div>
    </div>
  );
};

export default ProjectPanels;
