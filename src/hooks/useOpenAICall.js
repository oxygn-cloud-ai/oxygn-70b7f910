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
        return null;
      }

      const response = await axios.post('/api/generate-prompts', {
        inputAdminPrompt,
        inputUserPrompt,
        model: model || 'gpt-3.5-turbo',
        openaiUrl: settings.openai_url,
        openaiApiKey: settings.openai_api_key
      });

      return response.data.generatedPrompt;
    } catch (error) {
      return null;
    } finally {
      setIsLoading(false);
    }
  };

  return { generatePrompts, isLoading };
};
