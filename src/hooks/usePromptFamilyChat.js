import { useState, useCallback, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/components/ui/sonner';
import { trackEvent, trackException } from '@/lib/posthog';
import { useApiCallContext } from '@/contexts/ApiCallContext';

export const usePromptFamilyChat = (promptRowId) => {
  const { registerCall } = useApiCallContext();
  const abortControllerRef = useRef(null);
  
  const [threads, setThreads] = useState([]);
  const [activeThreadId, setActiveThreadId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingMessage, setStreamingMessage] = useState('');
  const [toolActivity, setToolActivity] = useState([]);
  const [isExecutingTools, setIsExecutingTools] = useState(false);
  const [rootPromptId, setRootPromptId] = useState(null);
  
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

    // Notify user message sent
    toast.info('Message sent', { description: userMessage.slice(0, 50) + (userMessage.length > 50 ? '...' : '') });

    setIsStreaming(true);
    setStreamingMessage('');
    setToolActivity([]);
    setIsExecutingTools(false);

    // Register this streaming call with ApiCallContext
    const unregisterCall = registerCall();
    abortControllerRef.current = new AbortController();

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

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let fullContent = '';
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
              const parsed = JSON.parse(data);
              
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
              
              const deltaContent = parsed.choices?.[0]?.delta?.content;
              if (deltaContent) {
                fullContent += deltaContent;
                setStreamingMessage(fullContent);
              }
              
              if (parsed.error) {
                throw new Error(parsed.error.message || parsed.error);
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
      
      // Notify AI response received
      toast.info('AI response received', { description: fullContent.slice(0, 50) + (fullContent.length > 50 ? '...' : '') });
      
      setStreamingMessage('');
      setIsStreaming(false);
      setToolActivity([]);
      setIsExecutingTools(false);
      unregisterCall();
      abortControllerRef.current = null;

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
        toast.error(error.message || 'Failed to get AI response');
        trackException(error, { context: 'prompt_family_chat' });
      }
      setStreamingMessage('');
      setIsStreaming(false);
      setToolActivity([]);
      setIsExecutingTools(false);
      unregisterCall();
      abortControllerRef.current = null;
      return null;
    }
  }, [activeThreadId, promptRowId, addMessage, registerCall, sessionModel, sessionReasoningEffort]);

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
    setActiveThreadId(null);
    setMessages([]);
    setStreamingMessage('');
    setToolActivity([]);
    setIsStreaming(false);
    setIsExecutingTools(false);
  }, [rootPromptId]);

  // Cancel stream function for external use
  const cancelStream = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
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
  };
};
