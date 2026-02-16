// @ts-nocheck
import { useState, useCallback, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/components/ui/sonner';
import { notify } from '@/contexts/ToastHistoryContext';
import { useLiveApiDashboard } from '@/contexts/LiveApiDashboardContext';
import { usePromptFamilyThreads } from './usePromptFamilyThreads';
import { usePromptFamilyChatMessages } from './usePromptFamilyChatMessages';
import { usePromptFamilyChatStream } from './usePromptFamilyChatStream';
import { usePendingResponseSubscription } from './usePendingResponseSubscription';
import type { ChatThread, ChatMessage } from '@/types/chat';

interface FamilyCacheEntry {
  threadId: string | null;
  messages: ChatMessage[];
  threads: ChatThread[];
}

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
  // Webhook state
  pendingResponseId: string | null;
  isWaitingForWebhook: boolean;
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

  // Per-family message cache for instant restore on prompt switch
  const familyCacheRef = useRef<Map<string, FamilyCacheEntry>>(new Map());
  const previousRootRef = useRef<string | null>(null);
  const MAX_CACHE_ENTRIES = 20;

  // Compose sub-hooks
  const threadManager = usePromptFamilyThreads(rootPromptId);
  const messageManager = usePromptFamilyChatMessages();
  const streamManager = usePromptFamilyChatStream();
  
  // Subscribe to pending response updates for webhook mode
  const { 
    isComplete: webhookComplete, 
    isFailed: webhookFailed, 
    outputText: webhookOutput, 
    errorMessage: webhookError,
    clearPendingResponse 
  } = usePendingResponseSubscription(streamManager.pendingResponseId);
  
  // Stable refs for sub-hooks to avoid dependency issues in effects
  const threadManagerRef = useRef(threadManager);
  const messageManagerRef = useRef(messageManager);
  const streamManagerRef = useRef(streamManager);
  
  // Guard against duplicate webhook processing
  const processedWebhookRef = useRef<string | null>(null);
  
  // Keep refs in sync
  useEffect(() => {
    threadManagerRef.current = threadManager;
    messageManagerRef.current = messageManager;
    streamManagerRef.current = streamManager;
  });

  // Invalidate cache for the current family (call on mutations)
  const invalidateCurrentCache = useCallback(() => {
    if (rootPromptId) {
      familyCacheRef.current.delete(rootPromptId);
    }
  }, [rootPromptId]);


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
      console.log('[PromptFamilyChat] Resolving root for:', promptRowId);
      if (!promptRowId) {
        console.log('[PromptFamilyChat] No promptRowId, clearing rootPromptId');
        setRootPromptId(null);
        return;
      }
      const rootId = await computeRootPromptId(promptRowId);
      console.log('[PromptFamilyChat] Root resolved:', rootId, 'from:', promptRowId);
      setRootPromptId(rootId);
    };
    resolveRoot();
  }, [promptRowId, computeRootPromptId]);

  // Handle webhook completion - use refs for stable access
  useEffect(() => {
    // Access via refs for stability
    const pendingId = streamManagerRef.current.pendingResponseId;
    if (!pendingId) return;
    
    // Guard against duplicate processing
    if (processedWebhookRef.current === pendingId) {
      console.log('[PromptFamilyChat] Already processed webhook:', pendingId);
      return;
    }
    
    if (webhookComplete && webhookOutput) {
      // Mark as processed BEFORE doing work to prevent race
      processedWebhookRef.current = pendingId;
      // Add the assistant message via ref
      const threadId = threadManagerRef.current.activeThreadId;
      if (threadId) {
        messageManagerRef.current.addMessage('assistant', webhookOutput, threadId);
        
        // Update thread timestamp with error handling
        supabase
          .from('q_threads')
          .update({ last_message_at: new Date().toISOString() })
          .eq('row_id', threadId)
          .then(({ error }) => {
            if (error) console.error('[PromptFamilyChat] Failed to update thread timestamp:', error);
          });
      }
      
      // Reset all states via ref
      streamManagerRef.current.resetStreamState();
      clearPendingResponse();
      
      notify.success('AI response received', {
        source: 'WebhookCompletion',
        description: webhookOutput.slice(0, 100) + (webhookOutput.length > 100 ? '...' : ''),
      });
    } else if (webhookFailed) {
      // Reset states and show error via ref
      streamManagerRef.current.resetStreamState();
      clearPendingResponse();
      
      notify.error(webhookError || 'Background processing failed', {
        source: 'WebhookCompletion',
        errorCode: 'WEBHOOK_FAILED',
      });
    }
  }, [webhookComplete, webhookFailed, webhookOutput, webhookError, clearPendingResponse]);

  // Switch thread with message loading
  const switchThread = useCallback(async (threadId: string): Promise<void> => {
    processedWebhookRef.current = null;  // Reset on thread switch
    messageManager.clearMessages();
    streamManager.resetStreamState();
    clearPendingResponse();
    const messages = await threadManager.switchThread(threadId);
    messageManager.setMessages(messages);
  }, [threadManager, messageManager, streamManager, clearPendingResponse]);

  // Create thread wrapper
  const createThread = useCallback(async (title = 'New Chat'): Promise<ChatThread | null> => {
    processedWebhookRef.current = null;  // Reset on new thread
    invalidateCurrentCache();
    messageManager.clearMessages();
    streamManager.resetStreamState();
    clearPendingResponse();
    return threadManager.createThread(title);
  }, [threadManager, messageManager, streamManager, clearPendingResponse, invalidateCurrentCache]);

  // Clear messages - creates new thread
  const clearMessages = useCallback(async (): Promise<boolean> => {
    if (!rootPromptId) return false;
    try {
      invalidateCurrentCache();
      await createThread('New Chat');
      toast.success('Conversation cleared');
      return true;
    } catch (error) {
      console.error('Error clearing messages:', error);
      toast.error('Failed to clear conversation');
      return false;
    }
  }, [rootPromptId, createThread, invalidateCurrentCache]);

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
    
    // Diagnostic: log entry state for concurrency debugging
    console.log('[PromptFamilyChat] sendMessage:', {
      hasMessage: !!userMessage.trim(),
      effectiveThreadId,
      activeThreadId: threadManager.activeThreadId,
      promptRowId,
      isStreaming: streamManager.isStreaming,
      threadCount: threadManager.threads.length,
    });
    
    if (!effectiveThreadId || !userMessage.trim() || !promptRowId) {
      console.warn('[PromptFamilyChat] sendMessage BLOCKED:', {
        noThread: !effectiveThreadId,
        noMessage: !userMessage.trim(),
        noPrompt: !promptRowId
      });
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
  // With per-family cache for instant restore on return visits
  useEffect(() => {
    let cancelled = false;
    
    const loadThreadAndMessages = async () => {
      // Access sub-hooks via refs to avoid dependency issues
      const tm = threadManagerRef.current;
      const mm = messageManagerRef.current;
      const sm = streamManagerRef.current;
      
      // Save outgoing family state to cache before switching
      const outgoingRoot = previousRootRef.current;
      if (outgoingRoot && tm.activeThreadId) {
        familyCacheRef.current.set(outgoingRoot, {
          threadId: tm.activeThreadId,
          messages: mm.messages,
          threads: tm.threads,
        });
        // Evict oldest entry if cache exceeds limit
        if (familyCacheRef.current.size > MAX_CACHE_ENTRIES) {
          const oldestKey = familyCacheRef.current.keys().next().value;
          if (oldestKey) familyCacheRef.current.delete(oldestKey);
        }
      }
      previousRootRef.current = rootPromptId;
      
      // Reset UI state
      tm.setActiveThreadId(null);
      mm.clearMessages();
      sm.resetStreamState();
      
      if (!rootPromptId) {
        return;
      }
      
      // Check cache for incoming family — instant restore
      const cached = familyCacheRef.current.get(rootPromptId);
      if (cached) {
        tm.setActiveThreadId(cached.threadId);
        mm.setMessages(cached.messages);
        tm.restoreThreads(cached.threads);
        
        // Background refresh: silently sync from server without loading flash
        const bgThreadId = cached.threadId;
        (async () => {
          try {
            const freshThreadId = await tm.fetchThreads();
            if (cancelled) return;
            
            // If the cached thread no longer exists, the fetchThreads auto-select handles it
            const effectiveThreadId = bgThreadId && tm.threads.some(t => t.row_id === bgThreadId) 
              ? bgThreadId 
              : freshThreadId;
            
            if (effectiveThreadId) {
              const freshMessages = await tm.fetchMessagesQuietly(effectiveThreadId);
              if (!cancelled && freshMessages.length > 0) {
                mm.setMessages(freshMessages);
              }
            }
          } catch {
            // Swallow — cache is already displayed
          }
        })();
        
        return;
      }
      
      // No cache: full server fetch (original behavior)
      try {
        const autoSelectedId = await tm.fetchThreads();
        
        if (cancelled) return;
        
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
    // Webhook state
    pendingResponseId: streamManager.pendingResponseId,
    isWaitingForWebhook: streamManager.isWaitingForWebhook,
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
    deleteThread: async (threadId: string) => { invalidateCurrentCache(); return threadManager.deleteThread(threadId); },
    addMessage,
    clearMessages,
    sendMessage,
    setMessages: messageManager.setMessages,
    cancelStream: streamManager.cancelStream,
  };
};
