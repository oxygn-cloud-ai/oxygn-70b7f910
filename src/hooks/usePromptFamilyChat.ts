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
  fetchThreads: () => Promise<string | null>;  // Returns auto-selected thread ID
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
  
  const [rootPromptId, setRootPromptId] = useState<string | null>(null);
  const [sessionModel, setSessionModel] = useState<string | null>(null);
  const [sessionReasoningEffort, setSessionReasoningEffort] = useState('auto');

  // Compose sub-hooks
  const threadManager = usePromptFamilyThreads(rootPromptId);
  const messageManager = usePromptFamilyChatMessages();
  const streamManager = usePromptFamilyChatStream();
  
  // Stable refs for sub-hooks to avoid dependency issues in effects
  const threadManagerRef = useRef(threadManager);
  const messageManagerRef = useRef(messageManager);
  const streamManagerRef = useRef(streamManager);
  
  // Keep refs in sync
  useEffect(() => {
    threadManagerRef.current = threadManager;
    messageManagerRef.current = messageManager;
    streamManagerRef.current = streamManager;
  });

  // Compute root prompt ID using the pre-computed root_prompt_row_id column
  const computeRootPromptId = useCallback(async (pRowId: string): Promise<string> => {
    const { data, error } = await supabase
      .from('q_prompts')
      .select('root_prompt_row_id, parent_row_id')
      .eq('row_id', pRowId)
      .maybeSingle();
    
    if (error) {
      console.error('[computeRootPromptId] Query failed:', error);
      return pRowId;  // Fallback to self
    }
    
    // If root_prompt_row_id is set, use it
    if (data?.root_prompt_row_id) {
      return data.root_prompt_row_id;
    }
    
    // No parent means this IS the root
    if (!data?.parent_row_id) {
      return pRowId;
    }
    
    // Data corruption fallback: root_prompt_row_id is NULL but parent exists
    console.warn('[computeRootPromptId] Missing root_prompt_row_id:', pRowId);
    return pRowId;
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
      // Access sub-hooks via refs to avoid dependency issues
      const tm = threadManagerRef.current;
      const mm = messageManagerRef.current;
      const sm = streamManagerRef.current;
      
      // Reset UI state
      tm.setActiveThreadId(null);
      mm.clearMessages();
      sm.resetStreamState();
      
      if (!rootPromptId) {
        return;
      }
      
      try {
        // Fetch threads - returns auto-selected thread ID directly
        const autoSelectedId = await tm.fetchThreads();
        
        if (cancelled) return;
        
        // Fetch messages for the auto-selected thread using returned ID (not stale state)
        if (autoSelectedId) {
          const messages = await tm.switchThread(autoSelectedId);
          if (!cancelled) {
            mm.setMessages(messages);
          }
        }
      } catch (error) {
        console.error('Error in loadThreadAndMessages:', error);
      }
    };
    
    loadThreadAndMessages();
    
    return () => { cancelled = true; };
  }, [rootPromptId]);

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
