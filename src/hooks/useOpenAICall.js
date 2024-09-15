import { useState } from 'react';
import axios from 'axios';
import { useSettings } from './useSettings';
import { toast } from 'sonner';

const callOpenAIAPI = async (url, requestBody, apiKey) => {
  try {
    const response = await axios.post(url, requestBody, {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      }
    });
    return response.data;
  } catch (error) {
    console.error('Error calling OpenAI API:', error);
    throw new Error('Unable to generate response: ' + error.message);
  }
};

export const useOpenAICall = () => {
  const [isLoading, setIsLoading] = useState(false);
  const { settings } = useSettings();

  const generatePrompts = async (inputAdminPrompt, inputUserPrompt, model) => {
    setIsLoading(true);
    try {
      if (!settings.openai_url || !settings.openai_api_key) {
        throw new Error('OpenAI API configuration is missing');
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
    } catch (error) {
      console.error('Error generating prompts:', error);
      toast.error(`Failed to generate prompts: ${error.message}`);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  return { generatePrompts, isLoading };
};
