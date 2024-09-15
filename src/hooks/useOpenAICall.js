import { useState } from 'react';
import { useSettings } from './useSettings';
import { supabase } from '../lib/supabase';

export const useOpenAICall = () => {
  const [isLoading, setIsLoading] = useState(false);
  const { settings } = useSettings();

  const callOpenAI = async (systemMessage, userMessage, projectSettings) => {
    setIsLoading(true);
    try {
      if (!settings || !settings.openai_url || !settings.openai_api_key) {
        throw new Error('OpenAI settings are not configured');
      }

      const apiUrl = settings.openai_url.endsWith('/')
        ? `${settings.openai_url}v1/chat/completions`
        : `${settings.openai_url}/v1/chat/completions`;

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${settings.openai_api_key}`
        },
        body: JSON.stringify({
          model: projectSettings.model || 'gpt-3.5-turbo',
          messages: [
            { role: 'system', content: systemMessage },
            { role: 'user', content: userMessage }
          ],
          temperature: parseFloat(projectSettings.temperature) || 0.7,
          max_tokens: parseInt(projectSettings.max_tokens) || 150,
          top_p: parseFloat(projectSettings.top_p) || 1,
          frequency_penalty: parseFloat(projectSettings.frequency_penalty) || 0,
          presence_penalty: parseFloat(projectSettings.presence_penalty) || 0,
        })
      });

      if (!response.ok) {
        const errorData = await response.text();
        console.error('OpenAI API Error:', errorData);
        throw new Error(`OpenAI API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      console.log('OpenAI API Call:', {
        request: {
          systemMessage,
          userMessage,
          settings: projectSettings
        },
        response: data
      });

      return data.choices[0].message.content;
    } catch (error) {
      console.error('Error calling OpenAI:', error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  return { callOpenAI, isLoading };
};
