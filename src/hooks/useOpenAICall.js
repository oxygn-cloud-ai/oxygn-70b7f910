import { useState, useCallback, useRef } from 'react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useApiCallContext } from '@/contexts/ApiCallContext';

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
  const { registerCall, addBackgroundCall, removeBackgroundCall } = useApiCallContext();
  const pendingCallRef = useRef(null);

  const handleApiError = (error) => {
    const errorMessage = error?.message || 'An unknown error occurred';
    const status = error?.status || 500;

    if (status >= 500) {
      toast.error('Server is temporarily unavailable. Please try again in a few moments.');
      console.error('Server error:', errorMessage);
      return { error: 'SERVER_ERROR' };
    }

    if (status === 429) {
      try {
        const errorBody = typeof error.body === 'string' ? JSON.parse(error.body) : error.body;
        if (errorBody?.error?.code === 'insufficient_quota') {
          toast.error('OpenAI API quota exceeded. Please check your billing details or try again later.');
          return { error: 'QUOTA_EXCEEDED' };
        }
      } catch (parseError) {
        console.error('Error parsing error response:', parseError);
      }
    }

    if (status === 400) {
      try {
        const errorBody = typeof error.body === 'string' ? JSON.parse(error.body) : error.body;
        if (errorBody?.error?.code === 'context_length_exceeded') {
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

  const callOpenAI = useCallback(async (systemMessage, userMessage, projectSettings, options = {}) => {
    const { onSuccess, rowId, fieldName } = options;
    
    setIsLoading(true);
    
    // Register this call with the context
    const unregisterCall = registerCall();

    try {
      if (!userMessage || userMessage.trim() === '') {
        throw new Error('User message cannot be empty.');
      }

      const systemTokens = estimateTokenCount(systemMessage || '');
      const userTokens = estimateTokenCount(userMessage);
      const totalInputTokens = systemTokens + userTokens;

      let finalSystemMessage = systemMessage || '';
      let finalUserMessage = userMessage;

      if (totalInputTokens > MAX_TOKENS) {
        const availableTokens = MAX_TOKENS;
        const systemRatio = systemTokens / totalInputTokens;
        const userRatio = userTokens / totalInputTokens;

        finalSystemMessage = truncateText(finalSystemMessage, Math.floor(availableTokens * systemRatio));
        finalUserMessage = truncateText(finalUserMessage, Math.floor(availableTokens * userRatio));

        toast.warning('Input text was truncated to fit within model limits.');
      }

      let temperature = 0.7;
      if (projectSettings?.temperature_on && projectSettings?.temperature !== undefined) {
        const parsedTemp = parseFloat(projectSettings.temperature);
        if (!isNaN(parsedTemp) && parsedTemp >= 0 && parsedTemp <= 2) {
          temperature = parsedTemp;
        }
      }

      const requestBody = {
        action: 'chat',
        model: projectSettings?.model || 'gpt-4o-mini',
        messages: [
          { role: 'system', content: finalSystemMessage },
          { role: 'user', content: finalUserMessage.trim() },
        ],
        temperature,
      };

      // Add web search if enabled
      if (projectSettings?.web_search_on) {
        requestBody.web_search_enabled = true;
      }

      // Add max_tokens if response_tokens is enabled
      if (projectSettings?.response_tokens_on && projectSettings?.response_tokens) {
        const maxTokens = parseInt(projectSettings.response_tokens);
        if (!isNaN(maxTokens) && maxTokens > 0) {
          requestBody.max_tokens = maxTokens;
        }
      } else if (projectSettings?.max_tokens_on && projectSettings?.max_tokens) {
        const maxTokens = parseInt(projectSettings.max_tokens);
        if (!isNaN(maxTokens) && maxTokens > 0) {
          requestBody.max_tokens = maxTokens;
        }
      }

      // Add top_p if enabled
      if (projectSettings?.top_p_on && projectSettings?.top_p) {
        const topP = parseFloat(projectSettings.top_p);
        if (!isNaN(topP) && topP >= 0 && topP <= 1) {
          requestBody.top_p = topP;
        }
      }

      // Add other conditional parameters
      if (projectSettings?.frequency_penalty_on) {
        requestBody.frequency_penalty = parseFloat(projectSettings.frequency_penalty) || 0;
      }
      if (projectSettings?.presence_penalty_on) {
        requestBody.presence_penalty = parseFloat(projectSettings.presence_penalty) || 0;
      }

      console.log('OpenAI request body:', { 
        model: requestBody.model, 
        webSearchEnabled: requestBody.web_search_enabled 
      });

      const { data, error } = await supabase.functions.invoke('openai-proxy', {
        body: requestBody,
      });

      if (error) {
        const e = new Error(error.message || 'OpenAI proxy error');
        e.status = error.status || error.context?.status || 500;
        e.body = error.context?.body;
        throw e;
      }

      const content = data?.choices?.[0]?.message?.content;
      if (!content) {
        throw new Error('Empty response from OpenAI');
      }

      // Call success callback if provided (for background completion)
      if (onSuccess) {
        await onSuccess(content);
      }

      return content;
    } catch (error) {
      handleApiError(error);
      return null;
    } finally {
      unregisterCall();
      setIsLoading(false);
    }
  }, [registerCall]);

  // Version that supports background completion with database update
  const callOpenAIWithSave = useCallback(async (systemMessage, userMessage, projectSettings, saveConfig) => {
    const { supabaseClient, tableName, rowId, fieldName, onLocalUpdate } = saveConfig;
    
    const backgroundCallId = addBackgroundCall({
      type: 'openai',
      rowId,
      fieldName,
      startedAt: new Date(),
    });

    try {
      const content = await callOpenAI(systemMessage, userMessage, projectSettings, {
        onSuccess: async (result) => {
          // Save to database
          if (supabaseClient && tableName && rowId && fieldName) {
            const { error } = await supabaseClient
              .from(tableName)
              .update({ [fieldName]: result })
              .eq('row_id', rowId);
            
            if (error) {
              console.error('Failed to save API result:', error);
              toast.error('Failed to save API response');
            } else {
              toast.success('API response saved successfully');
              // Update local state if callback provided
              if (onLocalUpdate) {
                onLocalUpdate(result);
              }
            }
          }
        },
        rowId,
        fieldName,
      });

      return content;
    } finally {
      removeBackgroundCall(backgroundCallId);
    }
  }, [callOpenAI, addBackgroundCall, removeBackgroundCall]);

  return { callOpenAI, callOpenAIWithSave, isLoading };
};
