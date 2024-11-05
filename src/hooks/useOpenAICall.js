import { useState, useCallback } from 'react';
import { toast } from 'sonner';

const MAX_TOKENS = 16000;
const ESTIMATED_TOKENS_PER_CHAR = 0.4;

const estimateTokenCount = (text) => {
  return Math.ceil(text.length * ESTIMATED_TOKENS_PER_CHAR);
};

const truncateText = (text, maxTokens) => {
  const estimatedMaxChars = Math.floor(maxTokens / ESTIMATED_TOKENS_PER_CHAR);
  return text.slice(0, estimatedMaxChars);
};

export const useOpenAICall = () => {
  const [isLoading, setIsLoading] = useState(false);
  const apiSettings = {
    openai_url: import.meta.env.VITE_OPENAI_URL,
    openai_api_key: import.meta.env.VITE_OPENAI_API_KEY,
  };

  const handleApiError = (error) => {
    const errorMessage = error.message || 'An unknown error occurred';
    const status = error.status || 500;
    
    if (status >= 500) {
      toast.error('Server is temporarily unavailable. Please try again in a few moments.');
      console.error('Server error:', errorMessage);
      return { error: 'SERVER_ERROR' };
    }
    
    if (status === 429) {
      try {
        const errorBody = JSON.parse(error.body);
        if (errorBody.error?.code === 'insufficient_quota') {
          toast.error('OpenAI API quota exceeded. Please check your billing details or try again later.');
          return { error: 'QUOTA_EXCEEDED' };
        }
      } catch (parseError) {
        console.error('Error parsing error response:', parseError);
      }
    }

    if (status === 400) {
      try {
        const errorBody = JSON.parse(error.body);
        if (errorBody.error?.code === 'context_length_exceeded') {
          toast.error('The input text is too long. It will be automatically truncated.');
          return { error: 'CONTEXT_LENGTH_EXCEEDED' };
        }
      } catch (parseError) {
        console.error('Error parsing error response:', parseError);
      }
    }

    toast.error(`API error: ${errorMessage}`);
    return { error: 'API_ERROR' };
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

      const systemTokens = estimateTokenCount(systemMessage);
      const userTokens = estimateTokenCount(userMessage);
      const totalInputTokens = systemTokens + userTokens;

      let finalSystemMessage = systemMessage;
      let finalUserMessage = userMessage;

      if (totalInputTokens > MAX_TOKENS) {
        const availableTokens = MAX_TOKENS;
        const systemRatio = systemTokens / totalInputTokens;
        const userRatio = userTokens / totalInputTokens;

        finalSystemMessage = truncateText(systemMessage, Math.floor(availableTokens * systemRatio));
        finalUserMessage = truncateText(userMessage, Math.floor(availableTokens * userRatio));

        toast.warning('Input text was truncated to fit within model limits.');
      }

      const apiUrl = apiSettings.openai_url.replace(/\/$/, '');
      let temperature = 0.7;
      
      if (projectSettings.temperature_on && projectSettings.temperature !== undefined) {
        const parsedTemp = parseFloat(projectSettings.temperature);
        if (!isNaN(parsedTemp) && parsedTemp >= 0 && parsedTemp <= 2) {
          temperature = parsedTemp;
        }
      }

      const requestBody = {
        model: projectSettings.model || 'gpt-3.5-turbo',
        messages: [
          { role: 'system', content: finalSystemMessage },
          { role: 'user', content: finalUserMessage.trim() }
        ],
        temperature,
        max_tokens: parseInt(projectSettings.max_tokens) || 2048,
        top_p: parseFloat(projectSettings.top_p) || 1,
        frequency_penalty: parseFloat(projectSettings.frequency_penalty) || 0,
        presence_penalty: parseFloat(projectSettings.presence_penalty) || 0,
      };

      // Log request details to console
      console.log('OpenAI API Request Details:', {
        url: apiUrl,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer [REDACTED]'
        },
        body: JSON.stringify(requestBody, null, 2)
      });

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
      const content = responseData.choices[0].message.content;

      return content;
    } catch (error) {
      handleApiError(error);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [apiSettings]);

  return { callOpenAI, isLoading };
};