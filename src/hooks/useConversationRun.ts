import { useCallback, useEffect, useRef, useState } from 'react';
import { useSupabase } from './useSupabase';
import { toast } from '@/components/ui/sonner';
import { useApiCallContext } from '@/contexts/ApiCallContext';
import { useLiveApiDashboard } from '@/contexts/LiveApiDashboardContext';
import { formatErrorForDisplay, isQuotaError } from '@/utils/apiErrorUtils';
import { trackEvent, trackException, trackApiError } from '@/lib/posthog';
import logger from '@/utils/logger';
import { estimateRequestTokens, getModelContextWindow } from '@/utils/tokenizer';

// ============================================================================
// Types
// ============================================================================

export interface SSEProgressEvent {
  type: string;
  elapsed_ms?: number;
  prompt_row_id?: string;
  response_id?: string;
  status?: string;
  settings?: Record<string, unknown>;
  tools?: unknown[];
  item_id?: string;
  delta?: string;
  text?: string;
  output_tokens?: number;
  variable_name?: string;
  question?: string;
  description?: string;
  call_id?: string;
  error?: string;
  error_code?: string;
  [key: string]: unknown;
}

export interface PromptRunOptions {
  onSuccess?: (data: ConversationRunResult) => Promise<void> | void;
  onProgress?: (event: SSEProgressEvent) => void;
  promptName?: string;
  model?: string;
  systemPrompt?: string;
  isCascadeCall?: boolean;
  resumeResponseId?: string;
  resumeAnswer?: string;
  resumeVariableName?: string;
  resumeCallId?: string;
}

export interface ConversationRunOptions {
  conversationRowId?: string;
  childPromptRowId: string;
  userMessage: string;
  threadMode?: string;
  childThreadStrategy?: string;
  existingThreadRowId?: string;
  template_variables?: Record<string, unknown>;
  store_in_history?: boolean;
  onSuccess?: (data: ConversationRunResult) => Promise<void> | void;
  onProgress?: (event: SSEProgressEvent) => void;
  promptName?: string;
  model?: string;
  isCascadeCall?: boolean;
  resumeResponseId?: string;
  resumeAnswer?: string;
  resumeVariableName?: string;
  resumeCallId?: string;
}

export interface ConversationRunResult {
  response?: string | null;
  child_prompt_name?: string;
  model?: string;
  elapsed_ms?: number;
  usage?: {
    input_tokens?: number;
    output_tokens?: number;
    total_tokens?: number;
  };
  response_id?: string;
  request_params?: Record<string, unknown>;
  cancelled?: boolean;
  interrupted?: boolean;
  interruptType?: string;
  interruptData?: {
    variableName?: string;
    question?: string;
    description?: string;
    callId?: string;
    responseId?: string;
  };
  [key: string]: unknown;
}

export interface UseConversationRunReturn {
  runPrompt: (
    childPromptRowId: string,
    userMessage: string,
    templateVariables?: Record<string, unknown>,
    options?: PromptRunOptions
  ) => Promise<ConversationRunResult | null>;
  runConversation: (options: ConversationRunOptions) => Promise<ConversationRunResult>;
  cancelRun: () => Promise<void>;
  isRunning: boolean;
  lastResponse: ConversationRunResult | null;
  progress: SSEProgressEvent | null;
}

// ============================================================================
// Hook Implementation
// ============================================================================

export const useConversationRun = (): UseConversationRunReturn => {
  const supabase = useSupabase();
  const { registerCall } = useApiCallContext();
  const { 
    addCall, 
    updateCall, 
    updateResolvedSettings, 
    appendThinking, 
    appendOutputText, 
    incrementOutputTokens, 
    removeCall 
  } = useLiveApiDashboard();
  
  const [isRunning, setIsRunning] = useState(false);
  const [lastResponse, setLastResponse] = useState<ConversationRunResult | null>(null);
  const [progress, setProgress] = useState<SSEProgressEvent | null>(null);
  const isMountedRef = useRef(true);
  const abortControllerRef = useRef<AbortController | null>(null);
  
  // Store the current response_id for true OpenAI cancellation
  const currentResponseIdRef = useRef<string | null>(null);

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

  const safeSetState = useCallback(<T>(setter: React.Dispatch<React.SetStateAction<T>>, value: T): void => {
    if (isMountedRef.current) setter(value);
  }, []);

  // Cancel any in-flight request - now calls OpenAI cancel endpoint
  const cancelRun = useCallback(async (): Promise<void> => {
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
  const parseSSEStream = useCallback(async (
    response: Response,
    onProgress?: (event: SSEProgressEvent) => void
  ): Promise<ConversationRunResult | null> => {
    if (!response?.body) {
      throw new Error('No response body received from edge function');
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();

    let buffer = '';
    let result: ConversationRunResult | null = null;
    let error: SSEProgressEvent | null = null;
    let doneReceived = false;

    const handleLine = (rawLine: string): void => {
      let line = rawLine;
      if (line.endsWith('\\r')) line = line.slice(0, -1);
      if (!line || line.trim() === '' || line.startsWith(':')) return;

      if (!line.startsWith('data:')) return;

      const data = line.replace(/^data:\s?/, '').trim();
      if (!data) return;

      if (data === '[DONE]') {
        doneReceived = true;
        return;
      }

      try {
        const event = JSON.parse(data) as SSEProgressEvent;

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
        } else if (event.type === 'settings_resolved') {
          onProgress?.({ type: 'settings_resolved', settings: event.settings, tools: event.tools });
        } else if (event.type === 'status_update') {
          onProgress?.({ type: 'status_update', status: event.status });
        } else if (event.type === 'thinking_started') {
          onProgress?.({ type: 'thinking_started', item_id: event.item_id });
        } else if (event.type === 'thinking_delta') {
          onProgress?.({ type: 'thinking_delta', delta: event.delta, item_id: event.item_id });
        } else if (event.type === 'thinking_done') {
          onProgress?.({ type: 'thinking_done', text: event.text, item_id: event.item_id });
        } else if (event.type === 'output_text_delta') {
          onProgress?.({ type: 'output_text_delta', delta: event.delta, item_id: event.item_id });
        } else if (event.type === 'output_text_done') {
          onProgress?.({ type: 'output_text_done', text: event.text, item_id: event.item_id });
        } else if (event.type === 'complete') {
          result = event as unknown as ConversationRunResult;
          onProgress?.(event);
          // Clear response_id on completion
          currentResponseIdRef.current = null;
        } else if (event.type === 'user_input_required') {
          // Question prompt interrupt - return special result
          result = {
            interrupted: true,
            interruptType: 'question',
            interruptData: {
              variableName: event.variable_name,
              question: event.question,
              description: event.description,
              callId: event.call_id,
              responseId: event.response_id,
            }
          };
          onProgress?.({ type: 'user_input_required', ...event });
          doneReceived = true; // Stop reading stream
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
      if ((readErr as Error)?.name === 'AbortError') {
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
      const err = new Error(error.error || 'Edge Function call failed') as Error & {
        error_code?: string;
        prompt_name?: string;
        retry_after_s?: number;
      };
      err.error_code = error.error_code;
      err.prompt_name = error.prompt_name as string | undefined;
      if (error.retry_after_s) err.retry_after_s = error.retry_after_s as number;
      throw err;
    }

    return result;
  }, []);

  const runPrompt = useCallback(
    async (
      childPromptRowId: string,
      userMessage: string,
      templateVariables: Record<string, unknown> = {},
      options: PromptRunOptions = {}
    ): Promise<ConversationRunResult | null> => {
      if (!supabase || !childPromptRowId) return null;

      const { onSuccess, onProgress, resumeResponseId, resumeAnswer, resumeVariableName, resumeCallId } = options;
      const unregisterCall = registerCall();

      // Create abort controller for this request
      abortControllerRef.current = new AbortController();
      // Reset response_id
      currentResponseIdRef.current = null;
      
      // Create per-call cancel function with captured refs
      const callResponseIdRef = { current: null as string | null };
      const cancelThisCall = async (): Promise<void> => {
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
              // Resume parameters for question node answers
              ...(resumeResponseId && resumeAnswer && resumeVariableName ? {
                resume_question_answer: {
                  previous_response_id: resumeResponseId,
                  answer: resumeAnswer,
                  variable_name: resumeVariableName,
                  call_id: resumeCallId,
                }
              } : {}),
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
            callResponseIdRef.current = progressEvent.response_id || null;
            updateCall(dashboardCallId, { 
              status: 'in_progress',
              responseId: progressEvent.response_id,
            });
          } else if (progressEvent.type === 'settings_resolved') {
            // Update dashboard with resolved settings and tools
            updateResolvedSettings(dashboardCallId, progressEvent.settings, progressEvent.tools);
          } else if (progressEvent.type === 'status_update') {
            updateCall(dashboardCallId, { status: progressEvent.status });
          } else if (progressEvent.type === 'thinking_delta') {
            appendThinking(dashboardCallId, progressEvent.delta || '');
          } else if (progressEvent.type === 'thinking_done') {
            // Set final thinking summary if provided (for polling fallback)
            if (progressEvent.text) {
              updateCall(dashboardCallId, { thinkingSummary: progressEvent.text });
            }
          } else if (progressEvent.type === 'output_text_delta') {
            appendOutputText(dashboardCallId, progressEvent.delta || '');
          } else if (progressEvent.type === 'output_text_done') {
            // Fallback: if we missed deltas (e.g., polling fallback), set full text
            updateCall(dashboardCallId, { outputText: progressEvent.text });
          } else if (progressEvent.type === 'usage_delta') {
            // Use server-provided token counts (accurate, not estimated)
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
            promptName: data?.child_prompt_name,
            model: data?.model,
            elapsedMs: data?.elapsed_ms,
            usage: data?.usage,
            apiRequest: data?.request_params,
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
        if ((error as Error).message === 'Request cancelled') {
          toast.info('Request cancelled', {
            source: 'useConversationRun.runPrompt',
          });
          return null;
        }
        console.error('Error running conversation:', error);
        const formatted = formatErrorForDisplay(error, (error as { prompt_name?: string }).prompt_name);
        toast.error(formatted.title, {
          description: formatted.description,
          duration: isQuotaError(error) ? 10000 : 5000,
          source: 'useConversationRun.runPrompt',
          errorCode: formatted.code,
          details: JSON.stringify({
            errorMessage: (error as Error).message,
            errorCode: (error as { error_code?: string }).error_code,
            retryAfter: (error as { retry_after_s?: number }).retry_after_s,
            promptRowId: childPromptRowId,
            promptName: (error as { prompt_name?: string }).prompt_name,
            apiRequest: (error as { requestParams?: unknown }).requestParams,
            stack: (error as Error).stack?.split?.('\n')?.slice?.(0, 5)?.join?.('\n'),
          }, null, 2),
        });
        
        // Track prompt run error
        trackEvent('prompt_run', {
          prompt_id: childPromptRowId,
          success: false,
          error_code: formatted.code,
          error_message: (error as Error).message,
        });
        trackApiError('conversation-run', error instanceof Error ? error : new Error(String(error)), {
          prompt_id: childPromptRowId,
          error_code: formatted.code,
        });
        trackException(error instanceof Error ? error : new Error(String(error)), {
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
    [parseSSEStream, registerCall, safeSetState, supabase, addCall, updateCall, updateResolvedSettings, appendThinking, appendOutputText, incrementOutputTokens, removeCall]
  );

  const runConversation = useCallback(
    async (options: ConversationRunOptions): Promise<ConversationRunResult> => {
      const {
        childPromptRowId,
        userMessage,
        threadMode,
        childThreadStrategy,
        existingThreadRowId,
        template_variables,
        store_in_history = true,
        onSuccess,
        onProgress,
        promptName,
        model,
        isCascadeCall = false,
        resumeResponseId,
        resumeAnswer,
        resumeVariableName,
        resumeCallId,
      } = options;

      if (!supabase || !childPromptRowId) return { response: null };

      const unregisterCall = registerCall();

      // Create abort controller for this request
      abortControllerRef.current = new AbortController();
      // Reset response_id
      currentResponseIdRef.current = null;
      
      // Create per-call cancel function with captured refs
      const callResponseIdRef = { current: null as string | null };
      const cancelThisCall = async (): Promise<void> => {
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
              // Resume parameters for question node answers
              ...(resumeResponseId && resumeAnswer && resumeVariableName ? {
                resume_question_answer: {
                  previous_response_id: resumeResponseId,
                  answer: resumeAnswer,
                  variable_name: resumeVariableName,
                  call_id: resumeCallId,
                }
              } : {}),
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
            callResponseIdRef.current = progressEvent.response_id || null;
            updateCall(dashboardCallId, { 
              status: 'in_progress',
              responseId: progressEvent.response_id,
            });
          } else if (progressEvent.type === 'settings_resolved') {
            updateResolvedSettings(dashboardCallId, progressEvent.settings, progressEvent.tools);
          } else if (progressEvent.type === 'status_update') {
            updateCall(dashboardCallId, { status: progressEvent.status });
          } else if (progressEvent.type === 'thinking_delta') {
            appendThinking(dashboardCallId, progressEvent.delta || '');
          } else if (progressEvent.type === 'thinking_done') {
            if (progressEvent.text) {
              updateCall(dashboardCallId, { thinkingSummary: progressEvent.text });
            }
          } else if (progressEvent.type === 'output_text_delta') {
            appendOutputText(dashboardCallId, progressEvent.delta || '');
            // Increment output tokens (rough estimate: 1 token per ~4 chars)
            const tokenDelta = Math.ceil((progressEvent.delta?.length || 0) / 4);
            if (tokenDelta > 0) {
              incrementOutputTokens(dashboardCallId, tokenDelta);
            }
          } else if (progressEvent.type === 'output_text_done') {
            if (progressEvent.text) {
              updateCall(dashboardCallId, { outputText: progressEvent.text });
            }
          } else if (progressEvent.type === 'usage_delta') {
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
        if ((error as Error).message === 'Request cancelled') {
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
    [parseSSEStream, registerCall, safeSetState, supabase, addCall, updateCall, updateResolvedSettings, appendThinking, appendOutputText, incrementOutputTokens, removeCall]
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
