import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/components/ui/sonner';

export const useWorkbenchMessages = () => {
  const [messages, setMessages] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingMessage, setStreamingMessage] = useState('');
  const [toolActivity, setToolActivity] = useState([]);
  const [isExecutingTools, setIsExecutingTools] = useState(false);

  const fetchMessages = useCallback(async (threadRowId) => {
    if (!threadRowId) {
      setMessages([]);
      return;
    }

    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('q_workbench_messages')
        .select('*')
        .eq('thread_row_id', threadRowId)
        .order('created_at', { ascending: true });

      if (error) throw error;
      setMessages(data || []);
    } catch (error) {
      console.error('Error fetching messages:', error);
      toast.error('Failed to load messages');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const addMessage = useCallback(async (threadRowId, role, content, toolCalls = null) => {
    if (!threadRowId) return null;

    try {
      const { data, error } = await supabase
        .from('q_workbench_messages')
        .insert({
          thread_row_id: threadRowId,
          role,
          content,
          tool_calls: toolCalls
        })
        .select()
        .single();

      if (error) throw error;

      setMessages(prev => [...prev, data]);
      return data;
    } catch (error) {
      console.error('Error adding message:', error);
      toast.error('Failed to save message');
      return null;
    }
  }, []);

  const clearMessages = useCallback(async (threadRowId) => {
    if (!threadRowId) return false;

    try {
      const { error } = await supabase
        .from('q_workbench_messages')
        .delete()
        .eq('thread_row_id', threadRowId);

      if (error) throw error;

      setMessages([]);
      toast.success('Messages cleared');
      return true;
    } catch (error) {
      console.error('Error clearing messages:', error);
      toast.error('Failed to clear messages');
      return false;
    }
  }, []);

  const sendMessage = useCallback(async (threadRowId, userMessage, systemPrompt, model) => {
    if (!threadRowId || !userMessage.trim()) return null;

    // Add user message to UI immediately
    const userMsg = await addMessage(threadRowId, 'user', userMessage);
    if (!userMsg) return null;

    setIsStreaming(true);
    setStreamingMessage('');
    setToolActivity([]);
    setIsExecutingTools(false);

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
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/workbench-chat`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`
          },
          body: JSON.stringify({
            thread_row_id: threadRowId,
            messages: apiMessages,
            system_prompt: systemPrompt,
            model
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
          
          // Keep the last potentially incomplete line in buffer
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
              
              // Handle OpenAI streaming format: choices[0].delta.content
              const deltaContent = parsed.choices?.[0]?.delta?.content;
              if (deltaContent) {
                fullContent += deltaContent;
                setStreamingMessage(fullContent);
              }
              
              // Handle error in response
              if (parsed.error) {
                throw new Error(parsed.error.message || parsed.error);
              }
            } catch (e) {
              // Only warn for non-parse errors
              if (e.message && !e.message.includes('JSON')) {
                console.warn('SSE parse warning:', e);
              }
            }
          }
        }
      }

      // Save assistant message
      const assistantMsg = await addMessage(threadRowId, 'assistant', fullContent);
      setStreamingMessage('');
      setIsStreaming(false);
      setToolActivity([]);
      setIsExecutingTools(false);

      return assistantMsg;
    } catch (error) {
      console.error('Error sending message:', error);
      toast.error(error.message || 'Failed to get AI response');
      setStreamingMessage('');
      setIsStreaming(false);
      setToolActivity([]);
      setIsExecutingTools(false);
      return null;
    }
  }, [messages, addMessage]);

  return {
    messages,
    isLoading,
    isStreaming,
    streamingMessage,
    toolActivity,
    isExecutingTools,
    fetchMessages,
    addMessage,
    clearMessages,
    sendMessage,
    setMessages
  };
};
