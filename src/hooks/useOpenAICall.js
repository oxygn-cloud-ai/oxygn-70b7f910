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

      // Remove trailing slash from the API URL if it exists
      const apiUrl = settings.openai_url.replace(/\/$/, '');

      const requestBody = {
        model: projectSettings.model || 'gpt-3.5-turbo',
        messages: [
          { role: 'system', content: systemMessage },
          { role: 'user', content: userMessage }
        ],
        temperature: parseFloat(projectSettings.temperature) || 0.7,
        max_tokens: Math.min(parseInt(projectSettings.max_tokens) || 150, 4096),
        top_p: parseFloat(projectSettings.top_p) || 1,
        frequency_penalty: parseFloat(projectSettings.frequency_penalty) || 0,
        presence_penalty: parseFloat(projectSettings.presence_penalty) || 0,
      };

      console.log('OpenAI API Call Details:');
      console.log('URL:', apiUrl);
      console.log('Headers:', {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${settings.openai_api_key.substring(0, 5)}...` // Log only first 5 characters of API key
      });
      console.log('Request Body:', JSON.stringify(requestBody, null, 2));

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${settings.openai_api_key}`
        },
        body: JSON.stringify(requestBody)
      });

      const responseData = await response.json();

      console.log('OpenAI API Response:', JSON.stringify(responseData, null, 2));

      if (!response.ok) {
        throw new Error(`OpenAI API error: ${response.status} ${response.statusText}\n${JSON.stringify(responseData, null, 2)}`);
      }

      return responseData.choices[0].message.content;
    } catch (error) {
      console.error('Error calling OpenAI:', error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  return { callOpenAI, isLoading };
};
