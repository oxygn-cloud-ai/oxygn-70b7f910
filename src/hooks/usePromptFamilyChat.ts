import { useState, useCallback, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/components/ui/sonner';
import { notify } from '@/contexts/ToastHistoryContext';
import { trackEvent, trackException } from '@/lib/posthog';
import { useApiCallContext } from '@/contexts/ApiCallContext';
import { useLiveApiDashboard } from '@/contexts/LiveApiDashboardContext';
import { estimateRequestTokens, getModelContextWindow } from '@/utils/tokenizer';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface FamilyThread {
  row_id: string;
  root_prompt_row_id: string;
  owner_id?: string | null;
  title?: string | null;
  is_active?: boolean | null;
  last_message_at?: string | null;
  openai_conversation_id?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
}

export interface FamilyMessage {
  row_id: string;
  thread_row_id?: string;
  role: string;
  content: string | null;
  tool_calls?: unknown[] | null;
  created_at?: string | null;
}

export interface ToolActivity {
  name: string;
  args?: Record<string, unknown>;
  status: 'running' | 'complete';
}

export interface SendMessageOptions {
  model?: string;
  reasoningEffort?: string;
}

export interface SSEEvent {
  type: string;
  response_id?: string;
  delta?: string;
  text?: string;
  status?: string;
  message?: string;
  error?: string;
  tool?: string;
  args?: Record<string, unknown>;
  input_tokens?: number;
  output_tokens?: number;
  elapsed_ms?: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// Hook
// ─────────────────────────────────────────────────────────────────────────────

export const usePromptFamilyChat = (promptRowId: string | null) => {
  const { registerCall } = useApiCallContext();
  const { addCall, updateCall, appendThinking, appendOutputText, incrementOutputTokens, removeCall } = useLiveApiDashboard();
  const abortControllerRef = useRef<AbortController | null>(null);
  const dashboardCallIdRef = useRef<string | null>(null);
  
  const [threads, setThreads] = useState<FamilyThread[]>([]);
  const [activeThreadId, setActiveThreadId] = useState<string | null>(null);
  const [messages, setMessages] = useState<FamilyMessage[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isStreaming, setIsStreaming] = useState<boolean>(false);
  const [streamingMessage, setStreamingMessage] = useState<string>('');
  const [thinkingText, setThinkingText] = useState<string>('');
  const [toolActivity, setToolActivity] = useState<ToolActivity[]>([]);
  const [isExecutingTools, setIsExecutingTools] = useState<boolean>(false);
  const [rootPromptId, setRootPromptId] = useState<string | null>(null);
  
  const activeThreadIdRef = useRef<string | null>(null);
  const switchRequestIdRef = useRef<number>(0);
  const toolActivityCountRef = useRef<number>(0);
  
  useEffect(() => {
    activeThreadIdRef.current = activeThreadId;
  }, [activeThreadId]);
  
  const [sessionModel, setSessionModel] = useState<string | null>(null);
  const [sessionReasoningEffort, setSessionReasoningEffort] = useState<string>('auto');

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

  // Fetch threads
  const fetchThreads = useCallback(async (): Promise<void> => {
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
      setThreads((data || []) as FamilyThread[]);
      
      if (data?.length > 0 && !activeThreadIdRef.current) {
        setActiveThreadId(data[0].row_id);
      }
    } catch (error) {
      console.error('Error fetching threads:', error);
    }
  }, [rootPromptId]);

  // Fetch messages for active thread
  const fetchMessages = useCallback(async (): Promise<void> => {
    if (!activeThreadId) {
      setMessages([]);
      return;
    }

    setIsLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      const response = await supabase.functions.invoke('thread-manager', {
        body: {
          action: 'get_messages',
          thread_row_id: activeThreadId,
          limit: 100,
        }
      });

      if (response.error) throw response.error;
      
      interface MessageData {
        id: string;
        role: string;
        content: string | null;
        created_at?: string;
      }
      
      setMessages(((response.data?.messages || []) as MessageData[]).map(m => ({
        row_id: m.id,
        role: m.role,
        content: m.content,
        created_at: m.created_at,
      })));
    } catch (error) {
      console.error('Error fetching messages:', error);
      setMessages([]);
    } finally {
      setIsLoading(false);
    }
  }, [activeThreadId]);

  // Create a new thread
  const createThread = useCallback(async (title: string = 'New Chat'): Promise<FamilyThread | null> => {
    if (!rootPromptId) return null;

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      await supabase
        .from('q_threads')
        .update({ is_active: false })
        .eq('root_prompt_row_id', rootPromptId)
        .eq('owner_id', user.id)
        .eq('is_active', true);

      const response = await supabase.functions.invoke('thread-manager', {
        body: {
          action: 'create',
          root_prompt_row_id: rootPromptId,
          name: title,
        }
      });

      if (response.error) throw response.error;
      
      const newThread = response.data?.thread as FamilyThread | undefined;
      if (newThread) {
        setThreads([newThread]);
        setActiveThreadId(newThread.row_id);
        setMessages([]);
      }
      
      return newThread || null;
    } catch (error) {
      console.error('Error creating thread:', error);
      toast.error('Failed to create new chat');
      return null;
    }
  }, [rootPromptId]);

  // Switch to a different thread
  const switchThread = useCallback(async (threadId: string): Promise<void> => {
    const requestId = ++switchRequestIdRef.current;
    
    setActiveThreadId(threadId);
    activeThreadIdRef.current = threadId;
    setMessages([]);
    setStreamingMessage('');
    setThinkingText('');
    setToolActivity([]);
    setIsExecutingTools(false);
    
    if (threadId) {
      setIsLoading(true);
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) throw new Error('Not authenticated');
        
        if (requestId !== switchRequestIdRef.current) return;
        
        const response = await supabase.functions.invoke('thread-manager', {
          body: {
            action: 'get_messages',
            thread_row_id: threadId,
            limit: 100,
          }
        });
        
        if (requestId !== switchRequestIdRef.current) return;
        
        if (!response.error) {
          interface MessageData {
            id: string;
            role: string;
            content: string | null;
            created_at?: string;
          }
          
          setMessages(((response.data?.messages || []) as MessageData[]).map(m => ({
            row_id: m.id,
            role: m.role,
            content: m.content,
            created_at: m.created_at,
          })));
        }
      } catch (err) {
        console.error('Error fetching messages on thread switch:', err);
        if (requestId === switchRequestIdRef.current) setMessages([]);
      } finally {
        if (requestId === switchRequestIdRef.current) setIsLoading(false);
      }
    }
  }, []);

  // Delete a thread
  const deleteThread = useCallback(async (threadId: string): Promise<boolean> => {
    try {
      const { error } = await supabase
        .from('q_threads')
        .update({ is_active: false })
        .eq('row_id', threadId);

      if (error) throw error;

      setThreads(prev => {
        const remaining = prev.filter(t => t.row_id !== threadId);
        if (activeThreadId === threadId) {
          setActiveThreadId(remaining[0]?.row_id || null);
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
  }, [activeThreadId]);

  // Add a message to local state
  const addMessage = useCallback((
    role: string,
    content: string,
    toolCalls: unknown[] | null = null,
    threadId: string | null = null
  ): FamilyMessage | null => {
    const effectiveThreadId = threadId || activeThreadId;
    if (!effectiveThreadId) {
      console.warn('[usePromptFamilyChat] addMessage failed: no threadId', { 
        role, 
        passedThreadId: threadId, 
        activeThreadId,
        contentPreview: content?.slice(0, 50) 
      });
      return null;
    }

    const localMsg: FamilyMessage = {
      row_id: `local-${Date.now()}`,
      thread_row_id: effectiveThreadId,
      role,
      content,
      tool_calls: toolCalls,
      created_at: new Date().toISOString()
    };
    
    setMessages(prev => [...prev, localMsg]);
    return localMsg;
  }, [activeThreadId]);

  // Clear messages
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

  // Send a message and get AI response
  const sendMessage = useCallback(async (
    userMessage: string,
    threadId: string | null = null,
    options: SendMessageOptions = {}
  ): Promise<string | null> => {
    const { model, reasoningEffort } = options;
    const effectiveThreadId = threadId || activeThreadId;
    if (!effectiveThreadId || !userMessage.trim() || !promptRowId) {
      return null;
    }

    const userMsg = await addMessage('user', userMessage, null, effectiveThreadId);
    if (!userMsg) return null;

    const effectiveModel = model || sessionModel || 'gpt-4o';
    
    notify.info('Message sent', { 
      source: 'usePromptFamilyChat.sendMessage',
      description: userMessage.slice(0, 100) + (userMessage.length > 100 ? '...' : ''),
      details: JSON.stringify({
        promptRowId,
        threadId: effectiveThreadId,
        model: effectiveModel,
        reasoningEffort: reasoningEffort || sessionReasoningEffort,
        messageLength: userMessage.length,
        fullMessage: userMessage,
      }, null, 2),
    });

    setIsStreaming(true);
    setStreamingMessage('');
    setToolActivity([]);
    setIsExecutingTools(false);

    const unregisterCall = registerCall();
    abortControllerRef.current = new AbortController();
    
    const fetchTimeoutId = setTimeout(() => {
      if (abortControllerRef.current) {
        console.warn('[Chat] Fetch timeout - aborting after 5 minutes');
        abortControllerRef.current.abort();
      }
    }, 300000);
    
    toolActivityCountRef.current = 0;

    const estimatedInputTokens = estimateRequestTokens({
      userMessage: userMessage || '',
    });
    const contextWindow = getModelContextWindow(effectiveModel);

    const dashboardId = addCall({
      promptName: 'Prompt Family Chat',
      promptRowId,
      model: effectiveModel,
      status: 'queued',
      cancelFn: async () => {
        if (abortControllerRef.current) {
          abortControllerRef.current.abort();
        }
      },
      isCascadeCall: false,
      estimatedInputTokens,
      contextWindow,
    });
    dashboardCallIdRef.current = dashboardId;

    trackEvent('prompt_family_message_sent', {
      prompt_id: promptRowId,
      thread_id: effectiveThreadId,
      message_length: userMessage.length,
    });

    let fullContent = '';
    let streamingFlushTimeout: ReturnType<typeof setTimeout> | null = null;
    let responseId: string | null = null;
    const usageData = { input_tokens: 0, output_tokens: 0 };

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error('Not authenticated');

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/prompt-family-chat`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`
          },
          body: JSON.stringify({
            prompt_row_id: promptRowId,
            user_message: userMessage,
            model: model || sessionModel || null,
            reasoning_effort: reasoningEffort || sessionReasoningEffort
          }),
          signal: abortControllerRef.current?.signal
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        let errorMessage = 'Failed to get response';
        try {
          const parsed = JSON.parse(errorText);
          errorMessage = parsed.error || parsed.message || errorMessage;
        } catch {
          errorMessage = errorText || errorMessage;
        }
        throw new Error(errorMessage);
      }

      updateCall(dashboardId, { status: 'in_progress' });

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            const trimmedLine = line.trim();
            if (!trimmedLine || !trimmedLine.startsWith('data: ')) continue;
            
            const data = trimmedLine.slice(6);
            if (data === '[DONE]') continue;

            try {
              const parsed = JSON.parse(data) as SSEEvent;
              
              if (parsed.type === 'api_started') {
                responseId = parsed.response_id || null;
                updateCall(dashboardId, { 
                  status: 'in_progress',
                  responseId: parsed.response_id,
                });
              }
              
              if (parsed.type === 'thinking_started') {
                setThinkingText('');
                updateCall(dashboardId, { status: 'in_progress' });
              } else if (parsed.type === 'thinking_delta') {
                setThinkingText(prev => prev + (parsed.delta || ''));
                appendThinking(dashboardId, parsed.delta || '');
              } else if (parsed.type === 'thinking_done') {
                if (parsed.text) setThinkingText(parsed.text);
              } else if (parsed.type === 'output_text_delta') {
                const delta = parsed.delta || '';
                if (delta) {
                  fullContent += delta;
                  appendOutputText(dashboardId, delta);
                  
                  if (!streamingFlushTimeout) {
                    streamingFlushTimeout = setTimeout(() => {
                      setStreamingMessage(fullContent);
                      streamingFlushTimeout = null;
                    }, 50);
                  }
                }
              } else if (parsed.type === 'output_text_done') {
                if (streamingFlushTimeout) {
                  clearTimeout(streamingFlushTimeout);
                  streamingFlushTimeout = null;
                }
                fullContent = parsed.text || fullContent;
                setStreamingMessage(fullContent);
                updateCall(dashboardId, { outputText: fullContent });
              }
              
              if (parsed.type === 'status_update') {
                updateCall(dashboardId, { status: parsed.status });
              }
              
              if (parsed.type === 'usage_delta') {
                if (parsed.input_tokens) {
                  usageData.input_tokens += parsed.input_tokens;
                }
                if (parsed.output_tokens) {
                  usageData.output_tokens += parsed.output_tokens;
                  incrementOutputTokens(dashboardId, parsed.output_tokens);
                }
              }
              
              if (parsed.type === 'error') {
                throw new Error(parsed.error || 'Unknown error');
              }
              
              if (parsed.type === 'tool_start') {
                setToolActivity(prev => {
                  const newActivity: ToolActivity[] = [...prev, {
                    name: parsed.tool || 'unknown',
                    args: parsed.args,
                    status: 'running'
                  }];
                  toolActivityCountRef.current = newActivity.length;
                  return newActivity;
                });
                setIsExecutingTools(true);
              } else if (parsed.type === 'tool_end') {
                setToolActivity(prev => prev.map(t => 
                  t.name === parsed.tool && t.status === 'running'
                    ? { ...t, status: 'complete' }
                    : t
                ));
              } else if (parsed.type === 'tool_loop_complete') {
                setIsExecutingTools(false);
              }
              
            } catch (e) {
              const err = e as Error;
              if (err.message && !err.message.includes('JSON')) {
                console.warn('SSE parse warning:', e);
              }
            }
          }
        }
      }

      if (fullContent.trim().length > 0) {
        await addMessage('assistant', fullContent, null, effectiveThreadId);
      } else if (toolActivityCountRef.current === 0) {
        notify.warning('No response received', {
          source: 'usePromptFamilyChat',
          description: 'The AI returned an empty response. Please try again.',
        });
      }
      
      notify.success('AI response received', { 
        source: 'usePromptFamilyChat.sendMessage',
        description: fullContent.slice(0, 100) + (fullContent.length > 100 ? '...' : ''),
        details: JSON.stringify({
          promptRowId,
          threadId: effectiveThreadId,
          model: effectiveModel,
          responseId,
          usage: usageData,
          responseLength: fullContent.length,
          toolsUsed: toolActivity.map(t => t.name),
          fullResponse: fullContent,
        }, null, 2),
      });
      
      if (streamingFlushTimeout) {
        clearTimeout(streamingFlushTimeout);
        streamingFlushTimeout = null;
      }
      
      clearTimeout(fetchTimeoutId);
      
      setStreamingMessage('');
      setThinkingText('');
      setIsStreaming(false);
      setToolActivity([]);
      toolActivityCountRef.current = 0;
      setIsExecutingTools(false);
      unregisterCall();
      abortControllerRef.current = null;
      
      removeCall(dashboardId);
      dashboardCallIdRef.current = null;

      await supabase
        .from('q_threads')
        .update({ last_message_at: new Date().toISOString() })
        .eq('row_id', effectiveThreadId);

      trackEvent('prompt_family_response_received', {
        prompt_id: promptRowId,
        thread_id: effectiveThreadId,
        response_length: fullContent.length,
      });

      return fullContent;
    } catch (error) {
      if (streamingFlushTimeout) {
        clearTimeout(streamingFlushTimeout);
        streamingFlushTimeout = null;
      }
      
      clearTimeout(fetchTimeoutId);
      
      const err = error as Error;
      if (err.name !== 'AbortError') {
        console.error('Error sending message:', error);
        notify.error(err.message || 'Failed to get AI response', {
          source: 'usePromptFamilyChat.sendMessage',
          errorCode: (error as { code?: string }).code || 'CHAT_ERROR',
          details: JSON.stringify({
            promptRowId,
            threadId: effectiveThreadId,
            model: effectiveModel,
            errorMessage: err.message,
            stack: err.stack?.split('\n').slice(0, 5).join('\n'),
          }, null, 2),
        });
        trackException(error, { context: 'prompt_family_chat' });
      }
      setStreamingMessage('');
      setThinkingText('');
      setIsStreaming(false);
      setToolActivity([]);
      toolActivityCountRef.current = 0;
      setIsExecutingTools(false);
      unregisterCall();
      abortControllerRef.current = null;
      
      if (dashboardCallIdRef.current) {
        removeCall(dashboardCallIdRef.current);
        dashboardCallIdRef.current = null;
      }
      
      return null;
    }
  }, [activeThreadId, promptRowId, addMessage, registerCall, addCall, updateCall, appendThinking, appendOutputText, incrementOutputTokens, removeCall, sessionModel, sessionReasoningEffort, toolActivity]);

  // Load thread and messages on prompt change
  useEffect(() => {
    let cancelled = false;
    
    const loadThreadAndMessages = async () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
        abortControllerRef.current = null;
      }
      
      if (dashboardCallIdRef.current) {
        removeCall(dashboardCallIdRef.current);
        dashboardCallIdRef.current = null;
      }
      
      setActiveThreadId(null);
      activeThreadIdRef.current = null;
      setMessages([]);
      setStreamingMessage('');
      setThinkingText('');
      setToolActivity([]);
      setIsStreaming(false);
      setIsExecutingTools(false);
      
      if (!rootPromptId) {
        setThreads([]);
        setIsLoading(false);
        return;
      }
      
      try {
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
        
        setThreads((threadData || []) as FamilyThread[]);
        
        if (threadData?.length > 0 && !cancelled) {
          const selectedThread = threadData[0] as FamilyThread;
          setActiveThreadId(selectedThread.row_id);
          activeThreadIdRef.current = selectedThread.row_id;
          
          setIsLoading(true);
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
              interface MessageData {
                id: string;
                role: string;
                content: string | null;
                created_at?: string;
              }
              
              setMessages(((response.data?.messages || []) as MessageData[]).map(m => ({
                row_id: m.id,
                role: m.role,
                content: m.content,
                created_at: m.created_at,
              })));
            }
          } catch (err) {
            console.error('Error fetching messages:', err);
            if (!cancelled) setMessages([]);
          } finally {
            if (!cancelled) setIsLoading(false);
          }
        }
      } catch (error) {
        console.error('Error in loadThreadAndMessages:', error);
      }
    };
    
    loadThreadAndMessages();
    
    return () => { cancelled = true; };
  }, [rootPromptId, removeCall]);

  // Cancel stream function
  const cancelStream = useCallback((): void => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    if (dashboardCallIdRef.current) {
      removeCall(dashboardCallIdRef.current);
      dashboardCallIdRef.current = null;
    }
  }, [removeCall]);


  return {
    threads,
    activeThreadId,
    activeThread: threads.find(t => t.row_id === activeThreadId),
    messages,
    isLoading,
    isStreaming,
    streamingMessage,
    thinkingText,
    toolActivity,
    isExecutingTools,
    fetchThreads,
    fetchMessages,
    createThread,
    switchThread,
    deleteThread,
    addMessage,
    clearMessages,
    sendMessage,
    setMessages,
    cancelStream,
    sessionModel,
    setSessionModel,
    sessionReasoningEffort,
    setSessionReasoningEffort,
  };
};
