import { useState, useCallback, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/components/ui/sonner';
import { notify } from '@/contexts/ToastHistoryContext';
import { trackEvent, trackException } from '@/lib/posthog';
import { useApiCallContext } from '@/contexts/ApiCallContext';
import { useLiveApiDashboard } from '@/contexts/LiveApiDashboardContext';
import { estimateRequestTokens, getModelContextWindow } from '@/utils/tokenizer';
import { estimateCost } from '@/utils/costEstimator';
export const usePromptFamilyChat = (promptRowId) => {
  const { registerCall } = useApiCallContext();
  const { addCall, updateCall, appendThinking, appendOutputText, incrementOutputTokens, removeCall } = useLiveApiDashboard();
  const abortControllerRef = useRef(null);
  const dashboardCallIdRef = useRef(null);
  
  const [threads, setThreads] = useState([]);
  const [activeThreadId, setActiveThreadId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingMessage, setStreamingMessage] = useState('');
  const [thinkingText, setThinkingText] = useState(''); // AI reasoning/thinking content
  const [toolActivity, setToolActivity] = useState([]);
  const [isExecutingTools, setIsExecutingTools] = useState(false);
  const [rootPromptId, setRootPromptId] = useState(null);
  
  // Ref to track activeThreadId without causing callback re-creation
  const activeThreadIdRef = useRef(null);
  
  // Ref to track switchThread request ID for race condition prevention
  const switchRequestIdRef = useRef(0);
  
  // Ref to track tool activity count (avoids stale closure in sendMessage)
  const toolActivityCountRef = useRef(0);
  
  // Keep ref in sync with state
  useEffect(() => {
    activeThreadIdRef.current = activeThreadId;
  }, [activeThreadId]);
  
  // Session-level model and reasoning effort state
  const [sessionModel, setSessionModel] = useState(null); // null = use default
  const [sessionReasoningEffort, setSessionReasoningEffort] = useState('auto');

  // Compute root prompt ID by walking up parent chain
  const computeRootPromptId = useCallback(async (pRowId) => {
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

  // Fetch the unified family thread (one per family)
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
      setThreads(data || []);
      
      // Auto-select first thread if none selected (use ref to avoid dependency)
      if (data?.length > 0 && !activeThreadIdRef.current) {
        setActiveThreadId(data[0].row_id);
      }
    } catch (error) {
      console.error('Error fetching threads:', error);
    }
  }, [rootPromptId]);

  // Fetch messages for active thread from OpenAI via thread-manager
  const fetchMessages = useCallback(async () => {
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
      
      setMessages((response.data?.messages || []).map(m => ({
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

  // Create a new thread (clears existing and creates fresh one)
  const createThread = useCallback(async (title = 'New Chat') => {
    if (!rootPromptId) return null;

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      // Deactivate any existing active thread for this family
      await supabase
        .from('q_threads')
        .update({ is_active: false })
        .eq('root_prompt_row_id', rootPromptId)
        .eq('owner_id', user.id)
        .eq('is_active', true);

      // Create new thread via thread-manager (creates real OpenAI conversation)
      const response = await supabase.functions.invoke('thread-manager', {
        body: {
          action: 'create',
          root_prompt_row_id: rootPromptId,
          name: title,
        }
      });

      if (response.error) throw response.error;
      
      const newThread = response.data?.thread;
      if (newThread) {
        setThreads([newThread]);
        setActiveThreadId(newThread.row_id);
        setMessages([]);
      }
      
      return newThread;
    } catch (error) {
      console.error('Error creating thread:', error);
      toast.error('Failed to create new chat');
      return null;
    }
  }, [rootPromptId]);

  // Switch to a different thread and fetch its messages
  // Uses request ID guard to prevent race conditions when switching rapidly
  const switchThread = useCallback(async (threadId) => {
    // Increment request ID to invalidate any in-flight requests
    const requestId = ++switchRequestIdRef.current;
    
    // Clear state immediately for responsive UI
    setActiveThreadId(threadId);
    activeThreadIdRef.current = threadId;
    setMessages([]);
    setStreamingMessage('');
    setThinkingText('');
    setToolActivity([]);
    setIsExecutingTools(false);
    
    // Fetch messages for the selected thread
    if (threadId) {
      setIsLoading(true);
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) throw new Error('Not authenticated');
        
        // Check if this request is still valid before async operation
        if (requestId !== switchRequestIdRef.current) return;
        
        const response = await supabase.functions.invoke('thread-manager', {
          body: {
            action: 'get_messages',
            thread_row_id: threadId,
            limit: 100,
          }
        });
        
        // Check again after async operation completes
        if (requestId !== switchRequestIdRef.current) return;
        
        if (!response.error) {
          setMessages((response.data?.messages || []).map(m => ({
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

  // Delete a thread (soft delete)
  const deleteThread = useCallback(async (threadId) => {
    try {
      const { error } = await supabase
        .from('q_threads')
        .update({ is_active: false })
        .eq('row_id', threadId);

      if (error) throw error;

      // Use functional update to get fresh threads state
      setThreads(prev => {
        const remaining = prev.filter(t => t.row_id !== threadId);
        // If deleting current thread, switch to first remaining
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

  // Add a message to local state only
  const addMessage = useCallback((role, content, toolCalls = null, threadId = null) => {
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

    const localMsg = {
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

  // Clear messages - creates a new thread
  const clearMessages = useCallback(async () => {
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
  const sendMessage = useCallback(async (userMessage, threadId = null, options = {}) => {
    console.log('[ChatDebug] sendMessage called, isStreaming:', isStreaming, 'threadId:', threadId, 'activeThreadId:', activeThreadId);
    const { model, reasoningEffort } = options;
    const effectiveThreadId = threadId || activeThreadId;
    if (!effectiveThreadId || !userMessage.trim() || !promptRowId) {
      console.log('[ChatDebug] sendMessage blocked - missing thread/message/prompt', { effectiveThreadId, hasMessage: !!userMessage.trim(), promptRowId });
      return null;
    }

    const userMsg = await addMessage('user', userMessage, null, effectiveThreadId);
    if (!userMsg) return null;

    const effectiveModel = model || sessionModel || 'gpt-4o';
    
    // Notify user message sent with full payload details
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

    // Register this streaming call with ApiCallContext (legacy)
    const unregisterCall = registerCall();
    abortControllerRef.current = new AbortController();
    
    // 5-minute fetch timeout matching backend IDLE_TIMEOUT_MS
    const fetchTimeoutId = setTimeout(() => {
      if (abortControllerRef.current) {
        console.warn('[Chat] Fetch timeout - aborting after 5 minutes');
        abortControllerRef.current.abort();
      }
    }, 300000);
    
    // Reset tool activity ref
    toolActivityCountRef.current = 0;

    // Estimate input tokens for dashboard
    const estimatedInputTokens = estimateRequestTokens({
      userMessage: userMessage || '',
    });
    const contextWindow = getModelContextWindow(effectiveModel);

    // Register with LiveApiDashboard for real-time status
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

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error('Not authenticated');

      // Only send the new user message - OpenAI Responses API maintains history via previous_response_id
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
          if (parsed.details) console.error('AI error details:', parsed.details);
        } catch {
          errorMessage = errorText || errorMessage;
        }
        throw new Error(errorMessage);
      }

      // Update dashboard status
      updateCall(dashboardId, { status: 'in_progress' });

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let fullContent = '';
      let buffer = '';
      
      // Debounce streaming UI updates (Step 2.1)
      let streamingFlushTimeout = null;
      const flushStreamingContent = () => {
        if (streamingFlushTimeout) {
          clearTimeout(streamingFlushTimeout);
          streamingFlushTimeout = null;
        }
        setStreamingMessage(fullContent);
      };
      
      // Track API metadata for toast details
      let responseId = null;
      let usageData = { input_tokens: 0, output_tokens: 0 };

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
              const parsed = JSON.parse(data);
              
              // Handle api_started - update dashboard with response_id
              if (parsed.type === 'api_started') {
                responseId = parsed.response_id;
                updateCall(dashboardId, { 
                  status: 'in_progress',
                  responseId: parsed.response_id,
                });
              }
              
              // Note: user_input_required is now handled in run mode (conversation-run)
              // Chat mode does not support question prompts - they are ignored here
              
              // Handle thinking/reasoning events - stream to dashboard AND local state
              if (parsed.type === 'thinking_started') {
                setThinkingText(''); // Reset for new response
                updateCall(dashboardId, { status: 'in_progress' });
              } else if (parsed.type === 'thinking_delta') {
                setThinkingText(prev => prev + (parsed.delta || ''));
                appendThinking(dashboardId, parsed.delta || '');
              } else if (parsed.type === 'thinking_done') {
                // Use final text if provided
                if (parsed.text) setThinkingText(parsed.text);
              } else if (parsed.type === 'output_text_delta') {
                const delta = parsed.delta || '';
                if (delta) {
                  fullContent += delta;
                  appendOutputText(dashboardId, delta);
                  
                  // Debounce UI updates to every 50ms
                  if (!streamingFlushTimeout) {
                    streamingFlushTimeout = setTimeout(() => {
                      setStreamingMessage(fullContent);
                      streamingFlushTimeout = null;
                    }, 50);
                  }
                }
              } else if (parsed.type === 'output_text_done') {
                // Use final text from server - clear pending timeout first
                if (streamingFlushTimeout) {
                  clearTimeout(streamingFlushTimeout);
                  streamingFlushTimeout = null;
                }
                fullContent = parsed.text || fullContent;
                setStreamingMessage(fullContent);
                updateCall(dashboardId, { outputText: fullContent });
                // thinkingText cleared in final cleanup section
              }
              
              // Handle status updates
              if (parsed.type === 'status_update') {
                updateCall(dashboardId, { status: parsed.status });
              }
              
              // Handle usage updates from server (accurate token counts)
              if (parsed.type === 'usage_delta') {
                if (parsed.input_tokens) {
                  usageData.input_tokens += parsed.input_tokens;
                }
                if (parsed.output_tokens) {
                  usageData.output_tokens += parsed.output_tokens;
                  incrementOutputTokens(dashboardId, parsed.output_tokens);
                }
              }
              
              // Handle progress messages
              if (parsed.type === 'progress') {
                // Could show in UI if desired
                console.log('Progress:', parsed.message);
              }
              
              // Handle errors
              if (parsed.type === 'error') {
                throw new Error(parsed.error || 'Unknown error');
              }
              
              // Handle tool events
              if (parsed.type === 'tool_start') {
                setToolActivity(prev => {
                  const newActivity = [...prev, {
                    name: parsed.tool,
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
              
              // Note: Chat Completions format (choices[0].delta.content) removed
              // Responses API uses output_text_delta events handled above
              
            } catch (e) {
              if (e.message && !e.message.includes('JSON')) {
                console.warn('SSE parse warning:', e);
              }
            }
          }
        }
      }

      // Only add assistant message if we have content (prevent blank bubbles)
      if (fullContent.trim().length > 0) {
        await addMessage('assistant', fullContent, null, effectiveThreadId);
      } else if (toolActivityCountRef.current === 0) {
        // Use ref instead of stale state closure
        notify.warning('No response received', {
          source: 'usePromptFamilyChat',
          description: 'The AI returned an empty response. Please try again.',
        });
      }
      
      // Notify AI response received with full payload details
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
      
      // Clear any pending streaming timeout FIRST (before clearing state)
      if (streamingFlushTimeout) {
        clearTimeout(streamingFlushTimeout);
        streamingFlushTimeout = null;
      }
      
      // Clear fetch timeout on success
      clearTimeout(fetchTimeoutId);
      
      setStreamingMessage('');
      setThinkingText(''); // Clear thinking text in final cleanup
      setIsStreaming(false);
      setToolActivity([]);
      toolActivityCountRef.current = 0; // Reset ref
      setIsExecutingTools(false);
      unregisterCall();
      abortControllerRef.current = null;
      
      // Remove from dashboard
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
      // Clear any pending streaming timeout to prevent orphaned updates
      if (streamingFlushTimeout) {
        clearTimeout(streamingFlushTimeout);
        streamingFlushTimeout = null;
      }
      
      // Clear fetch timeout on error
      clearTimeout(fetchTimeoutId);
      
      // Don't show error toast for aborted requests
      if (error.name !== 'AbortError') {
        console.error('Error sending message:', error);
        notify.error(error.message || 'Failed to get AI response', {
          source: 'usePromptFamilyChat.sendMessage',
          errorCode: error.code || 'CHAT_ERROR',
          details: JSON.stringify({
            promptRowId,
            threadId: effectiveThreadId,
            model: effectiveModel,
            errorMessage: error.message,
            stack: error.stack?.split('\n').slice(0, 5).join('\n'),
          }, null, 2),
        });
        trackException(error, { context: 'prompt_family_chat' });
      }
      setStreamingMessage('');
      setThinkingText(''); // Clear thinking text in error path (FIX: was missing)
      setIsStreaming(false);
      setToolActivity([]);
      toolActivityCountRef.current = 0; // Reset ref
      setIsExecutingTools(false);
      unregisterCall();
      abortControllerRef.current = null;
      
      // Remove from dashboard on error
      if (dashboardCallIdRef.current) {
        removeCall(dashboardCallIdRef.current);
        dashboardCallIdRef.current = null;
      }
      
      return null;
    }
  }, [activeThreadId, promptRowId, addMessage, registerCall, addCall, updateCall, appendThinking, appendOutputText, incrementOutputTokens, removeCall, sessionModel, sessionReasoningEffort]);

  // CONSOLIDATED: Reset, fetch threads, auto-select, and fetch messages in proper sequence
  // This fixes the race condition where fetchMessages ran before activeThreadId was set
  useEffect(() => {
    let cancelled = false;
    
    const loadThreadAndMessages = async () => {
      // Abort any in-flight request when prompt family changes
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
        abortControllerRef.current = null;
      }
      
      // Clean up dashboard call if any
      if (dashboardCallIdRef.current) {
        removeCall(dashboardCallIdRef.current);
        dashboardCallIdRef.current = null;
      }
      
      // Reset UI state immediately
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
        // Step 1: Fetch threads for this prompt family
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
        
        setThreads(threadData || []);
        
        // Step 2: Auto-select first thread and fetch its messages
        if (threadData?.length > 0 && !cancelled) {
          const selectedThread = threadData[0];
          setActiveThreadId(selectedThread.row_id);
          activeThreadIdRef.current = selectedThread.row_id;
          
          // Step 3: IMMEDIATELY fetch messages for the selected thread
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
              setMessages((response.data?.messages || []).map(m => ({
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

  // Cancel stream function for external use
  const cancelStream = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    // Clean up dashboard call
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
    thinkingText, // AI reasoning/thinking content
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
    // Session-level model/reasoning state
    sessionModel,
    setSessionModel,
    sessionReasoningEffort,
    setSessionReasoningEffort,
  };
};
