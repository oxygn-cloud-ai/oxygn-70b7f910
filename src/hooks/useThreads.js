import { useState, useEffect, useCallback } from 'react';
import { useSupabase } from './useSupabase';
import { toast } from '@/components/ui/sonner';

export const useThreads = (assistantRowId, childPromptRowId) => {
  const supabase = useSupabase();
  const [threads, setThreads] = useState([]);
  const [activeThread, setActiveThread] = useState(null);
  const [messages, setMessages] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);

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

      if (error) throw error;
      if (data.error) throw new Error(data.error);

      setThreads(data.threads || []);

      // Set active thread if one exists
      if (data.threads?.length > 0 && !activeThread) {
        const active = data.threads.find(t => t.is_active);
        setActiveThread(active || data.threads[0]);
      }
    } catch (error) {
      console.error('Error fetching threads:', error);
      toast.error('Failed to load threads');
    } finally {
      setIsLoading(false);
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

      if (error) throw error;
      if (data.error) throw new Error(data.error);

      setThreads(prev => [data.thread, ...prev]);
      setActiveThread(data.thread);
      toast.success('New thread created');
      return data.thread;
    } catch (error) {
      console.error('Error creating thread:', error);
      toast.error('Failed to create thread');
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

      if (error) throw error;
      if (data.error) throw new Error(data.error);

      setThreads(prev => prev.filter(t => t.row_id !== threadRowId));
      if (activeThread?.row_id === threadRowId) {
        setActiveThread(null);
        setMessages([]);
      }
      toast.success('Thread deleted');
      return true;
    } catch (error) {
      console.error('Error deleting thread:', error);
      toast.error('Failed to delete thread');
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
