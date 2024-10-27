import { useState, useCallback } from 'react';
import { toast } from 'sonner';

export const useOpenAICall = () => {
  const [isLoading, setIsLoading] = useState(false);
  const apiSettings = {
    openai_url: import.meta.env.VITE_OPENAI_URL,
    openai_api_key: import.meta.env.VITE_OPENAI_API_KEY,
  };

  const handleApiError = (error) => {
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
    let controller = null;

    try {
      if (!apiSettings.openai_url || !apiSettings.openai_api_key) {
        throw new Error('OpenAI settings are not configured in environment variables.');
      }

      if (!userMessage || userMessage.trim() === '') {
        throw new Error('User message cannot be empty.');
      }

      const apiUrl = apiSettings.openai_url.replace(/\/$/, '');
      
      controller = new AbortController();
      const timeoutId = setTimeout(() => {
        if (controller) {
          controller.abort('Request timeout after 30 seconds');
        }
      }, 30000);

      // Parse temperature with fallback and validation
      let temperature = 0.7; // Default value
      if (projectSettings.temperature_on && projectSettings.temperature !== undefined) {
        const parsedTemp = parseFloat(projectSettings.temperature);
        // OpenAI requires temperature to be between 0 and 2
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
        body: JSON.stringify(requestBody),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response?.ok) {
        const errorData = await response.json();
        console.error('OpenAI API Error:', errorData);

        if (errorData.error?.code === 'model_not_found') {
          toast.warning('Model not found, falling back to gpt-3.5-turbo');
          requestBody.model = 'gpt-3.5-turbo';
          
          const fallbackResponse = await fetch(apiUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${apiSettings.openai_api_key}`
            },
            body: JSON.stringify(requestBody)
          });

          if (!fallbackResponse.ok) {
            const fallbackErrorData = await fallbackResponse.json();
            throw new Error(`Fallback OpenAI API error: ${fallbackErrorData.error?.message || fallbackResponse.statusText}`);
          }

          const fallbackData = await fallbackResponse.json();
          return fallbackData.choices[0].message.content;
        }

        throw new Error(`OpenAI API error: ${errorData.error?.message || response.statusText}`);
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
      if (error.name === 'AbortError') {
        toast.error('Request timed out after 30 seconds');
        throw new Error('Request timed out after 30 seconds');
      }
      console.error('Error calling OpenAI:', error);
      toast.error(`OpenAI API error: ${error.message}`);
      throw error;
    } finally {
      if (controller) {
        controller.abort();
      }
      setIsLoading(false);
    }
  }, [apiSettings]);

  return { callOpenAI, isLoading };
};