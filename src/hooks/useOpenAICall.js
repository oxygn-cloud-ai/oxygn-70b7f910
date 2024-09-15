import { useState } from 'react';
import { useSettings } from './useSettings';
import { toast } from 'sonner';

export const useOpenAICall = () => {
  const [isLoading, setIsLoading] = useState(false);
  const { settings } = useSettings();

  const callOpenAI = async (prompt) => {
    setIsLoading(true);
    try {
      const requestBody = {
        model: "gpt-3.5-turbo",
        messages: [{ role: "user", content: prompt }],
      };

      console.log('API Call Details:', {
        url: settings.proxy_url,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          openaiUrl: settings.openai_url,
          openaiApiKey: settings.openai_api_key,
          requestBody: requestBody
        })
      });

      const response = await fetch(settings.proxy_url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          openaiUrl: settings.openai_url,
          openaiApiKey: settings.openai_api_key,
          requestBody: requestBody
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      console.log('API Response:', data);

      return data.choices[0].message.content;
    } catch (error) {
      console.error('Error calling OpenAI:', error);
      toast.error(`Failed to call OpenAI: ${error.message}`);
      return null;
    } finally {
      setIsLoading(false);
    }
  };

  return { callOpenAI, isLoading };
};
