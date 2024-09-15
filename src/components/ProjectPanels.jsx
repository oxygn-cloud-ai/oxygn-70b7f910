import React, { useState, useEffect } from 'react';
import { useOpenAIModels } from '../hooks/useOpenAIModels';
import PromptField from './PromptField';
import SettingField from './SettingField';
import { Button } from "@/components/ui/button";
import { useSettings } from '../hooks/useSettings';
import { useSupabase } from '../hooks/useSupabase';

const ProjectPanels = ({ selectedItemData, projectRowId, onUpdateField }) => {
  const [localData, setLocalData] = useState(selectedItemData || {});
  const { models } = useOpenAIModels();
  const supabase = useSupabase();
  const { settings } = useSettings(supabase);
  const [timer, setTimer] = useState(0);
  const [isGenerating, setIsGenerating] = useState(false);

  useEffect(() => {
    setLocalData(selectedItemData || {});
  }, [selectedItemData]);

  useEffect(() => {
    let interval;
    if (isGenerating) {
      interval = setInterval(() => {
        setTimer((prevTimer) => prevTimer + 1);
      }, 1000);
    } else {
      clearInterval(interval);
      setTimer(0);
    }
    return () => clearInterval(interval);
  }, [isGenerating]);

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

  const handleGenerate = async () => {
    if (!settings || !settings.openai_api_key || !settings.openai_url) {
      console.error('OpenAI settings are not configured');
      return;
    }

    setIsGenerating(true);
    const startTime = Date.now();

    const requestBody = {
      messages: [
        { role: 'system', content: localData.input_admin_prompt },
        { role: 'user', content: localData.input_user_prompt }
      ],
    };

    const settingFields = [
      'model', 'temperature', 'max_tokens', 'top_p', 'frequency_penalty', 'presence_penalty',
      'stop', 'n', 'logit_bias', 'o_user', 'stream', 'best_of', 'logprobs', 'echo', 'suffix',
      'temperature_scaling', 'prompt_tokens', 'response_tokens', 'batch_size',
      'learning_rate_multiplier', 'n_epochs', 'validation_file', 'training_file', 'input',
      'context_length', 'custom_finetune'
    ];

    settingFields.forEach(field => {
      if (localData[`${field}_on`]) {
        let value = localData[field];
        if (['temperature', 'top_p', 'frequency_penalty', 'presence_penalty', 'temperature_scaling', 'learning_rate_multiplier'].includes(field)) {
          value = parseFloat(value);
        } else if (['max_tokens', 'n', 'best_of', 'logprobs', 'prompt_tokens', 'response_tokens', 'batch_size', 'n_epochs', 'context_length'].includes(field)) {
          value = parseInt(value);
        } else if (['stream', 'echo'].includes(field)) {
          value = value === 'true';
        } else if (field === 'logit_bias') {
          try {
            value = JSON.parse(value);
          } catch (error) {
            console.error('Error parsing logit_bias:', error);
            return;
          }
        }
        requestBody[field] = value;
      }
    });

    console.log('OpenAI API Request:', JSON.stringify(requestBody, null, 2));

    try {
      const response = await fetch(settings.openai_url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${settings.openai_api_key}`
        },
        body: JSON.stringify(requestBody)
      });

      const data = await response.json();
      console.log('OpenAI API Response:', JSON.stringify(data, null, 2));

      if (data.choices && data.choices.length > 0) {
        const generatedText = data.choices[0].message.content;
        handleSave('user_prompt_result', generatedText);
      }
    } catch (error) {
      console.error('Error calling OpenAI API:', error);
    } finally {
      setIsGenerating(false);
      const endTime = Date.now();
      const totalTime = (endTime - startTime) / 1000;
      console.log(`API call completed in ${totalTime} seconds`);
    }
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
      <Button
        variant="link"
        onClick={handleGenerate}
        className="self-start mb-2"
        disabled={isGenerating}
      >
        {isGenerating ? `Generating... (${timer}s)` : 'Generate'}
      </Button>
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
