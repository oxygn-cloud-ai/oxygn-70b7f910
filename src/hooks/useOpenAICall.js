import { useState } from 'react';
import axios from 'axios';
import { useSettings } from './useSettings';
import { toast } from 'sonner';

export const useOpenAICall = () => {
  const [isLoading, setIsLoading] = useState(false);
  const { getLatestSettings } = useSettings();

  const generatePrompts = async (inputAdminPrompt, inputUserPrompt, model) => {
    setIsLoading(true);
    try {
      const latestSettings = await getLatestSettings();
      if (!latestSettings?.openai_url || !latestSettings?.openai_api_key) {
        console.log('Settings missing:', latestSettings);
        toast.error('OpenAI settings are missing. Please check your settings.');
        return null;
      }

      console.log('Generating prompts with:', {
        inputAdminPrompt,
        inputUserPrompt,
        model: model || 'gpt-3.5-turbo',
        openaiUrl: latestSettings.openai_url,
        openaiApiKey: latestSettings.openai_api_key.substring(0, 5) + '...' // Log only first 5 characters of API key
      });

      const response = await axios.post(latestSettings.openai_url, {
        model: model || 'gpt-3.5-turbo',
        messages: [
          { role: 'system', content: inputAdminPrompt },
          { role: 'user', content: inputUserPrompt }
        ]
      }, {
        headers: {
          'Authorization': `Bearer ${latestSettings.openai_api_key}`,
          'Content-Type': 'application/json'
        }
      });

      console.log('OpenAI API Response:', response.data);

      return {
        generatedPrompt: response.data.choices[0].message.content,
        fullResponse: JSON.stringify(response.data, null, 2)
      };
    } catch (error) {
      console.error('Error in generatePrompts:', error.response ? error.response.data : error.message);
      toast.error(`Failed to generate prompts: ${error.message}`);
      return null;
    } finally {
      setIsLoading(false);
    }
  };

  return { generatePrompts, isLoading };
};
