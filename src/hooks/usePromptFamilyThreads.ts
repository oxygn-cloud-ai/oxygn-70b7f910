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
  fetchThreads: () => Promise<string | null>;  // Fixed: returns auto-selected thread ID
  createThread: (title?: string) => Promise<ChatThread | null>;
  switchThread: (threadId: string) => Promise<ChatMessage[]>;
  deleteThread: (threadId: string) => Promise<boolean>;
}

export function usePromptFamilyThreads(rootPromptId: string | null): UsePromptFamilyThreadsReturn {
  const [threads, setThreads] = useState<ChatThread[]>([]);
  const [activeThreadId, setActiveThreadIdState] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  
  // Ref to track activeThreadId without causing callback re-creation
  const activeThreadIdRef = useRef<string | null>(null);
  
  // Ref to track switchThread request ID for race condition prevention
  const switchRequestIdRef = useRef(0);
  
  // Synchronous setter that updates ref immediately (before async operations read it)
  const setActiveThreadId = useCallback((id: string | null) => {
    activeThreadIdRef.current = id;  // Sync update FIRST
    setActiveThreadIdState(id);      // Then schedule React state update
  }, []);

  // Fetch threads for the current prompt family - returns auto-selected thread ID
  const fetchThreads = useCallback(async (): Promise<string | null> => {
    if (!rootPromptId) {
      setThreads([]);
      return null;
    }

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;
      
      const { data, error } = await supabase
        .from('q_threads')
        .select('*')
        .eq('root_prompt_row_id', rootPromptId)
        .eq('owner_id', user.id)
        .eq('purpose', 'chat')  // Only show chat threads, not execution threads
        .eq('is_active', true)
        .order('last_message_at', { ascending: false, nullsFirst: false });

      if (error) throw error;
      setThreads((data || []) as ChatThread[]);
      
      // Diagnostic logging
      console.log('[PromptFamilyThreads] fetchThreads result:', {
        threadCount: data?.length || 0,
        activeThreadIdRef: activeThreadIdRef.current,
        willAutoSelect: data?.length && !activeThreadIdRef.current,
        firstThreadId: data?.[0]?.row_id,
      });
      
      // Auto-select first thread if none selected
      if (data?.length && !activeThreadIdRef.current) {
        setActiveThreadId(data[0].row_id);
        return data[0].row_id;  // Return the auto-selected ID
      }
      return activeThreadIdRef.current;  // Return current selection
    } catch (error) {
      console.error('Error fetching threads:', error);
      return null;
    }
  }, [rootPromptId]);

  // Create a new thread
  const createThread = useCallback(async (title = 'New Chat'): Promise<ChatThread | null> => {
    if (!rootPromptId) return null;

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      // Deactivate existing active chat threads for this family (not run threads)
      const { error: deactivateError } = await supabase
        .from('q_threads')
        .update({ is_active: false })
        .eq('root_prompt_row_id', rootPromptId)
        .eq('owner_id', user.id)
        .eq('purpose', 'chat')  // Only deactivate chat threads, not run threads
        .eq('is_active', true);

      if (deactivateError) {
        console.error('Error deactivating threads:', deactivateError);
        // Continue anyway - the unique constraint will catch issues
      }

      // Create new thread via thread-manager with purpose='chat'
      const response = await supabase.functions.invoke('thread-manager', {
        body: {
          action: 'create',
          root_prompt_row_id: rootPromptId,
          name: title,
          purpose: 'chat',  // Explicitly create chat threads
        }
      });

      // Diagnostic: log thread creation result for concurrency debugging
      console.log('[PromptFamilyThreads] createThread result:', {
        success: !response.error,
        threadId: response.data?.thread?.row_id,
        purpose: response.data?.thread?.purpose,
        error: response.error,
      });

      if (response.error) throw response.error;
      
      const newThread = response.data?.thread as ChatThread | undefined;
      if (newThread) {
        setThreads(prev => [newThread, ...prev]);
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
      
      // Handle invoke-level errors
      if (response.error) {
        console.error('Error fetching messages on thread switch:', response.error);
        return [];
      }
      
      // Handle graceful not_configured status - empty messages, no error
      if (response.data?.status === 'openai_not_configured') {
        console.log('[usePromptFamilyThreads] OpenAI not configured, returning empty messages');
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
