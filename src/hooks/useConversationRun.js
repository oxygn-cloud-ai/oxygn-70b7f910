import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useSupabase } from './useSupabase';
import { toast } from '@/components/ui/sonner';
import { useApiCallContext } from '@/contexts/ApiCallContext';
import { formatErrorForDisplay, isQuotaError } from '@/utils/apiErrorUtils';

export const useConversationRun = () => {
  const supabase = useSupabase();
  const { registerCall } = useApiCallContext();
  const [isRunning, setIsRunning] = useState(false);
  const [lastResponse, setLastResponse] = useState(null);
  const [progress, setProgress] = useState(null);
  const isMountedRef = useRef(true);
  const abortControllerRef = useRef(null);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      // Abort any in-flight requests on unmount
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  const safeSetState = useCallback((setter, value) => {
    if (isMountedRef.current) setter(value);
  }, []);

  // Cancel any in-flight request
  const cancelRun = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    safeSetState(setIsRunning, false);
    safeSetState(setProgress, null);
  }, [safeSetState]);

  // Parse SSE stream and return final result
  const parseSSEStream = useCallback(async (response, onProgress) => {
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let result = null;
    let error = null;

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        // Parse SSE events (data: {...}\n\n)
        const lines = buffer.split('\n');
        buffer = lines.pop() || ''; // Keep incomplete line in buffer

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6).trim();
            if (data === '[DONE]') continue;

            try {
              const event = JSON.parse(data);
              
              // Handle different event types
              if (event.type === 'heartbeat') {
                onProgress?.({ type: 'heartbeat', elapsed_ms: event.elapsed_ms });
              } else if (event.type === 'progress') {
                onProgress?.(event);
              } else if (event.type === 'started') {
                onProgress?.({ type: 'started', prompt_row_id: event.prompt_row_id });
              } else if (event.type === 'complete') {
                result = event;
                onProgress?.({ type: 'complete', elapsed_ms: event.elapsed_ms });
              } else if (event.type === 'error') {
                error = event;
                onProgress?.({ type: 'error', error: event.error });
              }
            } catch (parseErr) {
              console.warn('Failed to parse SSE event:', data, parseErr);
            }
          }
        }
      }
    } catch (readErr) {
      // Handle abort
      if (readErr.name === 'AbortError') {
        throw new Error('Request cancelled');
      }
      throw readErr;
    }

    if (error) {
      const err = new Error(error.error || 'Edge Function call failed');
      err.error_code = error.error_code;
      err.prompt_name = error.prompt_name;
      if (error.retry_after_s) err.retry_after_s = error.retry_after_s;
      throw err;
    }

    return result;
  }, []);

  const runPrompt = useCallback(
    async (childPromptRowId, userMessage, templateVariables = {}, options = {}) => {
      if (!supabase || !childPromptRowId) return null;

      const { onSuccess, onProgress } = options;
      const unregisterCall = registerCall();

      // Create abort controller for this request
      abortControllerRef.current = new AbortController();

      safeSetState(setIsRunning, true);
      safeSetState(setProgress, { type: 'started' });

      try {
        // Get session for auth header
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.access_token) {
          throw new Error('Not authenticated');
        }

        // Make SSE request directly to edge function
        const response = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/conversation-run`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${session.access_token}`,
              'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
            },
            body: JSON.stringify({
              child_prompt_row_id: childPromptRowId,
              user_message: userMessage,
              template_variables: templateVariables,
            }),
            signal: abortControllerRef.current.signal,
          }
        );

        if (!response.ok) {
          const errorText = await response.text();
          let errorMessage = 'Edge Function call failed';
          try {
            const errorJson = JSON.parse(errorText);
            errorMessage = errorJson.error || errorMessage;
          } catch {
            errorMessage = errorText || errorMessage;
          }
          throw new Error(errorMessage);
        }

        // Parse SSE stream with progress callbacks
        const data = await parseSSEStream(response, (progressEvent) => {
          safeSetState(setProgress, progressEvent);
          onProgress?.(progressEvent);
        });

        if (!data) {
          throw new Error('No response received from edge function');
        }

        safeSetState(setLastResponse, data);

        // Dispatch event to refresh the UI for this prompt
        if (childPromptRowId) {
          window.dispatchEvent(new CustomEvent('prompt-result-updated', {
            detail: { promptRowId: childPromptRowId }
          }));
        }

        if (typeof onSuccess === 'function') {
          try {
            await onSuccess(data);
          } catch (e) {
            console.error('onSuccess callback error:', e);
          }
        }

        toast.success('Run completed');
        return data;
      } catch (error) {
        if (error.message === 'Request cancelled') {
          toast.info('Request cancelled');
          return null;
        }
        console.error('Error running conversation:', error);
        const formatted = formatErrorForDisplay(error, error.prompt_name);
        toast.error(formatted.title, {
          description: formatted.description,
          duration: isQuotaError(error) ? 10000 : 5000,
        });
        return null;
      } finally {
        abortControllerRef.current = null;
        unregisterCall();
        safeSetState(setIsRunning, false);
        safeSetState(setProgress, null);
      }
    },
    [parseSSEStream, registerCall, safeSetState, supabase]
  );

  const runConversation = useCallback(
    async ({
      conversationRowId,
      childPromptRowId,
      userMessage,
      threadMode,
      childThreadStrategy,
      existingThreadRowId,
      template_variables,
      onSuccess,
      onProgress,
    }) => {
      if (!supabase || !childPromptRowId) return { response: null };

      const unregisterCall = registerCall();

      // Create abort controller for this request
      abortControllerRef.current = new AbortController();

      safeSetState(setIsRunning, true);
      safeSetState(setProgress, { type: 'started' });

      try {
        // Get session for auth header
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.access_token) {
          throw new Error('Not authenticated');
        }

        // Make SSE request directly to edge function
        const response = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/conversation-run`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${session.access_token}`,
              'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
            },
            body: JSON.stringify({
              child_prompt_row_id: childPromptRowId,
              user_message: userMessage,
              thread_mode: threadMode,
              child_thread_strategy: childThreadStrategy,
              existing_thread_row_id: existingThreadRowId,
              template_variables: template_variables,
            }),
            signal: abortControllerRef.current.signal,
          }
        );

        if (!response.ok) {
          const errorText = await response.text();
          let errorMessage = 'Edge Function call failed';
          try {
            const errorJson = JSON.parse(errorText);
            errorMessage = errorJson.error || errorMessage;
          } catch {
            errorMessage = errorText || errorMessage;
          }
          throw new Error(errorMessage);
        }

        // Parse SSE stream with progress callbacks
        const data = await parseSSEStream(response, (progressEvent) => {
          safeSetState(setProgress, progressEvent);
          onProgress?.(progressEvent);
        });

        if (!data) {
          throw new Error('No response received from edge function');
        }

        safeSetState(setLastResponse, data);

        // Dispatch event to refresh the UI for this prompt
        if (childPromptRowId) {
          window.dispatchEvent(new CustomEvent('prompt-result-updated', {
            detail: { promptRowId: childPromptRowId }
          }));
        }

        if (typeof onSuccess === 'function') {
          try {
            await onSuccess(data);
          } catch (e) {
            console.error('onSuccess callback error:', e);
          }
        }

        return data;
      } catch (error) {
        if (error.message === 'Request cancelled') {
          return { response: null, cancelled: true };
        }
        console.error('Error running conversation:', error);
        throw error;
      } finally {
        abortControllerRef.current = null;
        unregisterCall();
        safeSetState(setIsRunning, false);
        safeSetState(setProgress, null);
      }
    },
    [parseSSEStream, registerCall, safeSetState, supabase]
  );

  return {
    runPrompt,
    runConversation,
    cancelRun,
    isRunning,
    lastResponse,
    progress,
  };
};
