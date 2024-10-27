import { useState, useCallback } from 'react';
import { toast } from 'sonner';

export const useOpenAICall = () => {
  const [isLoading, setIsLoading] = useState(false);
  const apiSettings = {
    openai_url: import.meta.env.VITE_OPENAI_URL,
    openai_api_key: import.meta.env.VITE_OPENAI_API_KEY,
  };

  const handleApiError = (error) => {
    // Check for quota exceeded error
    if (error.status === 429) {
      try {
        const errorBody = JSON.parse(error.body);
        if (errorBody.error?.code === 'insufficient_quota') {
          toast.error('OpenAI API quota exceeded. Please check your billing details or try again later.');
          return;
        }
      } catch (parseError) {
        console.error('Error parsing error response:', parseError);
      }
    }
    
    // Handle other errors
    const errorMessage = error.message || 'An unknown error occurred';
    const status = error.status || 500;
    
    if (status === 502) {
      toast.error('Server connection failed. Please try again in a few moments.');
      console.error('Server connection error:', errorMessage);
      return null;
    }
    
    throw error;
  };

  const callOpenAI = useCallback(async (systemMessage, userMessage, projectSettings) => {
    setIsLoading(true);

    try {
      if (!apiSettings.openai_url || !apiSettings.openai_api_key) {
        throw new Error('OpenAI settings are not configured in environment variables.');
      }

      if (!userMessage || userMessage.trim() === '') {
        throw new Error('User message cannot be empty.');
      }

      const apiUrl = apiSettings.openai_url.replace(/\/$/, '');

      // Parse temperature with fallback and validation
      let temperature = 0.7; // Default value
      if (projectSettings.temperature_on && projectSettings.temperature !== undefined) {
        const parsedTemp = parseFloat(projectSettings.temperature);
        if (!isNaN(parsedTemp) && parsedTemp >= 0 && parsedTemp <= 2) {
          temperature = parsedTemp;
        } else {
          console.warn('Invalid temperature value, using default of 0.7');
        }
      }

      const requestBody = {
        model: projectSettings.model || 'gpt-3.5-turbo',
        messages: [
          { role: 'system', content: systemMessage },
          { role: 'user', content: userMessage.trim() }
        ],
        temperature,
        max_tokens: parseInt(projectSettings.max_tokens) || 2048,
        top_p: parseFloat(projectSettings.top_p) || 1,
        frequency_penalty: parseFloat(projectSettings.frequency_penalty) || 0,
        presence_penalty: parseFloat(projectSettings.presence_penalty) || 0,
      };

      if (projectSettings.response_format_on) {
        try {
          const parsedResponseFormat = JSON.parse(projectSettings.response_format);
          requestBody.response_format = parsedResponseFormat;
        } catch (error) {
          console.error('Error parsing response_format:', error);
          toast.error('Invalid response_format JSON. Using default format.');
        }
      }

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiSettings.openai_api_key}`
        },
        body: JSON.stringify(requestBody)
      });

      if (!response?.ok) {
        const errorData = await response.json();
        const error = new Error();
        error.status = response.status;
        error.body = JSON.stringify(errorData, null, 4);
        error.message = `OpenAI API error: ${errorData.error?.message || response.statusText}`;
        throw error;
      }

      const responseData = await response.json();

      if (projectSettings.response_format_on) {
        try {
          const jsonResponse = JSON.parse(responseData.choices[0].message.content);
          return JSON.stringify(jsonResponse, null, 2);
        } catch (error) {
          console.error('Error parsing JSON response:', error);
          toast.error('Failed to parse JSON response. Returning raw response.');
          return responseData.choices[0].message.content;
        }
      }

      return responseData.choices[0].message.content;
    } catch (error) {
      handleApiError(error);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [apiSettings]);

  return { callOpenAI, isLoading };
};