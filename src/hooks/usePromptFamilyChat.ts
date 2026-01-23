import { useState, useCallback, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/components/ui/sonner';
import { useLiveApiDashboard } from '@/contexts/LiveApiDashboardContext';
import { usePromptFamilyThreads } from './usePromptFamilyThreads';
import { usePromptFamilyChatMessages } from './usePromptFamilyChatMessages';
import { usePromptFamilyChatStream } from './usePromptFamilyChatStream';
import type { ChatThread, ChatMessage } from '@/types/chat';

export interface UsePromptFamilyChatReturn {
  // Thread state
  threads: ChatThread[];
  activeThreadId: string | null;
  activeThread: ChatThread | null;
  // Message state
  messages: ChatMessage[];
  isLoading: boolean;
  // Streaming state
  isStreaming: boolean;
  streamingMessage: string;
  thinkingText: string;
  toolActivity: { name: string; args?: Record<string, unknown>; status: 'running' | 'complete' }[];
  isExecutingTools: boolean;
  // Session state
  sessionModel: string | null;
  setSessionModel: (model: string | null) => void;
  sessionReasoningEffort: string;
  setSessionReasoningEffort: (effort: string) => void;
  // Actions
  fetchThreads: () => Promise<void>;
  fetchMessages: (threadId: string) => Promise<ChatMessage[]>;
  createThread: (title?: string) => Promise<ChatThread | null>;
  switchThread: (threadId: string) => Promise<void>;
  deleteThread: (threadId: string) => Promise<boolean>;
  addMessage: (role: 'user' | 'assistant', content: string, toolCalls?: unknown, threadId?: string | null) => ChatMessage | null;
  clearMessages: () => Promise<boolean>;
  sendMessage: (userMessage: string, threadId?: string | null, options?: { model?: string | null; reasoningEffort?: string }) => Promise<string | null>;
  setMessages: React.Dispatch<React.SetStateAction<ChatMessage[]>>;
  cancelStream: () => void;
}

export const usePromptFamilyChat = (promptRowId: string | null): UsePromptFamilyChatReturn => {
  const { removeCall } = useLiveApiDashboard();
  const abortControllerRef = useRef<AbortController | null>(null);
  const dashboardCallIdRef = useRef<string | null>(null);
  
  const [rootPromptId, setRootPromptId] = useState<string | null>(null);
  const [sessionModel, setSessionModel] = useState<string | null>(null);
  const [sessionReasoningEffort, setSessionReasoningEffort] = useState('auto');

  // Compose sub-hooks
  const threadManager = usePromptFamilyThreads(rootPromptId);
  const messageManager = usePromptFamilyChatMessages();
  const streamManager = usePromptFamilyChatStream();

  // Compute root prompt ID by walking up parent chain
  const computeRootPromptId = useCallback(async (pRowId: string): Promise<string> => {
    let current = pRowId;
    let depth = 0;
    while (depth < 15) {
      const { data } = await supabase
        .from('q_prompts')
        .select('parent_row_id, prompt_name')
        .eq('row_id', current)
        .maybeSingle();
      if (!data?.parent_row_id) {
        return current;
      }
      current = data.parent_row_id;
      depth++;
    }
    return current;
  }, []);

  // Resolve root prompt when promptRowId changes
  useEffect(() => {
    const resolveRoot = async () => {
      if (!promptRowId) {
        setRootPromptId(null);
        return;
      }
      const rootId = await computeRootPromptId(promptRowId);
      setRootPromptId(rootId);
    };
    resolveRoot();
  }, [promptRowId, computeRootPromptId]);

  // Switch thread with message loading
  const switchThread = useCallback(async (threadId: string): Promise<void> => {
    messageManager.clearMessages();
    streamManager.resetStreamState();
    const messages = await threadManager.switchThread(threadId);
    messageManager.setMessages(messages);
  }, [threadManager, messageManager, streamManager]);

  // Create thread wrapper
  const createThread = useCallback(async (title = 'New Chat'): Promise<ChatThread | null> => {
    messageManager.clearMessages();
    streamManager.resetStreamState();
    return threadManager.createThread(title);
  }, [threadManager, messageManager, streamManager]);

  // Clear messages - creates new thread
  const clearMessages = useCallback(async (): Promise<boolean> => {
    if (!rootPromptId) return false;
    try {
      await createThread('New Chat');
      toast.success('Conversation cleared');
      return true;
    } catch (error) {
      console.error('Error clearing messages:', error);
      toast.error('Failed to clear conversation');
      return false;
    }
  }, [rootPromptId, createThread]);

  // Add message wrapper with optional threadId
  const addMessage = useCallback((
    role: 'user' | 'assistant', 
    content: string, 
    toolCalls: unknown = null, 
    threadId: string | null = null
  ): ChatMessage | null => {
    const effectiveThreadId = threadId || threadManager.activeThreadId;
    if (!effectiveThreadId) {
      console.warn('[usePromptFamilyChat] addMessage failed: no threadId');
      return null;
    }
    return messageManager.addMessage(role, content, effectiveThreadId);
  }, [threadManager.activeThreadId, messageManager]);

  // Send message orchestrator
  const sendMessage = useCallback(async (
    userMessage: string, 
    threadId: string | null = null, 
    options: { model?: string | null; reasoningEffort?: string } = {}
  ): Promise<string | null> => {
    const { model, reasoningEffort } = options;
    const effectiveThreadId = threadId || threadManager.activeThreadId;
    
    if (!effectiveThreadId || !userMessage.trim() || !promptRowId) {
      console.log('[ChatDebug] sendMessage blocked - missing thread/message/prompt');
      return null;
    }

    // Add user message locally
    const userMsg = messageManager.addMessage('user', userMessage, effectiveThreadId);
    if (!userMsg) return null;

    // Send via stream manager
    const result = await streamManager.sendMessage(
      userMessage,
      effectiveThreadId,
      promptRowId,
      model || sessionModel,
      reasoningEffort || sessionReasoningEffort,
      {
        onMessageComplete: async (content, tid) => {
          return messageManager.addMessage('assistant', content, tid);
        },
        onUpdateLastMessageAt: async (tid) => {
          await supabase
            .from('q_threads')
            .update({ last_message_at: new Date().toISOString() })
            .eq('row_id', tid);
        }
      }
    );

    return result;
  }, [threadManager.activeThreadId, promptRowId, messageManager, streamManager, sessionModel, sessionReasoningEffort]);

  // CONSOLIDATED: Reset, fetch threads, auto-select, and fetch messages in proper sequence
  useEffect(() => {
    let cancelled = false;
    
    const loadThreadAndMessages = async () => {
      // Abort any in-flight request
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
        abortControllerRef.current = null;
      }
      
      // Clean up dashboard call
      if (dashboardCallIdRef.current) {
        removeCall(dashboardCallIdRef.current);
        dashboardCallIdRef.current = null;
      }
      
      // Reset UI state
      threadManager.setActiveThreadId(null);
      messageManager.clearMessages();
      streamManager.resetStreamState();
      
      if (!rootPromptId) {
        return;
      }
      
      try {
        // Fetch threads
        const { data: { user } } = await supabase.auth.getUser();
        if (!user || cancelled) return;
        
        const { data: threadData, error } = await supabase
          .from('q_threads')
          .select('*')
          .eq('root_prompt_row_id', rootPromptId)
          .eq('owner_id', user.id)
          .eq('is_active', true)
          .order('last_message_at', { ascending: false, nullsFirst: false });
        
        if (error || cancelled) {
          console.error('Error fetching threads:', error);
          return;
        }
        
        // Auto-select first thread and fetch messages
        if (threadData?.length && !cancelled) {
          const selectedThread = threadData[0];
          threadManager.setActiveThreadId(selectedThread.row_id);
          
          try {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session || cancelled) return;
            
            const response = await supabase.functions.invoke('thread-manager', {
              body: {
                action: 'get_messages',
                thread_row_id: selectedThread.row_id,
                limit: 100,
              }
            });
            
            if (!cancelled && !response.error) {
              messageManager.setMessages((response.data?.messages || []).map((m: { id: string; role: 'user' | 'assistant'; content: string; created_at?: string }) => ({
                row_id: m.id,
                role: m.role,
                content: m.content,
                created_at: m.created_at,
              })));
            }
          } catch (err) {
            console.error('Error fetching messages:', err);
          }
        }
      } catch (error) {
        console.error('Error in loadThreadAndMessages:', error);
      }
    };
    
    loadThreadAndMessages();
    
    return () => { cancelled = true; };
  }, [rootPromptId, removeCall, threadManager, messageManager, streamManager]);

  return {
    // Thread state
    threads: threadManager.threads,
    activeThreadId: threadManager.activeThreadId,
    activeThread: threadManager.activeThread,
    // Message state
    messages: messageManager.messages,
    isLoading: threadManager.isLoading,
    // Streaming state
    isStreaming: streamManager.isStreaming,
    streamingMessage: streamManager.streamingMessage,
    thinkingText: streamManager.thinkingText,
    toolActivity: streamManager.toolActivity,
    isExecutingTools: streamManager.isExecutingTools,
    // Session state
    sessionModel,
    setSessionModel,
    sessionReasoningEffort,
    setSessionReasoningEffort,
    // Actions
    fetchThreads: threadManager.fetchThreads,
    fetchMessages: messageManager.fetchMessages,
    createThread,
    switchThread,
    deleteThread: threadManager.deleteThread,
    addMessage,
    clearMessages,
    sendMessage,
    setMessages: messageManager.setMessages,
    cancelStream: streamManager.cancelStream,
  };
};
