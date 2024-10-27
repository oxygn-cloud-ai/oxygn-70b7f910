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

  const getFallbackModel = (currentModel) => {
    // Map of deprecated models to their recommended replacements
    const modelReplacements = {
      'text-davinci-002': 'gpt-3.5-turbo',
      'text-davinci-003': 'gpt-3.5-turbo',
      'code-davinci-002': 'gpt-4',
      // Add more model mappings as needed
    };

    return modelReplacements[currentModel] || 'gpt-3.5-turbo';
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
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000);

      const requestBody = {
        model: projectSettings.model,
        messages: [
          { role: 'system', content: systemMessage },
          { role: 'user', content: userMessage.trim() }
        ],
        temperature: parseFloat(projectSettings.temperature),
        max_tokens: parseInt(projectSettings.max_tokens),
        top_p: parseFloat(projectSettings.top_p),
        frequency_penalty: parseFloat(projectSettings.frequency_penalty),
        presence_penalty: parseFloat(projectSettings.presence_penalty),
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

      const makeRequest = async (model) => {
        const currentRequestBody = { ...requestBody, model };
        const response = await fetch(apiUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiSettings.openai_api_key}`
          },
          body: JSON.stringify(currentRequestBody),
          signal: controller.signal
        });

        const responseData = await response.json();
        
        if (!response.ok) {
          if (responseData.error?.code === 'model_not_found') {
            throw new Error('model_not_found');
          }
          throw new Error(responseData.error?.message || response.statusText);
        }

        return responseData;
      };

      let responseData;
      try {
        responseData = await makeRequest(requestBody.model);
      } catch (error) {
        if (error.message === 'model_not_found') {
          const fallbackModel = getFallbackModel(requestBody.model);
          console.log(`Model ${requestBody.model} not found, attempting with fallback model ${fallbackModel}`);
          toast.info(`Using fallback model: ${fallbackModel}`);
          responseData = await makeRequest(fallbackModel);
        } else {
          throw error;
        }
      } finally {
        clearTimeout(timeoutId);
      }

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
      console.error('Error calling OpenAI:', error);
      toast.error(`OpenAI API error: ${error.message}`);
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, [apiSettings]);

  return { callOpenAI, isLoading };
};