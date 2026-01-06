import { useCallback, useEffect, useRef, useState } from 'react';
import { useSupabase } from './useSupabase';
import { toast } from '@/components/ui/sonner';
import { useApiCallContext } from '@/contexts/ApiCallContext';
import { useLiveApiDashboard } from '@/contexts/LiveApiDashboardContext';
import { formatErrorForDisplay, isQuotaError } from '@/utils/apiErrorUtils';
import { trackEvent, trackException, trackApiError } from '@/lib/posthog';
import logger from '@/utils/logger';
import { estimateRequestTokens, getModelContextWindow } from '@/utils/tokenizer';
import { estimateCost } from '@/utils/costEstimator';

export const useConversationRun = () => {
  const supabase = useSupabase();
  const { registerCall } = useApiCallContext();
  const { addCall, updateCall, appendThinking, incrementOutputTokens, removeCall } = useLiveApiDashboard();
  const [isRunning, setIsRunning] = useState(false);
  const [lastResponse, setLastResponse] = useState(null);
  const [progress, setProgress] = useState(null);
  const isMountedRef = useRef(true);
  const abortControllerRef = useRef(null);
  
  // Store the current response_id for true OpenAI cancellation
  const currentResponseIdRef = useRef(null);

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

  // Cancel any in-flight request - now calls OpenAI cancel endpoint
  const cancelRun = useCallback(async () => {
    // Step 1: Capture and clear response_id FIRST to prevent race conditions
    const responseId = currentResponseIdRef.current;
    currentResponseIdRef.current = null;
    
    // Step 2: Abort client stream immediately (instant UX feedback)
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    
    // Step 3: Call OpenAI cancel endpoint if we have a response_id
    if (responseId && supabase) {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.access_token) {
          logger.debug('Cancelling OpenAI response:', responseId);
          const { data, error } = await supabase.functions.invoke('conversation-cancel', {
            body: { response_id: responseId }
          });
          
          if (error) {
            console.warn('Cancel request failed:', error);
            toast.warning('Request stopped locally', {
              description: 'Server cancellation failed - generation may continue briefly',
            });
          } else if (data?.status === 'completed') {
            // Response finished before cancel took effect
            toast.info('Request already completed');
          } else if (data?.success) {
            logger.debug('OpenAI response cancelled:', responseId);
          }
        }
      } catch (e) {
        console.warn('Cancel request error:', e);
        toast.warning('Request stopped locally', {
          description: 'Could not confirm server cancellation',
        });
      }
    }
    
    // Step 4: Reset state
    safeSetState(setIsRunning, false);
    safeSetState(setProgress, null);
  }, [safeSetState, supabase]);

  // Parse SSE stream and return final result
  const parseSSEStream = useCallback(async (response, onProgress) => {
    if (!response?.body) {
      throw new Error('No response body received from edge function');
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();

    let buffer = '';
    let result = null;
    let error = null;
    let doneReceived = false;

    const handleLine = (rawLine) => {
      let line = rawLine;
      if (line.endsWith('\r')) line = line.slice(0, -1);
      if (!line || line.trim() === '' || line.startsWith(':')) return;

      if (!line.startsWith('data:')) return;

      const data = line.replace(/^data:\s?/, '').trim();
      if (!data) return;

      if (data === '[DONE]') {
        doneReceived = true;
        return;
      }

      try {
        const event = JSON.parse(data);

        if (event.type === 'heartbeat') {
          onProgress?.({ type: 'heartbeat', elapsed_ms: event.elapsed_ms });
        } else if (event.type === 'progress') {
          onProgress?.(event);
        } else if (event.type === 'started') {
          onProgress?.({ type: 'started', prompt_row_id: event.prompt_row_id });
        } else if (event.type === 'api_started') {
          // Store response_id for cancellation support
          if (event.response_id) {
            currentResponseIdRef.current = event.response_id;
            logger.debug('Stored response_id for cancellation:', event.response_id);
          }
          onProgress?.({ type: 'api_started', response_id: event.response_id, status: event.status });
        } else if (event.type === 'status_update') {
          // NEW: Handle status updates for dashboard
          onProgress?.({ type: 'status_update', status: event.status });
        } else if (event.type === 'thinking_started') {
          // NEW: Handle reasoning/thinking started
          onProgress?.({ type: 'thinking_started', item_id: event.item_id });
        } else if (event.type === 'thinking_delta') {
          // NEW: Handle streaming reasoning text
          onProgress?.({ type: 'thinking_delta', delta: event.delta, item_id: event.item_id });
        } else if (event.type === 'thinking_done') {
          // NEW: Handle reasoning complete
          onProgress?.({ type: 'thinking_done', text: event.text, item_id: event.item_id });
        } else if (event.type === 'complete') {
          result = event;
          onProgress?.(event);
          // Clear response_id on completion
          currentResponseIdRef.current = null;
        } else if (event.type === 'error') {
          error = event;
          onProgress?.({ type: 'error', error: event.error });
          // Clear response_id on error
          currentResponseIdRef.current = null;
        }
      } catch (parseErr) {
        // If parsing fails, keep going; stream may contain non-JSON data lines.
        logger.warn('Failed to parse SSE event:', data, parseErr);
      }
    };

    try {
      while (!doneReceived) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        let newlineIndex;
        while ((newlineIndex = buffer.indexOf('\n')) !== -1) {
          const line = buffer.slice(0, newlineIndex);
          buffer = buffer.slice(newlineIndex + 1);
          handleLine(line);
          if (error || doneReceived) break;
        }

        if (error) break;
      }
    } catch (readErr) {
      if (readErr?.name === 'AbortError') {
        throw new Error('Request cancelled');
      }
      throw readErr;
    }

    // Final flush: handle last line(s) that may not end with a newline
    if (!error && buffer.trim()) {
      for (const raw of buffer.split('\n')) {
        handleLine(raw);
        if (error) break;
      }
    }

    if (error) {
      // Check if this was a cancellation
      if (error.error_code === 'CANCELLED') {
        return { response: null, cancelled: true };
      }
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
      // Reset response_id
      currentResponseIdRef.current = null;
      
      // Create per-call cancel function with captured refs
      const callResponseIdRef = { current: null };
      const cancelThisCall = async () => {
        const responseId = callResponseIdRef.current;
        abortControllerRef.current?.abort();
        if (responseId && supabase) {
          try {
            const { data: { session } } = await supabase.auth.getSession();
            if (session?.access_token) {
              await supabase.functions.invoke('conversation-cancel', {
                body: { response_id: responseId }
              });
            }
          } catch (e) {
            console.warn('Cancel call failed:', e);
          }
        }
      };
      
      // Estimate input tokens for dashboard
      const estimatedInputTokens = estimateRequestTokens({
        systemPrompt: options.systemPrompt || '',
        userMessage: userMessage || '',
      });
      const contextWindow = getModelContextWindow(options.model);
      
      // Register with LiveApiDashboard
      const dashboardCallId = addCall({
        promptName: options.promptName || 'Running...',
        promptRowId: childPromptRowId,
        model: options.model || 'loading...',
        cancelFn: cancelThisCall,
        isCascadeCall: options.isCascadeCall || false,
        estimatedInputTokens,
        contextWindow,
      });

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
              store_in_history: false,
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

        // Parse SSE stream with progress callbacks - integrate with dashboard
        const data = await parseSSEStream(response, (progressEvent) => {
          safeSetState(setProgress, progressEvent);
          onProgress?.(progressEvent);
          
          // Update dashboard based on event type
          if (progressEvent.type === 'api_started') {
            callResponseIdRef.current = progressEvent.response_id;
            updateCall(dashboardCallId, { 
              status: 'in_progress',
              responseId: progressEvent.response_id,
            });
          } else if (progressEvent.type === 'status_update') {
            updateCall(dashboardCallId, { status: progressEvent.status });
          } else if (progressEvent.type === 'thinking_delta') {
            appendThinking(dashboardCallId, progressEvent.delta);
          } else if (progressEvent.type === 'text_delta') {
            // Increment output tokens (rough estimate: 1 token per ~4 chars)
            const tokenDelta = Math.ceil((progressEvent.delta?.length || 0) / 4);
            if (tokenDelta > 0) {
              incrementOutputTokens(dashboardCallId, tokenDelta);
            }
          } else if (progressEvent.type === 'usage_delta') {
            // Direct usage update from server
            if (progressEvent.output_tokens) {
              incrementOutputTokens(dashboardCallId, progressEvent.output_tokens);
            }
          }
        });

        if (!data) {
          throw new Error('No response received from edge function');
        }
        
        // Handle cancellation response
        if (data.cancelled) {
          toast.info('Request cancelled', {
            source: 'useConversationRun.runPrompt',
          });
          return null;
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

        // Include API response metadata and request params in success toast
        toast.success('Run completed', {
          source: 'useConversationRun.runPrompt',
          details: JSON.stringify({
            // Summary
            promptName: data?.child_prompt_name,
            model: data?.model,
            elapsedMs: data?.elapsed_ms,
            
            // Usage
            usage: data?.usage,
            
            // All API request parameters
            apiRequest: data?.request_params,
            
            // IDs for debugging
            promptRowId: childPromptRowId,
            responseId: data?.response_id,
          }, null, 2),
        });
        
        // Track prompt run success
        trackEvent('prompt_run', {
          prompt_id: childPromptRowId,
          prompt_name: data?.child_prompt_name,
          model: data?.model,
          tokens_input: data?.usage?.input_tokens,
          tokens_output: data?.usage?.output_tokens,
          elapsed_ms: data?.elapsed_ms,
          success: true,
        });
        
        return data;
      } catch (error) {
        if (error.message === 'Request cancelled') {
          toast.info('Request cancelled', {
            source: 'useConversationRun.runPrompt',
          });
          return null;
        }
        console.error('Error running conversation:', error);
        const formatted = formatErrorForDisplay(error, error.prompt_name);
        toast.error(formatted.title, {
          description: formatted.description,
          duration: isQuotaError(error) ? 10000 : 5000,
          source: 'useConversationRun.runPrompt',
          errorCode: formatted.code,
          details: JSON.stringify({
            // Error info
            errorMessage: error.message,
            errorCode: error.error_code,
            retryAfter: error.retry_after_s,
            
            // Context
            promptRowId: childPromptRowId,
            promptName: error.prompt_name,
            
            // API request params (if available from error)
            apiRequest: error.requestParams,
            
            // Stack trace (first 5 lines)
            stack: error.stack?.split?.('\n')?.slice?.(0, 5)?.join?.('\n'),
          }, null, 2),
        });
        
        // Track prompt run error
        trackEvent('prompt_run', {
          prompt_id: childPromptRowId,
          success: false,
          error_code: formatted.code,
          error_message: error.message,
        });
        trackApiError('conversation-run', error, {
          prompt_id: childPromptRowId,
          error_code: formatted.code,
        });
        trackException(error, {
          context: 'conversation_run',
          prompt_id: childPromptRowId,
        });
        
        return null;
      } finally {
        // Remove from dashboard
        removeCall(dashboardCallId);
        abortControllerRef.current = null;
        currentResponseIdRef.current = null;
        unregisterCall();
        safeSetState(setIsRunning, false);
        safeSetState(setProgress, null);
      }
    },
    [parseSSEStream, registerCall, safeSetState, supabase, addCall, updateCall, appendThinking, incrementOutputTokens, removeCall]
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
      store_in_history = true,
      onSuccess,
      onProgress,
      // Dashboard options
      promptName,
      model,
      isCascadeCall = false,
    }) => {
      if (!supabase || !childPromptRowId) return { response: null };

      const unregisterCall = registerCall();

      // Create abort controller for this request
      abortControllerRef.current = new AbortController();
      // Reset response_id
      currentResponseIdRef.current = null;
      
      // Create per-call cancel function with captured refs
      const callResponseIdRef = { current: null };
      const cancelThisCall = async () => {
        const responseId = callResponseIdRef.current;
        abortControllerRef.current?.abort();
        if (responseId && supabase) {
          try {
            const { data: { session } } = await supabase.auth.getSession();
            if (session?.access_token) {
              await supabase.functions.invoke('conversation-cancel', {
                body: { response_id: responseId }
              });
            }
          } catch (e) {
            console.warn('Cancel call failed:', e);
          }
        }
      };
      
      // Estimate input tokens for dashboard
      const estimatedInputTokens = estimateRequestTokens({
        userMessage: userMessage || '',
      });
      const contextWindow = getModelContextWindow(model);
      
      // Register with LiveApiDashboard
      const dashboardCallId = addCall({
        promptName: promptName || 'Running...',
        promptRowId: childPromptRowId,
        model: model || 'loading...',
        cancelFn: cancelThisCall,
        isCascadeCall,
        estimatedInputTokens,
        contextWindow,
      });

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
              store_in_history: store_in_history,
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

        // Parse SSE stream with progress callbacks - integrate with dashboard
        const data = await parseSSEStream(response, (progressEvent) => {
          safeSetState(setProgress, progressEvent);
          onProgress?.(progressEvent);
          
          // Update dashboard based on event type
          if (progressEvent.type === 'api_started') {
            callResponseIdRef.current = progressEvent.response_id;
            updateCall(dashboardCallId, { 
              status: 'in_progress',
              responseId: progressEvent.response_id,
            });
          } else if (progressEvent.type === 'status_update') {
            updateCall(dashboardCallId, { status: progressEvent.status });
          } else if (progressEvent.type === 'thinking_delta') {
            appendThinking(dashboardCallId, progressEvent.delta);
          } else if (progressEvent.type === 'text_delta') {
            // Increment output tokens (rough estimate: 1 token per ~4 chars)
            const tokenDelta = Math.ceil((progressEvent.delta?.length || 0) / 4);
            if (tokenDelta > 0) {
              incrementOutputTokens(dashboardCallId, tokenDelta);
            }
          } else if (progressEvent.type === 'usage_delta') {
            // Direct usage update from server
            if (progressEvent.output_tokens) {
              incrementOutputTokens(dashboardCallId, progressEvent.output_tokens);
            }
          }
        });

        if (!data) {
          throw new Error('No response received from edge function');
        }
        
        // Handle cancellation response
        if (data.cancelled) {
          return { response: null, cancelled: true };
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
        // Remove from dashboard
        removeCall(dashboardCallId);
        abortControllerRef.current = null;
        currentResponseIdRef.current = null;
        unregisterCall();
        safeSetState(setIsRunning, false);
        safeSetState(setProgress, null);
      }
    },
    [parseSSEStream, registerCall, safeSetState, supabase, addCall, updateCall, appendThinking, incrementOutputTokens, removeCall]
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
