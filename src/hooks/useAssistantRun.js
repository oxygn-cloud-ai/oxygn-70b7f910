import { useCallback, useEffect, useRef, useState } from 'react';
import { useSupabase } from './useSupabase';
import { toast } from 'sonner';
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

  const setIsRunningSafe = useCallback((next) => {
    if (!isMountedRef.current) return;
    setIsRunning(next);
  }, []);

  const setLastResponseSafe = useCallback((next) => {
    if (!isMountedRef.current) return;
    setLastResponse(next);
  }, []);

  const runPrompt = useCallback(
    async (childPromptRowId, userMessage, templateVariables = {}, options = {}) => {
      if (!supabase || !childPromptRowId) return null;

      const { onSuccess } = options;
      const unregisterCall = registerCall();

      setIsRunningSafe(true);
      try {
        const { data, error } = await supabase.functions.invoke('assistant-run', {
          body: {
            child_prompt_row_id: childPromptRowId,
            user_message: userMessage,
            template_variables: templateVariables,
          },
          signal: unregisterCall?.signal,
        });

        if (error) throw error;
        if (data.error) throw new Error(data.error);

        setLastResponseSafe(data);

        // Call success callback (for background completion)
        if (onSuccess) {
          await onSuccess(data);
        }

        toast.success('Run completed');
        return data;
      } catch (error) {
        if (error?.name === 'AbortError') {
          toast.info('Run cancelled');
          return null;
        }

        console.error('Error running assistant:', error);
        toast.error(`Run failed: ${error.message}`);
        return null;
      } finally {
        unregisterCall?.();
        setIsRunningSafe(false);
      }
    },
    [registerCall, setIsRunningSafe, setLastResponseSafe, supabase]
  );

  // Alternative call signature used by ChildPromptPanel
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

      setIsRunningSafe(true);
      try {
        const { data, error } = await supabase.functions.invoke('assistant-run', {
          body: {
            child_prompt_row_id: childPromptRowId,
            user_message: userMessage,
            thread_mode: threadMode,
            child_thread_strategy: childThreadStrategy,
            existing_thread_row_id: existingThreadRowId,
          },
          signal: unregisterCall?.signal,
        });

        if (error) throw error;
        if (data.error) throw new Error(data.error);

        setLastResponseSafe(data);

        // Call success callback (for background completion)
        if (onSuccess) {
          await onSuccess(data);
        }

        return data;
      } finally {
        unregisterCall?.();
        setIsRunningSafe(false);
      }
    },
    [registerCall, setIsRunningSafe, setLastResponseSafe, supabase]
  );

  return {
    runPrompt,
    runAssistant,
    isRunning,
    lastResponse,
  };
};

