import { useState } from 'react';
import axios from 'axios';
import { useSettings } from './useSettings';
import { toast } from 'sonner';

export const useOpenAICall = () => {
  const [isLoading, setIsLoading] = useState(false);
  const { settings } = useSettings();

  const generatePrompts = async (inputAdminPrompt, inputUserPrompt, model) => {
    setIsLoading(true);
    try {
      if (!settings.openai_url || !settings.openai_api_key) {
        throw new Error('OpenAI URL or API key is missing. Please check your settings.');
      }

      const response = await axios.post(
        settings.openai_url,
        {
          model: model || 'gpt-3.5-turbo', // Fallback to a default model if not provided
          messages: [
            { role: 'system', content: inputAdminPrompt },
            { role: 'user', content: inputUserPrompt }
          ]
        },
        {
          headers: {
            'Authorization': `Bearer ${settings.openai_api_key}`,
            'Content-Type': 'application/json'
          },
          maxContentLength: Infinity,
          maxBodyLength: Infinity
        }
      );

      return response.data.choices[0].message.content;
    } catch (error) {
      console.error('Error calling OpenAI API:', error);
      if (axios.isAxiosError(error)) {
        if (error.response) {
          // The request was made and the server responded with a status code
          // that falls out of the range of 2xx
          toast.error(`API Error: ${error.response.status} - ${error.response.data.error?.message || 'Unknown error'}`);
        } else if (error.request) {
          // The request was made but no response was received
          toast.error('No response received from OpenAI API. Please check your internet connection.');
        } else {
          // Something happened in setting up the request that triggered an Error
          toast.error(`Error setting up the request: ${error.message}`);
        }
      } else {
        toast.error(`Failed to generate prompts: ${error.message}`);
      }
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  return { generatePrompts, isLoading };
};
