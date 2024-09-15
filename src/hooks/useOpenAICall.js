import { useState } from 'react';
import axios from 'axios';
import { useSettings } from './useSettings';

const callOpenAIAPI = async (url, requestBody, apiKey) => {
  const response = await axios.post(url, requestBody, {
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    }
  });
  return response.data;
};

export const useOpenAICall = () => {
  const [isLoading, setIsLoading] = useState(false);
  const { settings } = useSettings();

  const generatePrompts = async (inputAdminPrompt, inputUserPrompt, model) => {
    setIsLoading(true);
    try {
      if (!settings.openai_url || !settings.openai_api_key) {
        return null;
      }

      const requestBody = {
        model: model || 'gpt-3.5-turbo',
        messages: [
          { role: 'system', content: inputAdminPrompt },
          { role: 'user', content: inputUserPrompt }
        ]
      };

      const data = await callOpenAIAPI(settings.openai_url, requestBody, settings.openai_api_key);
      return data.choices[0].message.content;
    } finally {
      setIsLoading(false);
    }
  };

  return { generatePrompts, isLoading };
};
