import { useState } from 'react';
import { useSettings } from './useSettings';
import { toast } from 'sonner';

export const useOpenAICall = () => {
  const [isLoading, setIsLoading] = useState(false);
  const { settings } = useSettings();

  const callOpenAI = async (prompt) => {
    setIsLoading(true);
    try {
      const response = await fetch(settings.openai_url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${settings.openai_api_key}`
        },
        body: JSON.stringify({
          model: "gpt-3.5-turbo",
          messages: [{ role: "user", content: prompt }],
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
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