import { useState } from 'react';
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

      // Ensure the correct endpoint by removing any trailing slash and using the correct path
      const baseUrl = latestSettings.openai_url.replace(/\/+$/, '');
      const apiUrl = `${baseUrl}/v1/chat/completions`;

      console.log('Generating prompts with:', {
        inputAdminPrompt,
        inputUserPrompt,
        model: model || 'gpt-3.5-turbo',
        openaiUrl: apiUrl,
        openaiApiKey: latestSettings.openai_api_key.substring(0, 5) + '...' // Log only first 5 characters of API key
      });

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${latestSettings.openai_api_key}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: model || 'gpt-3.5-turbo',
          messages: [
            { role: 'system', content: inputAdminPrompt },
            { role: 'user', content: inputUserPrompt }
          ]
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(`HTTP error! status: ${response.status}, message: ${errorData.error?.message || 'Unknown error'}`);
      }

      const data = await response.json();
      console.log('OpenAI API Response:', data);

      return {
        generatedPrompt: data.choices[0].message.content,
        fullResponse: JSON.stringify(data, null, 2)
      };
    } catch (error) {
      console.error('Error in generatePrompts:', error.message);
      toast.error(`Failed to generate prompts: ${error.message}`);
      return null;
    } finally {
      setIsLoading(false);
    }
  };

  return { generatePrompts, isLoading };
};
