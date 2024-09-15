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
      };

      console.log('API Call Details:', {
        url: settings.openai_url,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${settings.openai_api_key}`
        },
        data: requestBody
      });

      const response = await axios.post(settings.openai_url, requestBody, {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${settings.openai_api_key}`
        }
      });

      console.log('API Response:', response.data);

      if (response.data && response.data.choices && response.data.choices[0] && response.data.choices[0].message) {
        return response.data.choices[0].message.content;
      } else {
        throw new Error('Unexpected API response structure');
      }
    } catch (error) {
      console.error('Error calling OpenAI:', error);
      let errorMessage = 'Failed to call OpenAI';
      if (error.response) {
        if (error.response.status === 404) {
          errorMessage = 'OpenAI API endpoint not found. Please check your API URL in settings.';
        } else {
          errorMessage = `OpenAI API error: ${error.response.status} ${error.response.statusText}`;
        }
      } else if (error.request) {
        errorMessage = 'No response received from OpenAI API. Please check your internet connection.';
      } else {
        errorMessage = error.message;
      }
      toast.error(errorMessage);
      return null;
    } finally {
      setIsLoading(false);
    }
  };

  return { callOpenAI, isLoading };
};
