import { useState, useCallback } from 'react';
import { useSupabase } from './useSupabase';
import { toast } from 'sonner';

export const useAssistantRun = () => {
  const supabase = useSupabase();
  const [isRunning, setIsRunning] = useState(false);
  const [lastResponse, setLastResponse] = useState(null);

  const runPrompt = useCallback(async (childPromptRowId, userMessage, templateVariables = {}) => {
    if (!supabase || !childPromptRowId) return null;

    setIsRunning(true);
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

      setLastResponse(data);
      toast.success('Run completed');
      return data;
    } catch (error) {
      console.error('Error running assistant:', error);
      toast.error(`Run failed: ${error.message}`);
      return null;
    } finally {
      setIsRunning(false);
    }
  }, [supabase]);

  // Alternative call signature used by ChildPromptPanel
  const runAssistant = useCallback(async ({ 
    assistantRowId, 
    childPromptRowId, 
    userMessage, 
    threadMode, 
    childThreadStrategy,
    existingThreadRowId 
  }) => {
    if (!supabase || !childPromptRowId) return { response: null };

    setIsRunning(true);
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

      setLastResponse(data);
      return data;
    } catch (error) {
      console.error('Error running assistant:', error);
      throw error;
    } finally {
      setIsRunning(false);
    }
  }, [supabase]);

  return {
    runPrompt,
    runAssistant,
    isRunning,
    lastResponse,
  };
};
