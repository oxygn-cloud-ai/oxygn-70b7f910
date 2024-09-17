import { useState, useEffect, useCallback } from 'react';
import { useSettings } from './useSettings';
import { useSupabase } from './useSupabase';
import { toast } from 'sonner';

export const useOpenAICall = () => {
  const [isLoading, setIsLoading] = useState(false);
  const supabase = useSupabase();
  const { settings, isLoading: settingsLoading } = useSettings(supabase);
  const [apiSettings, setApiSettings] = useState(null);

  useEffect(() => {
    if (settings && !settingsLoading) {
      setApiSettings({
        openai_url: settings.openai_url,
        openai_api_key: settings.openai_api_key,
      });
    }
  }, [settings, settingsLoading]);

  const callOpenAI = useCallback(async (systemMessage, userMessage, projectSettings) => {
    setIsLoading(true);
    try {
      if (!apiSettings || !apiSettings.openai_url || !apiSettings.openai_api_key) {
        throw new Error('OpenAI settings are not configured. Please check your settings.');
      }

      const apiUrl = apiSettings.openai_url.replace(/\/$/, '');

      const requestBody = {
        model: projectSettings.model,
        messages: [
          { role: 'system', content: systemMessage },
          { role: 'user', content: userMessage }
        ],
        temperature: parseFloat(projectSettings.temperature),
        max_tokens: parseInt(projectSettings.max_tokens),
        top_p: parseFloat(projectSettings.top_p),
        frequency_penalty: parseFloat(projectSettings.frequency_penalty),
        presence_penalty: parseFloat(projectSettings.presence_penalty),
      };

      console.log('OpenAI API Call Details:', {
        url: apiUrl,
        model: requestBody.model,
        temperature: requestBody.temperature,
        maxTokens: requestBody.max_tokens,
        topP: requestBody.top_p,
        frequencyPenalty: requestBody.frequency_penalty,
        presencePenalty: requestBody.presence_penalty,
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
