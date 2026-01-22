import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from '@/components/ui/sonner';
import { supabase } from '@/integrations/supabase/client';
import { useApiCallContext } from '@/contexts/ApiCallContext';
import { trackEvent, trackException, trackApiError } from '@/lib/posthog';

const MAX_TOKENS = 16000;
const ESTIMATED_TOKENS_PER_CHAR = 0.4;

const estimateTokenCount = (text: string): number => Math.ceil(text.length * ESTIMATED_TOKENS_PER_CHAR);

const truncateText = (text: string, maxTokens: number): string => {
  const estimatedMaxChars = Math.floor(maxTokens / ESTIMATED_TOKENS_PER_CHAR);
  return text.slice(0, estimatedMaxChars);
};

export interface ProjectSettings {
  model?: string | null;
  temperature?: number | string | null;
  temperature_on?: boolean | null;
  max_tokens?: number | string | null;
  max_tokens_on?: boolean | null;
  max_completion_tokens?: number | string | null;
  max_completion_tokens_on?: boolean | null;
  response_tokens?: number | string | null;
  response_tokens_on?: boolean | null;
  top_p?: number | string | null;
  top_p_on?: boolean | null;
  frequency_penalty?: number | string | null;
  frequency_penalty_on?: boolean | null;
  presence_penalty?: number | string | null;
  presence_penalty_on?: boolean | null;
  web_search_on?: boolean | null;
  [key: string]: unknown;
}

export interface SaveConfig {
  supabaseClient: typeof supabase;
  tableName: string;
  rowId: string;
  fieldName: string;
  onLocalUpdate?: (result: string) => void;
}

export interface CallOpenAIOptions {
  onSuccess?: (content: string, data: OpenAIResponseData) => Promise<void>;
}

export interface OpenAIResponseData {
  choices?: Array<{
    message?: {
      content?: string;
    };
  }>;
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    total_tokens?: number;
  };
  [key: string]: unknown;
}

interface ApiError extends Error {
  status?: number;
  body?: unknown;
}

export interface UseOpenAICallReturn {
  callOpenAI: (
    systemMessage: string,
    userMessage: string,
    projectSettings: ProjectSettings,
    options?: CallOpenAIOptions
  ) => Promise<string | null>;
  callOpenAIWithSave: (
    systemMessage: string,
    userMessage: string,
    projectSettings: ProjectSettings,
    saveConfig: SaveConfig
  ) => Promise<string | null>;
  isLoading: boolean;
}

export const useOpenAICall = (): UseOpenAICallReturn => {
  const [isLoading, setIsLoading] = useState(false);
  const { registerCall, addBackgroundCall, removeBackgroundCall } = useApiCallContext();
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const setLoadingSafe = useCallback((value: boolean) => {
    if (isMountedRef.current) setIsLoading(value);
  }, []);

  const handleApiError = useCallback((error: ApiError): { error: string } => {
    const errorMessage = error?.message || 'An unknown error occurred';
    const status = error?.status || 500;

    if (status >= 500) {
      toast.error('Server is temporarily unavailable. Please try again.');
      console.error('Server error:', errorMessage);
      return { error: 'SERVER_ERROR' };
    }

    if (status === 429) {
      try {
        const errorBody = typeof error.body === 'string' ? JSON.parse(error.body) : error.body;
        if ((errorBody as { error?: { code?: string } })?.error?.code === 'insufficient_quota') {
          toast.error('OpenAI API quota exceeded.');
          return { error: 'QUOTA_EXCEEDED' };
        }
      } catch {
        // Ignore parse errors
      }
    }

    if (status === 400) {
      try {
        const errorBody = typeof error.body === 'string' ? JSON.parse(error.body) : error.body;
        if ((errorBody as { error?: { code?: string } })?.error?.code === 'context_length_exceeded') {
          toast.error('Input text too long. It will be truncated.');
          return { error: 'CONTEXT_LENGTH_EXCEEDED' };
        }
      } catch {
        // Ignore parse errors
      }
    }

    toast.error(`API error: ${errorMessage}`);
    return { error: 'API_ERROR' };
  }, []);

  /**
   * Call OpenAI with optional onSuccess callback for background completion.
   */
  const callOpenAI = useCallback(
    async (
      systemMessage: string,
      userMessage: string,
      projectSettings: ProjectSettings,
      options: CallOpenAIOptions = {}
    ): Promise<string | null> => {
      const unregisterCall = registerCall();
      setLoadingSafe(true);

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
          const parsedTemp = parseFloat(String(projectSettings.temperature));
          if (!isNaN(parsedTemp) && parsedTemp >= 0 && parsedTemp <= 2) {
            temperature = parsedTemp;
          }
        }

        const requestBody: Record<string, unknown> = {
          action: 'chat',
          model: projectSettings?.model || null,
          messages: [
            { role: 'system', content: finalSystemMessage },
            { role: 'user', content: finalUserMessage.trim() },
          ],
          temperature,
        };

        if (projectSettings?.web_search_on) {
          requestBody.web_search_enabled = true;
        }

        // STRICT SEPARATION: Send ONLY the appropriate token param based on model class
        const isGpt5Class = (projectSettings?.model || '').match(/^(gpt-5|o\d)/i);
        
        if (isGpt5Class) {
          // GPT-5/o-series: ONLY use max_completion_tokens
          if (projectSettings?.max_completion_tokens_on && projectSettings?.max_completion_tokens) {
            const maxCompletionTokens = parseInt(String(projectSettings.max_completion_tokens));
            if (!isNaN(maxCompletionTokens) && maxCompletionTokens > 0) {
              requestBody.max_completion_tokens = maxCompletionTokens;
            }
          }
        } else {
          // GPT-4 and earlier: ONLY use max_tokens
          if (projectSettings?.response_tokens_on && projectSettings?.response_tokens) {
            const maxTokens = parseInt(String(projectSettings.response_tokens));
            if (!isNaN(maxTokens) && maxTokens > 0) {
              requestBody.max_tokens = maxTokens;
            }
          } else if (projectSettings?.max_tokens_on && projectSettings?.max_tokens) {
            const maxTokens = parseInt(String(projectSettings.max_tokens));
            if (!isNaN(maxTokens) && maxTokens > 0) {
              requestBody.max_tokens = maxTokens;
            }
          }
        }

        if (projectSettings?.top_p_on && projectSettings?.top_p) {
          const topP = parseFloat(String(projectSettings.top_p));
          if (!isNaN(topP) && topP >= 0 && topP <= 1) {
            requestBody.top_p = topP;
          }
        }

        if (projectSettings?.frequency_penalty_on) {
          requestBody.frequency_penalty = parseFloat(String(projectSettings.frequency_penalty)) || 0;
        }
        if (projectSettings?.presence_penalty_on) {
          requestBody.presence_penalty = parseFloat(String(projectSettings.presence_penalty)) || 0;
        }

        console.log('AI request:', { model: requestBody.model, webSearch: requestBody.web_search_enabled });

        const { data, error } = await supabase.functions.invoke('openai-proxy', {
          body: requestBody,
        });

        if (error) {
          const e: ApiError = new Error(error.message || 'AI proxy error');
          e.status = error.status || (error as { context?: { status?: number } }).context?.status || 500;
          e.body = (error as { context?: { body?: unknown } }).context?.body;
          throw e;
        }

        const responseData = data as OpenAIResponseData;
        const content = responseData?.choices?.[0]?.message?.content;
        if (!content) {
          throw new Error('Empty response from AI');
        }

        // Track AI call success
        trackEvent('ai_call_completed', {
          model: requestBody.model,
          input_tokens: responseData?.usage?.prompt_tokens,
          output_tokens: responseData?.usage?.completion_tokens,
          web_search: requestBody.web_search_enabled || false,
        });

        // Run success callback with content and full response data (for cost tracking)
        if (typeof options?.onSuccess === 'function') {
          try {
            await options.onSuccess(content, responseData);
          } catch (e) {
            console.error('onSuccess callback error:', e);
          }
        }

        return content;
      } catch (error) {
        handleApiError(error as ApiError);
        trackApiError('openai-proxy', error, {
          model: projectSettings?.model,
          status_code: (error as ApiError)?.status
        });
        trackException(error, { context: 'openai_call' });
        return null;
      } finally {
        unregisterCall();
        setLoadingSafe(false);
      }
    },
    [registerCall, setLoadingSafe, handleApiError]
  );

  /**
   * Call OpenAI and save result to database (supports background completion).
   */
  const callOpenAIWithSave = useCallback(
    async (
      systemMessage: string,
      userMessage: string,
      projectSettings: ProjectSettings,
      saveConfig: SaveConfig
    ): Promise<string | null> => {
      const { supabaseClient, tableName, rowId, fieldName, onLocalUpdate } = saveConfig || {};

      const backgroundCallId = addBackgroundCall({
        type: 'openai',
        rowId,
        fieldName,
        startedAt: new Date(),
      });

      try {
        const content = await callOpenAI(systemMessage, userMessage, projectSettings, {
          onSuccess: async (result) => {
            if (!supabaseClient || !tableName || !rowId || !fieldName) return;

            const { error } = await supabaseClient
              .from(tableName)
              .update({ [fieldName]: result })
              .eq('row_id', rowId);

            if (error) {
              console.error('Failed to save API result:', error);
              toast.error('Failed to save API response');
              return;
            }

            toast.success('Response saved');
            if (typeof onLocalUpdate === 'function' && isMountedRef.current) {
              onLocalUpdate(result);
            }
          },
        });

        return content;
      } finally {
        removeBackgroundCall(backgroundCallId);
      }
    },
    [addBackgroundCall, callOpenAI, removeBackgroundCall]
  );

  return { callOpenAI, callOpenAIWithSave, isLoading };
};

export default useOpenAICall;
