import { useCallback, useEffect, useRef, useState } from 'react';
import { useSupabase } from './useSupabase';
import { toast } from '@/components/ui/sonner';
import { useApiCallContext } from '@/contexts/ApiCallContext';

export const useAssistantRun = () => {
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

  const runPrompt = useCallback(
    async (childPromptRowId, userMessage, templateVariables = {}, options = {}) => {
      if (!supabase || !childPromptRowId) return null;

      const { onSuccess } = options;
      const unregisterCall = registerCall();

      safeSetState(setIsRunning, true);
      try {
        const { data, error } = await supabase.functions.invoke('assistant-run', {
          body: {
            child_prompt_row_id: childPromptRowId,
            user_message: userMessage,
            template_variables: templateVariables,
          },
        });

        if (error) throw error;
        if (data.error) throw new Error(data.error);

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
        console.error('Error running assistant:', error);
        toast.error(`Run failed: ${error.message}`);
        return null;
      } finally {
        unregisterCall();
        safeSetState(setIsRunning, false);
      }
    },
    [registerCall, safeSetState, supabase]
  );

  const runAssistant = useCallback(
    async ({
      assistantRowId,
      childPromptRowId,
      userMessage,
      threadMode,
      childThreadStrategy,
      existingThreadRowId,
      onSuccess,
    }) => {
      if (!supabase || !childPromptRowId) return { response: null };

      const unregisterCall = registerCall();

      safeSetState(setIsRunning, true);
      try {
        const { data, error } = await supabase.functions.invoke('assistant-run', {
          body: {
            child_prompt_row_id: childPromptRowId,
            user_message: userMessage,
            thread_mode: threadMode,
            child_thread_strategy: childThreadStrategy,
            existing_thread_row_id: existingThreadRowId,
          },
        });

        if (error) throw error;
        if (data.error) throw new Error(data.error);

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
        console.error('Error running assistant:', error);
        throw error;
      } finally {
        unregisterCall();
        safeSetState(setIsRunning, false);
      }
    },
    [registerCall, safeSetState, supabase]
  );

  return {
    runPrompt,
    runAssistant,
    isRunning,
    lastResponse,
  };
};
