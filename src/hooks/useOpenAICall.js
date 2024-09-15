import { useState } from 'react';
import { useSettings } from './useSettings';
import { toast } from 'sonner';
import axios from 'axios';

const callOpenAIAPI = async (prompt, settings) => {
  try {
    const response = await axios.post('/api/openai', {
      openaiApiKey: settings.openai_api_key,
      openaiUrl: settings.openai_url,
      model: "gpt-3.5-turbo",
      messages: [{ role: "user", content: prompt }]
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

  const callOpenAI = async (prompt) => {
    setIsLoading(true);
    try {
      if (!settings.openai_api_key || !settings.openai_url) {
        throw new Error('OpenAI API configuration is missing');
      }

      const data = await callOpenAIAPI(prompt, settings);
      console.log('API Response:', data);

      if (data.choices && data.choices[0] && data.choices[0].message) {
        return data.choices[0].message.content;
      } else {
        throw new Error('Unexpected API response structure');
      }
    } catch (error) {
      console.error('Error calling OpenAI:', error);
      let errorMessage = 'Failed to call OpenAI';
      if (error.response) {
        errorMessage = `OpenAI API error: ${error.response.status} ${error.response.statusText}`;
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
