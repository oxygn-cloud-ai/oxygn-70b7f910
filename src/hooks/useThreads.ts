// @ts-nocheck
import { useState, useEffect, useCallback, useRef } from 'react';
import { useSupabase } from './useSupabase';
import { toast } from '@/components/ui/sonner';
import { trackEvent } from '@/lib/posthog';
import { parseApiError } from '@/utils/apiErrorUtils';

interface Thread {
  row_id: string;
  name: string | null;
  is_active: boolean;
  openai_conversation_id: string | null;
  created_at: string | null;
  updated_at: string | null;
}

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  created_at?: string;
}

interface ThreadResponse {
  threads?: Thread[];
  thread?: Thread;
  success?: boolean;
  error?: string;
  error_code?: string;
}

interface MessagesResponse {
  messages?: Message[];
  source?: string;
  status?: string;
  message?: string;
  error?: string;
  error_code?: string;
}

interface UseThreadsReturn {
  threads: Thread[];
  activeThread: Thread | null;
  setActiveThread: (thread: Thread | null) => void;
  messages: Message[];
  isLoading: boolean;
  isLoadingMessages: boolean;
  createThread: (name?: string) => Promise<Thread | null>;
  deleteThread: (threadRowId: string) => Promise<boolean>;
  fetchMessages: (threadRowId: string) => Promise<Message[]>;
  renameThread: (threadRowId: string, name: string) => Promise<boolean>;
  refetch: () => Promise<void>;
}

export const useThreads = (
  assistantRowId: string | null,
  childPromptRowId: string | null
): UseThreadsReturn => {
  const supabase = useSupabase();
  const [threads, setThreads] = useState<Thread[]>([]);
  const [activeThread, setActiveThread] = useState<Thread | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const isMountedRef = useRef(true);
  const hasAutoSelectedRef = useRef(false);

  // Reset mounted ref on mount/unmount
  useEffect(() => {
    isMountedRef.current = true;
    return () => { isMountedRef.current = false; };
  }, []);

  // Reset auto-selection ref when assistant changes
  useEffect(() => {
    hasAutoSelectedRef.current = false;
  }, [assistantRowId, childPromptRowId]);

  const fetchThreads = useCallback(async (): Promise<void> => {
    if (!supabase) return;

    try {
      const { data, error } = await supabase.functions.invoke<ThreadResponse>('thread-manager', {
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
        setThreads(data?.threads || []);

        // Only auto-select on first fetch, use ref to prevent re-triggering
        if (data?.threads?.length && !hasAutoSelectedRef.current) {
          hasAutoSelectedRef.current = true;
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
  }, [supabase, assistantRowId, childPromptRowId]);

  useEffect(() => {
    fetchThreads();
  }, [fetchThreads]);

  const createThread = useCallback(async (name?: string): Promise<Thread | null> => {
    if (!supabase || !assistantRowId) return null;

    try {
      const { data, error } = await supabase.functions.invoke<ThreadResponse>('thread-manager', {
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

      if (data?.thread) {
        setThreads(prev => [data.thread!, ...prev]);
        setActiveThread(data.thread);
        toast.success('New thread created', {
          source: 'useThreads.createThread',
          details: JSON.stringify({ threadRowId: data.thread.row_id, assistantRowId, childPromptRowId, name }, null, 2),
        });
        trackEvent('thread_created', { assistant_row_id: assistantRowId, child_prompt_row_id: childPromptRowId });
        return data.thread;
      }
      return null;
    } catch (error) {
      console.error('Error creating thread:', error);
      const parsed = parseApiError(error);
      toast.error(parsed.title, {
        description: parsed.message,
        source: 'useThreads.createThread',
        errorCode: parsed.code,
        details: JSON.stringify({ assistantRowId, childPromptRowId, name, error: parsed.original }, null, 2),
      });
      return null;
    }
  }, [supabase, assistantRowId, childPromptRowId]);

  const deleteThread = useCallback(async (threadRowId: string): Promise<boolean> => {
    if (!supabase) return false;

    try {
      const { data, error } = await supabase.functions.invoke<ThreadResponse>('thread-manager', {
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
        details: JSON.stringify({ threadRowId, error: parsed.original }, null, 2),
      });
      return false;
    }
  }, [supabase, activeThread]);

  const fetchMessages = useCallback(async (threadRowId: string): Promise<Message[]> => {
    if (!supabase || !threadRowId) return [];

    setIsLoadingMessages(true);
    try {
      const { data, error } = await supabase.functions.invoke<MessagesResponse>('thread-manager', {
        body: {
          action: 'get_messages',
          thread_row_id: threadRowId,
          limit: 50,
        },
      });

      // Check data.error first - it contains structured error_code even on 4xx responses
      if (data?.error) throw data;
      if (error) throw error;

      // Handle graceful not_configured status - return empty messages, no toast
      if (data?.status === 'openai_not_configured') {
        console.log('[useThreads] OpenAI not configured, returning empty messages');
        setMessages([]);
        return [];
      }

      const messageList = data?.messages || [];
      setMessages(messageList);
      return messageList;
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

  const renameThread = useCallback(async (threadRowId: string, name: string): Promise<boolean> => {
    if (!supabase) return false;

    try {
      const { data, error } = await supabase.functions.invoke<ThreadResponse>('thread-manager', {
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
