import { useState } from 'react';
import axios from 'axios';
import { useSettings } from './useSettings';

export const useOpenAICall = () => {
  const [isLoading, setIsLoading] = useState(false);
  const { settings } = useSettings();

  const generatePrompts = async (inputAdminPrompt, inputUserPrompt, model) => {
    setIsLoading(true);
    try {
      if (!settings?.openai_url || !settings?.openai_api_key) {
        console.log('Settings missing:', settings);
        return null;
      }

      console.log('Axios request to /api/generate-prompts:', {
        inputAdminPrompt,
        inputUserPrompt,
        model: model || 'gpt-3.5-turbo',
        openaiUrl: settings.openai_url,
        openaiApiKey: settings.openai_api_key.substring(0, 5) + '...' // Log only first 5 characters of API key
      });

      const response = await axios.post('/api/generate-prompts', {
        inputAdminPrompt,
        inputUserPrompt,
        model: model || 'gpt-3.5-turbo',
        openaiUrl: settings.openai_url,
        openaiApiKey: settings.openai_api_key
      });

      console.log('Response from /api/generate-prompts:', response.data);

      return response.data.generatedPrompt;
    } catch (error) {
      console.error('Error in generatePrompts:', error.response ? error.response.data : error.message);
      return null;
    } finally {
      setIsLoading(false);
    }
  };

  return { generatePrompts, isLoading };
};
