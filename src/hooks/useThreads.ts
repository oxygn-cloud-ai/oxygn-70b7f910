import { useState, useEffect, useCallback, useRef } from 'react';
import { useSupabase } from './useSupabase';
import { toast } from '@/components/ui/sonner';
import { trackEvent } from '@/lib/posthog';

export interface Thread {
  row_id: string;
  name?: string | null;
  is_active?: boolean | null;
  assistant_row_id?: string | null;
  child_prompt_row_id?: string | null;
  openai_thread_id?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  [key: string]: unknown;
}

export interface ThreadMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  created_at?: string;
  [key: string]: unknown;
}

export interface UseThreadsReturn {
  threads: Thread[];
  activeThread: Thread | null;
  setActiveThread: (thread: Thread | null) => void;
  messages: ThreadMessage[];
  isLoading: boolean;
  isLoadingMessages: boolean;
  createThread: (name?: string) => Promise<Thread | null>;
  deleteThread: (threadRowId: string) => Promise<boolean>;
  fetchMessages: (threadRowId: string) => Promise<ThreadMessage[]>;
  renameThread: (threadRowId: string, name: string) => Promise<boolean>;
  refetch: () => Promise<void>;
}

export const useThreads = (
  assistantRowId: string | null | undefined,
  childPromptRowId: string | null | undefined
): UseThreadsReturn => {
  const supabase = useSupabase();
  const [threads, setThreads] = useState<Thread[]>([]);
  const [activeThread, setActiveThread] = useState<Thread | null>(null);
  const [messages, setMessages] = useState<ThreadMessage[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const isMountedRef = useRef(true);

  // Reset mounted ref on mount/unmount
  useEffect(() => {
    isMountedRef.current = true;
    return () => { isMountedRef.current = false; };
  }, []);

  const fetchThreads = useCallback(async (): Promise<void> => {
    if (!supabase) return;

    try {
      const { data, error } = await supabase.functions.invoke('thread-manager', {
        body: {
          action: 'list',
          assistant_row_id: assistantRowId,
          child_prompt_row_id: childPromptRowId,
        },
      });

      if (error) throw error;
      if (data.error) throw new Error(data.error);

      if (isMountedRef.current) {
        setThreads(data.threads || []);

        // Set active thread if one exists
        if (data.threads?.length > 0 && !activeThread) {
          const active = data.threads.find((t: Thread) => t.is_active);
          setActiveThread(active || data.threads[0]);
        }
      }
    } catch (error) {
      if (isMountedRef.current) {
        console.error('Error fetching threads:', error);
        toast.error('Failed to load threads');
      }
    } finally {
      if (isMountedRef.current) setIsLoading(false);
    }
  }, [supabase, assistantRowId, childPromptRowId, activeThread]);

  useEffect(() => {
    fetchThreads();
  }, [fetchThreads]);

  const createThread = useCallback(async (name?: string): Promise<Thread | null> => {
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

      if (error) throw error;
      if (data.error) throw new Error(data.error);

      setThreads(prev => [data.thread, ...prev]);
      setActiveThread(data.thread);
      toast.success('New thread created', {
        source: 'useThreads.createThread',
        details: JSON.stringify({ threadRowId: data.thread?.row_id, assistantRowId, childPromptRowId, name }, null, 2),
      } as Record<string, unknown>);
      trackEvent('thread_created', { assistant_row_id: assistantRowId, child_prompt_row_id: childPromptRowId });
      return data.thread;
    } catch (error) {
      const err = error as { code?: string; message?: string; stack?: string };
      console.error('Error creating thread:', error);
      toast.error('Failed to create thread', {
        source: 'useThreads.createThread',
        errorCode: err?.code || 'THREAD_CREATE_ERROR',
        details: JSON.stringify({ assistantRowId, childPromptRowId, name, error: err?.message, stack: err?.stack }, null, 2),
      } as Record<string, unknown>);
      return null;
    }
  }, [supabase, assistantRowId, childPromptRowId]);

  const deleteThread = useCallback(async (threadRowId: string): Promise<boolean> => {
    if (!supabase) return false;

    try {
      const { data, error } = await supabase.functions.invoke('thread-manager', {
        body: {
          action: 'delete',
          thread_row_id: threadRowId,
        },
      });

      if (error) throw error;
      if (data.error) throw new Error(data.error);

      setThreads(prev => prev.filter(t => t.row_id !== threadRowId));
      if (activeThread?.row_id === threadRowId) {
        setActiveThread(null);
        setMessages([]);
      }
      toast.success('Thread deleted', {
        source: 'useThreads.deleteThread',
        details: JSON.stringify({ threadRowId }, null, 2),
      } as Record<string, unknown>);
      trackEvent('thread_deleted', { thread_row_id: threadRowId });
      return true;
    } catch (error) {
      const err = error as { code?: string; message?: string; stack?: string };
      console.error('Error deleting thread:', error);
      toast.error('Failed to delete thread', {
        source: 'useThreads.deleteThread',
        errorCode: err?.code || 'THREAD_DELETE_ERROR',
        details: JSON.stringify({ threadRowId, error: err?.message, stack: err?.stack }, null, 2),
      } as Record<string, unknown>);
      return false;
    }
  }, [supabase, activeThread]);

  const fetchMessages = useCallback(async (threadRowId: string): Promise<ThreadMessage[]> => {
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

      if (error) throw error;
      if (data.error) throw new Error(data.error);

      setMessages(data.messages || []);
      return data.messages || [];
    } catch (error) {
      console.error('Error fetching messages:', error);
      toast.error('Failed to load messages');
      return [];
    } finally {
      setIsLoadingMessages(false);
    }
  }, [supabase]);

  const renameThread = useCallback(async (threadRowId: string, name: string): Promise<boolean> => {
    if (!supabase) return false;

    try {
      const { data, error } = await supabase.functions.invoke('thread-manager', {
        body: {
          action: 'rename',
          thread_row_id: threadRowId,
          name,
        },
      });

      if (error) throw error;
      if (data.error) throw new Error(data.error);

      setThreads(prev => prev.map(t =>
        t.row_id === threadRowId ? { ...t, name } : t
      ));
      return true;
    } catch (error) {
      console.error('Error renaming thread:', error);
      toast.error('Failed to rename thread');
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

export default useThreads;
