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

  const handleGenerate = async () => {
    if (!settings || !settings.openai_api_key || !settings.openai_url) {
      console.error('OpenAI settings are not configured');
      return;
    }

    const requestBody = {
      messages: [
        { role: 'system', content: localData.input_admin_prompt },
        { role: 'user', content: localData.input_user_prompt }
      ],
      model: localData.model,
      temperature: parseFloat(localData.temperature),
      max_tokens: parseInt(localData.max_tokens),
      top_p: parseFloat(localData.top_p),
      frequency_penalty: parseFloat(localData.frequency_penalty),
      presence_penalty: parseFloat(localData.presence_penalty),
      stop: localData.stop,
      n: parseInt(localData.n),
      logit_bias: localData.logit_bias,
      user: localData.o_user,
      stream: localData.stream === 'true',
      best_of: parseInt(localData.best_of),
      logprobs: parseInt(localData.logprobs),
      echo: localData.echo === 'true',
      suffix: localData.suffix,
      temperature_scaling: parseFloat(localData.temperature_scaling),
      prompt_tokens: parseInt(localData.prompt_tokens),
      response_tokens: parseInt(localData.response_tokens),
      batch_size: parseInt(localData.batch_size),
      learning_rate_multiplier: parseFloat(localData.learning_rate_multiplier),
      n_epochs: parseInt(localData.n_epochs),
      validation_file: localData.validation_file,
      training_file: localData.training_file,
      input: localData.input,
      context_length: parseInt(localData.context_length),
      custom_finetune: localData.custom_finetune
    };

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

      // Update the user prompt result field with the API response
      if (data.choices && data.choices.length > 0) {
        const generatedText = data.choices[0].message.content;
        handleSave('user_prompt_result', generatedText);
      }
    } catch (error) {
      console.error('Error calling OpenAI API:', error);
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
      >
        Generate
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
