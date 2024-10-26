import { useState, useCallback } from 'react';
import { toast } from 'sonner';

export const useOpenAICall = () => {
  const [isLoading, setIsLoading] = useState(false);
  const apiSettings = {
    openai_url: import.meta.env.VITE_OPENAI_URL,
    openai_api_key: import.meta.env.VITE_OPENAI_API_KEY,
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

      console.log('OpenAI API Call Details:', {
        url: apiUrl,
        model: requestBody.model,
        temperature: requestBody.temperature,
        maxTokens: requestBody.max_tokens,
        topP: requestBody.top_p,
        frequencyPenalty: requestBody.frequency_penalty,
        presencePenalty: requestBody.presence_penalty,
        responseFormat: requestBody.response_format,
        systemMessage,
        userMessage,
      });

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiSettings.openai_api_key}`
        },
        body: JSON.stringify(requestBody)
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error('OpenAI API Error:', errorData);

        if (errorData.error && errorData.error.code === 'model_not_found') {
          console.log('Model not found, attempting with fallback model gpt-3.5-turbo');
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
            throw new Error(`Fallback OpenAI API error: ${fallbackResponse.statusText}`);
          }

          const fallbackData = await fallbackResponse.json();
          console.log('OpenAI API Fallback Response:', JSON.stringify(fallbackData, null, 2));
          return fallbackData.choices[0].message.content;
        }

        throw new Error(`OpenAI API error: ${errorData.error.message || response.statusText}`);
      }

      const data = await response.json();
      console.log('OpenAI API Response:', JSON.stringify(data, null, 2));

      if (projectSettings.response_format_on) {
        try {
          const jsonResponse = JSON.parse(data.choices[0].message.content);
          return JSON.stringify(jsonResponse, null, 2);
        } catch (error) {
          console.error('Error parsing JSON response:', error);
          toast.error('Failed to parse JSON response. Returning raw response.');
          return data.choices[0].message.content;
        }
      }

      return data.choices[0].message.content;
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