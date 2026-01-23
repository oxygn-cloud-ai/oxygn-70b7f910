import { useState, useCallback, useRef, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/components/ui/sonner';
import type { ChatThread, ChatMessage } from '@/types/chat';

export interface UsePromptFamilyThreadsReturn {
  threads: ChatThread[];
  activeThreadId: string | null;
  activeThread: ChatThread | null;
  isLoading: boolean;
  setActiveThreadId: (id: string | null) => void;
  fetchThreads: () => Promise<void>;
  createThread: (title?: string) => Promise<ChatThread | null>;
  switchThread: (threadId: string) => Promise<ChatMessage[]>;
  deleteThread: (threadId: string) => Promise<boolean>;
}

export function usePromptFamilyThreads(rootPromptId: string | null): UsePromptFamilyThreadsReturn {
  const [threads, setThreads] = useState<ChatThread[]>([]);
  const [activeThreadId, setActiveThreadId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  
  // Ref to track activeThreadId without causing callback re-creation
  const activeThreadIdRef = useRef<string | null>(null);
  
  // Ref to track switchThread request ID for race condition prevention
  const switchRequestIdRef = useRef(0);
  
  // Keep ref in sync with state
  useEffect(() => {
    activeThreadIdRef.current = activeThreadId;
  }, [activeThreadId]);

  // Fetch threads for the current prompt family
  const fetchThreads = useCallback(async () => {
    if (!rootPromptId) {
      setThreads([]);
      return;
    }

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      
      const { data, error } = await supabase
        .from('q_threads')
        .select('*')
        .eq('root_prompt_row_id', rootPromptId)
        .eq('owner_id', user.id)
        .eq('is_active', true)
        .order('last_message_at', { ascending: false, nullsFirst: false });

      if (error) throw error;
      setThreads((data || []) as ChatThread[]);
      
      // Auto-select first thread if none selected
      if (data?.length && !activeThreadIdRef.current) {
        setActiveThreadId(data[0].row_id);
      }
    } catch (error) {
      console.error('Error fetching threads:', error);
    }
  }, [rootPromptId]);

  // Create a new thread
  const createThread = useCallback(async (title = 'New Chat'): Promise<ChatThread | null> => {
    if (!rootPromptId) return null;

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      // Deactivate existing active threads for this family
      await supabase
        .from('q_threads')
        .update({ is_active: false })
        .eq('root_prompt_row_id', rootPromptId)
        .eq('owner_id', user.id)
        .eq('is_active', true);

      // Create new thread via thread-manager
      const response = await supabase.functions.invoke('thread-manager', {
        body: {
          action: 'create',
          root_prompt_row_id: rootPromptId,
          name: title,
        }
      });

      if (response.error) throw response.error;
      
      const newThread = response.data?.thread as ChatThread | undefined;
      if (newThread) {
        setThreads([newThread]);
        setActiveThreadId(newThread.row_id);
      }
      
      return newThread || null;
    } catch (error) {
      console.error('Error creating thread:', error);
      toast.error('Failed to create new chat');
      return null;
    }
  }, [rootPromptId]);

  // Switch to a different thread and fetch its messages
  const switchThread = useCallback(async (threadId: string): Promise<ChatMessage[]> => {
    // Increment request ID to invalidate in-flight requests
    const requestId = ++switchRequestIdRef.current;
    
    // Update state immediately for responsive UI
    setActiveThreadId(threadId);
    activeThreadIdRef.current = threadId;
    
    if (!threadId) return [];
    
    setIsLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');
      
      // Check if this request is still valid
      if (requestId !== switchRequestIdRef.current) return [];
      
      const response = await supabase.functions.invoke('thread-manager', {
        body: {
          action: 'get_messages',
          thread_row_id: threadId,
          limit: 100,
        }
      });
      
      // Check again after async operation
      if (requestId !== switchRequestIdRef.current) return [];
      
      if (response.error) {
        console.error('Error fetching messages on thread switch:', response.error);
        return [];
      }
      
      return (response.data?.messages || []).map((m: { id: string; role: 'user' | 'assistant'; content: string; created_at?: string }) => ({
        row_id: m.id,
        role: m.role,
        content: m.content,
        created_at: m.created_at,
      }));
    } catch (err) {
      console.error('Error fetching messages on thread switch:', err);
      return [];
    } finally {
      if (requestId === switchRequestIdRef.current) {
        setIsLoading(false);
      }
    }
  }, []);

  // Delete (soft delete) a thread
  const deleteThread = useCallback(async (threadId: string): Promise<boolean> => {
    try {
      const { error } = await supabase
        .from('q_threads')
        .update({ is_active: false })
        .eq('row_id', threadId);

      if (error) throw error;

      setThreads(prev => {
        const remaining = prev.filter(t => t.row_id !== threadId);
        // If deleting current thread, switch to first remaining
        if (activeThreadIdRef.current === threadId) {
          const nextThread = remaining[0]?.row_id || null;
          setActiveThreadId(nextThread);
        }
        return remaining;
      });
      
      toast.success('Conversation cleared');
      return true;
    } catch (error) {
      console.error('Error deleting thread:', error);
      toast.error('Failed to delete chat');
      return false;
    }
  }, []);

  const activeThread = threads.find(t => t.row_id === activeThreadId) || null;

  return {
    threads,
    activeThreadId,
    activeThread,
    isLoading,
    setActiveThreadId,
    fetchThreads,
    createThread,
    switchThread,
    deleteThread,
  };
}
