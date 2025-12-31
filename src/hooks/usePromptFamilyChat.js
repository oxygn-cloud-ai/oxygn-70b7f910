import { useState, useCallback, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/components/ui/sonner';
import { trackEvent, trackException } from '@/lib/posthog';

export const usePromptFamilyChat = (promptRowId) => {
  const [threads, setThreads] = useState([]);
  const [activeThreadId, setActiveThreadId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingMessage, setStreamingMessage] = useState('');
  const [toolActivity, setToolActivity] = useState([]);
  const [isExecutingTools, setIsExecutingTools] = useState(false);

  // Compute root prompt ID by walking up parent chain
  const computeRootPromptId = useCallback(async (pRowId) => {
    let current = pRowId;
    let depth = 0;
    while (depth < 15) {
      const { data } = await supabase
        .from('q_prompts')
        .select('parent_row_id, prompt_name')
        .eq('row_id', current)
        .single();
      if (!data?.parent_row_id) {
        toast.info(`Root resolved: ${data?.prompt_name || current.slice(0, 8)}`, { duration: 2000 });
        return current;
      }
      current = data.parent_row_id;
      depth++;
    }
    return current;
  }, []);

  // Fetch the unified family thread (one per family)
  const fetchThreads = useCallback(async () => {
    if (!promptRowId) {
      setThreads([]);
      return;
    }

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const rootId = await computeRootPromptId(promptRowId);
      
      const { data, error } = await supabase
        .from('q_threads')
        .select('*')
        .eq('root_prompt_row_id', rootId)
        .eq('owner_id', user.id)
        .eq('is_active', true)
        .order('last_message_at', { ascending: false, nullsFirst: false });

      if (error) throw error;
      setThreads(data || []);
      
      // Auto-select first thread if none selected
      if (data?.length > 0 && !activeThreadId) {
        setActiveThreadId(data[0].row_id);
        const lastRespId = data[0].last_response_id;
        toast.info(`Thread found: ${lastRespId ? `prev_resp: ${lastRespId.slice(0, 12)}...` : 'no history'}`, { duration: 3000 });
      } else if (!data?.length) {
        toast.info('No existing thread - will create on first message', { duration: 2000 });
      }
    } catch (error) {
      console.error('Error fetching threads:', error);
    }
  }, [promptRowId, activeThreadId, computeRootPromptId]);

  // Fetch messages for active thread
  const fetchMessages = useCallback(async () => {
    if (!activeThreadId) {
      setMessages([]);
      return;
    }

    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('q_prompt_family_messages')
        .select('*')
        .eq('thread_row_id', activeThreadId)
        .order('created_at', { ascending: true });

      if (error) throw error;
      setMessages(data || []);
    } catch (error) {
      console.error('Error fetching messages:', error);
      toast.error('Failed to load messages');
    } finally {
      setIsLoading(false);
    }
  }, [activeThreadId]);

  // Create a new thread (clears existing and creates fresh one)
  const createThread = useCallback(async (title = 'New Chat') => {
    if (!promptRowId) return null;

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const rootId = await computeRootPromptId(promptRowId);

      // Deactivate any existing active thread for this family
      await supabase
        .from('q_threads')
        .update({ is_active: false })
        .eq('root_prompt_row_id', rootId)
        .eq('owner_id', user.id)
        .eq('is_active', true);

      // Create new thread
      const { data, error } = await supabase
        .from('q_threads')
        .insert({
          root_prompt_row_id: rootId,
          name: title,
          owner_id: user.id,
          is_active: true,
          openai_conversation_id: `pending-${Date.now()}`
        })
        .select()
        .single();

      if (error) throw error;
      
      setThreads([data]);
      setActiveThreadId(data.row_id);
      setMessages([]);
      
      return data;
    } catch (error) {
      console.error('Error creating thread:', error);
      toast.error('Failed to create new chat');
      return null;
    }
  }, [promptRowId, computeRootPromptId]);

  // Switch to a different thread
  const switchThread = useCallback((threadId) => {
    setActiveThreadId(threadId);
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

      setThreads(prev => prev.filter(t => t.row_id !== threadId));
      
      if (activeThreadId === threadId) {
        const remaining = threads.filter(t => t.row_id !== threadId);
        setActiveThreadId(remaining[0]?.row_id || null);
      }
      
      toast.success('Conversation cleared');
      return true;
    } catch (error) {
      console.error('Error deleting thread:', error);
      toast.error('Failed to delete chat');
      return false;
    }
  }, [activeThreadId, threads]);

  // Add a message to local state only (messages are stored in OpenAI's chain now)
  const addMessage = useCallback((role, content, toolCalls = null) => {
    if (!activeThreadId) return null;

    // Just add to local state - messages are in OpenAI's Responses API chain
    const localMsg = {
      row_id: `local-${Date.now()}`,
      thread_row_id: activeThreadId,
      role,
      content,
      tool_calls: toolCalls,
      created_at: new Date().toISOString()
    };
    
    setMessages(prev => [...prev, localMsg]);
    return localMsg;
  }, [activeThreadId]);

  // Clear messages - creates a new thread (clears OpenAI conversation chain)
  const clearMessages = useCallback(async () => {
    if (!promptRowId) return false;

    try {
      // Create new thread which clears the conversation chain
      await createThread('New Chat');
      toast.success('Conversation cleared');
      return true;
    } catch (error) {
      console.error('Error clearing messages:', error);
      toast.error('Failed to clear conversation');
      return false;
    }
  }, [promptRowId, createThread]);

  // Send a message and get AI response
  const sendMessage = useCallback(async (userMessage) => {
    if (!activeThreadId || !userMessage.trim() || !promptRowId) return null;

    // Add user message to UI immediately
    const userMsg = await addMessage('user', userMessage);
    if (!userMsg) return null;

    setIsStreaming(true);
    setStreamingMessage('');
    setToolActivity([]);
    setIsExecutingTools(false);

    // Track prompt family message sent
    trackEvent('prompt_family_message_sent', {
      prompt_id: promptRowId,
      thread_id: activeThreadId,
      message_length: userMessage.length,
    });

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error('Not authenticated');

      // Prepare messages for API
      const apiMessages = messages.map(m => ({
        role: m.role,
        content: m.content
      }));
      apiMessages.push({ role: 'user', content: userMessage });

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/prompt-family-chat`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`
          },
          body: JSON.stringify({
            thread_row_id: activeThreadId,
            prompt_row_id: promptRowId,
            messages: apiMessages
          })
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || 'Failed to get response');
      }

      // Handle streaming response
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
              
              // Handle tool activity events
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
              
              // Handle OpenAI streaming format
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

      // Save assistant message
      await addMessage('assistant', fullContent);
      setStreamingMessage('');
      setIsStreaming(false);
      setToolActivity([]);
      setIsExecutingTools(false);

      // Update thread timestamp
      await supabase
        .from('q_threads')
        .update({ last_message_at: new Date().toISOString() })
        .eq('row_id', activeThreadId);

      // Track successful response
      trackEvent('prompt_family_response_received', {
        prompt_id: promptRowId,
        thread_id: activeThreadId,
        response_length: fullContent.length,
      });

      return fullContent;
    } catch (error) {
      console.error('Error sending message:', error);
      toast.error(error.message || 'Failed to get AI response');
      setStreamingMessage('');
      setIsStreaming(false);
      setToolActivity([]);
      setIsExecutingTools(false);
      
      // Track error
      trackException(error, { context: 'prompt_family_chat' });
      
      return null;
    }
  }, [activeThreadId, promptRowId, messages, addMessage]);

  // Effects
  useEffect(() => {
    fetchThreads();
  }, [fetchThreads]);

  useEffect(() => {
    fetchMessages();
  }, [fetchMessages]);

  // Reset when prompt changes
  useEffect(() => {
    setActiveThreadId(null);
    setMessages([]);
    setStreamingMessage('');
    setToolActivity([]);
  }, [promptRowId]);

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
    setMessages
  };
};
