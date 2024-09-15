import { useState } from 'react';
import { useSettings } from './useSettings';
import { toast } from 'sonner';
import axios from 'axios';

export const useOpenAICall = () => {
  const [isLoading, setIsLoading] = useState(false);
  const { settings } = useSettings();

  const callOpenAI = async (prompt) => {
    setIsLoading(true);
    try {
      const requestBody = {
        model: "gpt-3.5-turbo",
        messages: [{ role: "user", content: prompt }],
        openaiApiKey: settings.openai_api_key,
        openaiUrl: settings.openai_url
      };

      console.log('API Call Details:', {
        url: '/api/openai',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestBody)
      });

      const response = await axios.post('/api/openai', requestBody);

      console.log('API Response:', response.data);

      return response.data.choices[0].message.content;
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
