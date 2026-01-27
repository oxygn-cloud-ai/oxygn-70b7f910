import { useState, useEffect, useCallback, useRef } from 'react';
import { useSupabase } from './useSupabase';
import { toast } from '@/components/ui/sonner';
import { trackEvent } from '@/lib/posthog';
import { parseApiError } from '@/utils/apiErrorUtils';

export const useThreads = (assistantRowId, childPromptRowId) => {
  const supabase = useSupabase();
  const [threads, setThreads] = useState([]);
  const [activeThread, setActiveThread] = useState(null);
  const [messages, setMessages] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const isMountedRef = useRef(true);

  // Reset mounted ref on mount/unmount
  useEffect(() => {
    isMountedRef.current = true;
    return () => { isMountedRef.current = false; };
  }, []);

  const fetchThreads = useCallback(async () => {
    if (!supabase) return;

    try {
      const { data, error } = await supabase.functions.invoke('thread-manager', {
        body: {
          action: 'list',
          assistant_row_id: assistantRowId,
          child_prompt_row_id: childPromptRowId,
        },
      });

      // Check data.error first - it contains structured error_code even on 4xx responses
      if (data?.error) throw data;
      if (error) throw error;

      if (isMountedRef.current) {
        setThreads(data.threads || []);

        // Set active thread if one exists
        if (data.threads?.length > 0 && !activeThread) {
          const active = data.threads.find(t => t.is_active);
          setActiveThread(active || data.threads[0]);
        }
      }
    } catch (error) {
      if (isMountedRef.current) {
        console.error('Error fetching threads:', error);
        const parsed = parseApiError(error);
        toast.error(parsed.title, {
          description: parsed.message,
          source: 'useThreads.fetchThreads',
          errorCode: parsed.code,
        });
      }
    } finally {
      if (isMountedRef.current) setIsLoading(false);
    }
  }, [supabase, assistantRowId, childPromptRowId, activeThread]);

  useEffect(() => {
    fetchThreads();
  }, [fetchThreads]);

  const createThread = useCallback(async (name) => {
    if (!supabase || !assistantRowId) return null;

    try {
      const { data, error } = await supabase.functions.invoke('thread-manager', {
        body: {
          action: 'create',
          assistant_row_id: assistantRowId,
          child_prompt_row_id: childPromptRowId,
          name,
        },
      });

      // Check data.error first - it contains structured error_code even on 4xx responses
      if (data?.error) throw data;
      if (error) throw error;

      setThreads(prev => [data.thread, ...prev]);
      setActiveThread(data.thread);
      toast.success('New thread created', {
        source: 'useThreads.createThread',
        details: JSON.stringify({ threadRowId: data.thread?.row_id, assistantRowId, childPromptRowId, name }, null, 2),
      });
      trackEvent('thread_created', { assistant_row_id: assistantRowId, child_prompt_row_id: childPromptRowId });
      return data.thread;
    } catch (error) {
      console.error('Error creating thread:', error);
      const parsed = parseApiError(error);
      toast.error(parsed.title, {
        description: parsed.message,
        source: 'useThreads.createThread',
        errorCode: parsed.code,
        details: JSON.stringify({ assistantRowId, childPromptRowId, name, error: error?.message }, null, 2),
      });
      return null;
    }
  }, [supabase, assistantRowId, childPromptRowId]);

  const deleteThread = useCallback(async (threadRowId) => {
    if (!supabase) return false;

    try {
      const { data, error } = await supabase.functions.invoke('thread-manager', {
        body: {
          action: 'delete',
          thread_row_id: threadRowId,
        },
      });

      // Check data.error first - it contains structured error_code even on 4xx responses
      if (data?.error) throw data;
      if (error) throw error;

      setThreads(prev => prev.filter(t => t.row_id !== threadRowId));
      if (activeThread?.row_id === threadRowId) {
        setActiveThread(null);
        setMessages([]);
      }
      toast.success('Thread deleted', {
        source: 'useThreads.deleteThread',
        details: JSON.stringify({ threadRowId }, null, 2),
      });
      trackEvent('thread_deleted', { thread_row_id: threadRowId });
      return true;
    } catch (error) {
      console.error('Error deleting thread:', error);
      const parsed = parseApiError(error);
      toast.error(parsed.title, {
        description: parsed.message,
        source: 'useThreads.deleteThread',
        errorCode: parsed.code,
        details: JSON.stringify({ threadRowId, error: error?.message }, null, 2),
      });
      return false;
    }
  }, [supabase, activeThread]);

  const fetchMessages = useCallback(async (threadRowId) => {
    if (!supabase || !threadRowId) return [];

    setIsLoadingMessages(true);
    try {
      const { data, error } = await supabase.functions.invoke('thread-manager', {
        body: {
          action: 'get_messages',
          thread_row_id: threadRowId,
          limit: 50,
        },
      });

      // Check data.error first - it contains structured error_code even on 4xx responses
      if (data?.error) throw data;
      if (error) throw error;

      setMessages(data.messages || []);
      return data.messages || [];
    } catch (error) {
      console.error('Error fetching messages:', error);
      const parsed = parseApiError(error);
      toast.error(parsed.title, {
        description: parsed.message,
        source: 'useThreads.fetchMessages',
        errorCode: parsed.code,
      });
      return [];
    } finally {
      setIsLoadingMessages(false);
    }
  }, [supabase]);

  const renameThread = useCallback(async (threadRowId, name) => {
    if (!supabase) return false;

    try {
      const { data, error } = await supabase.functions.invoke('thread-manager', {
        body: {
          action: 'rename',
          thread_row_id: threadRowId,
          name,
        },
      });

      // Check data.error first - it contains structured error_code even on 4xx responses
      if (data?.error) throw data;
      if (error) throw error;

      setThreads(prev => prev.map(t =>
        t.row_id === threadRowId ? { ...t, name } : t
      ));
      return true;
    } catch (error) {
      console.error('Error renaming thread:', error);
      const parsed = parseApiError(error);
      toast.error(parsed.title, {
        description: parsed.message,
        source: 'useThreads.renameThread',
        errorCode: parsed.code,
      });
      return false;
    }
  }, [supabase]);

  return {
    threads,
    activeThread,
    setActiveThread,
    messages,
    isLoading,
    isLoadingMessages,
    createThread,
    deleteThread,
    fetchMessages,
    renameThread,
    refetch: fetchThreads,
  };
};
