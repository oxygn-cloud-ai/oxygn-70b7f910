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
  const [toolActivity, setToolActivity] = useState([]);
  const [isExecutingTools, setIsExecutingTools] = useState(false);
  const [rootPromptId, setRootPromptId] = useState(null);
  
  // Communication prompt state
  const [pendingQuestion, setPendingQuestion] = useState(null);
  const [communicationProgress, setCommunicationProgress] = useState({ current: 0, max: 10 });
  const [collectedCommunicationVars, setCollectedCommunicationVars] = useState([]);
  
  // Ref to track activeThreadId without causing callback re-creation
  const activeThreadIdRef = useRef(null);
  
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

  // Switch to a different thread
  const switchThread = useCallback((threadId) => {
    setActiveThreadId(threadId);
    setMessages([]); // Clear old messages immediately to prevent flash
    setStreamingMessage('');
    setToolActivity([]);
    setIsExecutingTools(false);
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
    const { model, reasoningEffort } = options;
    const effectiveThreadId = threadId || activeThreadId;
    if (!effectiveThreadId || !userMessage.trim() || !promptRowId) return null;

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
              
              // Handle user_input_required - communication prompt interrupt
              if (parsed.type === 'user_input_required') {
                setPendingQuestion({
                  question: parsed.question,
                  variableName: parsed.variable_name,
                  description: parsed.description,
                  callId: parsed.call_id
                });
                setCommunicationProgress(prev => ({ ...prev, current: prev.current + 1 }));
                setIsStreaming(false);
                // Don't process further - wait for user input
                return fullContent;
              }
              
              // Handle thinking/reasoning events - stream to dashboard
              if (parsed.type === 'thinking_started') {
                updateCall(dashboardId, { status: 'in_progress' });
              } else if (parsed.type === 'thinking_delta') {
                appendThinking(dashboardId, parsed.delta || '');
              } else if (parsed.type === 'thinking_done') {
                // Thinking complete, could update status if needed
              } else if (parsed.type === 'output_text_delta') {
                appendOutputText(dashboardId, parsed.delta || '');
              } else if (parsed.type === 'output_text_done') {
                // Fallback: if we missed deltas, set full output text
                updateCall(dashboardId, { outputText: parsed.text });
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
                setToolActivity(prev => [...prev, {
                  name: parsed.tool,
                  args: parsed.args,
                  status: 'running'
                }]);
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
              
              // Handle final content
              const deltaContent = parsed.choices?.[0]?.delta?.content;
              if (deltaContent) {
                fullContent += deltaContent;
                setStreamingMessage(fullContent);
                // Note: Token counts now come from usage_delta events, not character estimation
              }
              
            } catch (e) {
              if (e.message && !e.message.includes('JSON')) {
                console.warn('SSE parse warning:', e);
              }
            }
          }
        }
      }

      await addMessage('assistant', fullContent, null, effectiveThreadId);
      
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
      
      setStreamingMessage('');
      setIsStreaming(false);
      setToolActivity([]);
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
      setIsStreaming(false);
      setToolActivity([]);
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

  // Effects
  useEffect(() => {
    fetchThreads();
  }, [fetchThreads]);

  useEffect(() => {
    fetchMessages();
  }, [fetchMessages]);

  // CRITICAL FIX: Reset only when ROOT changes (different family), not individual prompts
  useEffect(() => {
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
    setActiveThreadId(null);
    setMessages([]);
    setStreamingMessage('');
    setToolActivity([]);
    setIsStreaming(false);
    setIsExecutingTools(false);
    // Reset communication state
    setPendingQuestion(null);
    setCommunicationProgress({ current: 0, max: 10 });
    setCollectedCommunicationVars([]);
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

  // Submit communication answer - resumes conversation with user's response
  const submitCommunicationAnswer = useCallback(async (answer) => {
    if (!pendingQuestion) return null;
    
    const { variableName, question } = pendingQuestion;
    
    // Track the collected variable locally
    setCollectedCommunicationVars(prev => [...prev, { name: variableName, value: answer }]);
    
    // Clear pending question
    setPendingQuestion(null);
    
    // Resume conversation - AI will receive this and should call store_qa_response
    // Format message to give AI context about which question was answered
    const contextMessage = `[Answer for ${variableName}]: ${answer}`;
    
    return await sendMessage(contextMessage, null, {
      model: sessionModel,
      reasoningEffort: sessionReasoningEffort
    });
  }, [pendingQuestion, sendMessage, sessionModel, sessionReasoningEffort]);

  // Clear communication state
  const clearCommunicationState = useCallback(() => {
    setPendingQuestion(null);
    setCommunicationProgress({ current: 0, max: 10 });
    setCollectedCommunicationVars([]);
  }, []);

  return {
    threads,
    activeThreadId,
    activeThread: threads.find(t => t.row_id === activeThreadId),
    messages,
    isLoading,
    isStreaming,
    streamingMessage,
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
    // Communication prompt state and actions
    pendingQuestion,
    communicationProgress,
    collectedCommunicationVars,
    submitCommunicationAnswer,
    clearCommunicationState,
  };
};
