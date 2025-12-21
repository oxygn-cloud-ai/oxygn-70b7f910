import { useCallback, useEffect, useRef, useState } from 'react';
import { useSupabase } from './useSupabase';
import { toast } from '@/components/ui/sonner';
import { useApiCallContext } from '@/contexts/ApiCallContext';

export const useConversationRun = () => {
  const supabase = useSupabase();
  const { registerCall } = useApiCallContext();
  const [isRunning, setIsRunning] = useState(false);
  const [lastResponse, setLastResponse] = useState(null);
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const safeSetState = useCallback((setter, value) => {
    if (isMountedRef.current) setter(value);
  }, []);

  const buildEdgeFunctionError = useCallback(async (invokeError) => {
    if (!invokeError) return new Error('Edge Function call failed');

    let status = invokeError?.context?.response?.status;
    let payload = null;

    try {
      const res = invokeError?.context?.response;
      if (res) {
        const text = await res.text();
        if (text) {
          try {
            payload = JSON.parse(text);
          } catch {
            payload = { error: text };
          }
        }
      }
    } catch {
      // ignore
    }

    const message = payload?.error || payload?.message || invokeError.message || 'Edge Function call failed';
    const err = new Error(message);
    if (status) err.status = status;
    if (payload?.error_code) err.error_code = payload.error_code;
    if (typeof payload?.retry_after_s === 'number') err.retry_after_s = payload.retry_after_s;
    return err;
  }, []);

  const runPrompt = useCallback(
    async (childPromptRowId, userMessage, templateVariables = {}, options = {}) => {
      if (!supabase || !childPromptRowId) return null;

      const { onSuccess } = options;
      const unregisterCall = registerCall();

      safeSetState(setIsRunning, true);
      try {
        const { data, error } = await supabase.functions.invoke('conversation-run', {
          body: {
            child_prompt_row_id: childPromptRowId,
            user_message: userMessage,
            template_variables: templateVariables,
          },
        });

        if (error) throw await buildEdgeFunctionError(error);
        if (data?.error) {
          const e = new Error(data.error);
          if (data.error_code) e.error_code = data.error_code;
          if (typeof data.retry_after_s === 'number') e.retry_after_s = data.retry_after_s;
          throw e;
        }

        safeSetState(setLastResponse, data);

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
        console.error('Error running conversation:', error);
        toast.error(`Run failed: ${error.message}`);
        return null;
      } finally {
        unregisterCall();
        safeSetState(setIsRunning, false);
      }
    },
    [buildEdgeFunctionError, registerCall, safeSetState, supabase]
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
    }) => {
      if (!supabase || !childPromptRowId) return { response: null };

      const unregisterCall = registerCall();

      safeSetState(setIsRunning, true);
      try {
        const { data, error } = await supabase.functions.invoke('conversation-run', {
          body: {
            child_prompt_row_id: childPromptRowId,
            user_message: userMessage,
            thread_mode: threadMode,
            child_thread_strategy: childThreadStrategy,
            existing_thread_row_id: existingThreadRowId,
            template_variables: template_variables,
          },
        });

        if (error) throw await buildEdgeFunctionError(error);
        if (data?.error) {
          const e = new Error(data.error);
          if (data.error_code) e.error_code = data.error_code;
          if (typeof data.retry_after_s === 'number') e.retry_after_s = data.retry_after_s;
          throw e;
        }

        safeSetState(setLastResponse, data);

        if (typeof onSuccess === 'function') {
          try {
            await onSuccess(data);
          } catch (e) {
            console.error('onSuccess callback error:', e);
          }
        }

        return data;
      } catch (error) {
        console.error('Error running conversation:', error);
        throw error;
      } finally {
        unregisterCall();
        safeSetState(setIsRunning, false);
      }
    },
    [buildEdgeFunctionError, registerCall, safeSetState, supabase]
  );

  return {
    runPrompt,
    runConversation,
    isRunning,
    lastResponse,
  };
};

