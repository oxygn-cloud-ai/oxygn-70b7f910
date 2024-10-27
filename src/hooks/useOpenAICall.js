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
          { role: 'system', content: systemMessage },
          { role: 'user', content: userMessage.trim() }
        ],
        temperature,
        max_tokens: parseInt(projectSettings.max_tokens) || 2048,
        top_p: parseFloat(projectSettings.top_p) || 1,
        frequency_penalty: parseFloat(projectSettings.frequency_penalty) || 0,
        presence_penalty: parseFloat(projectSettings.presence_penalty) || 0,
      };

      // Only add response_format if it's enabled and valid
      if (projectSettings.response_format_on && projectSettings.response_format) {
        try {
          const parsedFormat = JSON.parse(projectSettings.response_format);
          if (parsedFormat && typeof parsedFormat === 'object') {
            requestBody.response_format = parsedFormat;
          }
        } catch (error) {
          console.warn('Invalid response_format JSON, skipping:', error);
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
      const content = responseData.choices[0].message.content;

      // If response_format is enabled, try to parse as JSON but fallback gracefully
      if (projectSettings.response_format_on) {
        try {
          // First check if the content is already a valid JSON string
          const parsed = JSON.parse(content);
          return JSON.stringify(parsed, null, 2);
        } catch (firstError) {
          // If direct parsing fails, try to find JSON within the content
          try {
            const jsonMatch = content.match(/\{[\s\S]*\}|\[[\s\S]*\]/);
            if (jsonMatch) {
              const parsed = JSON.parse(jsonMatch[0]);
              return JSON.stringify(parsed, null, 2);
            }
          } catch (secondError) {
            console.warn('Could not extract valid JSON from response, returning raw content');
          }
        }
      }

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