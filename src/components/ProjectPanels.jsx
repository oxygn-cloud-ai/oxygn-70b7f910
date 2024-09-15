import React, { useState, useEffect } from 'react';
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Save, RotateCcw, Copy, X, CheckSquare, Square, Info } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { useSaveField } from '../hooks/useSaveField';
import { useFetchLatestData } from '../hooks/useFetchLatestData';
import { useOpenAIModels } from '../hooks/useOpenAIModels';
import { useInfoContent } from '../hooks/useInfoContent';
import { toast } from 'sonner';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import SettingInput from './SettingInput';
import TextAreaWithIcons from './TextAreaWithIcons';

const ProjectPanels = ({ selectedItemData, projectRowId }) => {
  const { saveField, isSaving } = useSaveField(projectRowId);
  const { fetchLatestData, isLoading } = useFetchLatestData(projectRowId);
  const { models, isLoading: isLoadingModels } = useOpenAIModels();
  const { infoContent, isLoading: isLoadingInfo } = useInfoContent();
  const [localData, setLocalData] = useState(selectedItemData || {});
  const [checkedSettings, setCheckedSettings] = useState({});

  useEffect(() => {
    setLocalData(selectedItemData || {});
    if (selectedItemData) {
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

  const handleCopy = (value) => {
    navigator.clipboard.writeText(value).then(() => {
      toast.success('Copied to clipboard');
    }).catch((err) => {
      console.error('Failed to copy text: ', err);
      toast.error('Failed to copy text');
    });
  };

  const handleSetEmpty = (fieldName) => {
    setLocalData(prevData => ({ ...prevData, [fieldName]: '' }));
    handleSave(fieldName, '');
  };

  const handleCheckChange = async (fieldName) => {
    const newCheckedValue = !checkedSettings[fieldName];
    setCheckedSettings(prev => ({ ...prev, [fieldName]: newCheckedValue }));
    await saveField(`${fieldName}_on`, newCheckedValue ? 1 : 0);
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
              onCopy={() => handleCopy(localData[field] || '')}
              onSetEmpty={() => handleSetEmpty(field)}
              checked={checkedSettings[field] || false}
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
