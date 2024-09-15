import { useState } from 'react';
import { useSettings } from './useSettings';
import { toast } from 'sonner';

export const useOpenAICall = () => {
  const [isLoading, setIsLoading] = useState(false);
  const { settings } = useSettings();

  const callOpenAI = async (systemMessage, userMessage, projectSettings) => {
    setIsLoading(true);
    try {
      if (!settings || !settings.openai_url || !settings.openai_api_key) {
        throw new Error('OpenAI settings are not configured');
      }

      const apiUrl = settings.openai_url.replace(/\/$/, '');

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

      console.log('OpenAI API Call Details:');
      console.log('URL:', apiUrl);
      console.log('Headers:', {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${settings.openai_api_key.substring(0, 5)}...`
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

      if (!response.ok) {
        const errorData = await response.json();
        console.error('OpenAI API Error:', errorData);
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
  };

  return { callOpenAI, isLoading };
};
