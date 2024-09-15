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
      const response = await axios.post(
        settings.openai_url,
        {
          model: model,
          messages: [
            { role: 'system', content: inputAdminPrompt },
            { role: 'user', content: inputUserPrompt }
          ]
        },
        {
          headers: {
            'Authorization': `Bearer ${settings.openai_api_key}`,
            'Content-Type': 'application/json'
          }
        }
      );

      setIsLoading(false);
      return response.data.choices[0].message.content;
    } catch (error) {
      setIsLoading(false);
      console.error('Error calling OpenAI API:', error);
      toast.error('Failed to generate prompts');
      throw error;
    }
  };

  return { generatePrompts, isLoading };
};