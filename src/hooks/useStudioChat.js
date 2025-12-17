import { useState, useEffect, useCallback } from 'react';
import { useSupabase } from './useSupabase';
import { toast } from 'sonner';

export const useStudioChat = () => {
  const supabase = useSupabase();
  const [assistantPrompts, setAssistantPrompts] = useState([]);
  const [selectedAssistantId, setSelectedAssistantId] = useState(null);
  const [selectedAssistant, setSelectedAssistant] = useState(null);
  const [threads, setThreads] = useState([]);
  const [activeThread, setActiveThread] = useState(null);
  const [messages, setMessages] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingAssistants, setIsLoadingAssistants] = useState(true);
  const [isLoadingThreads, setIsLoadingThreads] = useState(false);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const [isSending, setIsSending] = useState(false);

  // Fetch all assistant prompts (top-level prompts with is_assistant=true)
  const fetchAssistantPrompts = useCallback(async () => {
    if (!supabase) return;

    setIsLoadingAssistants(true);
    try {
      const { data: prompts, error } = await supabase
        .from('cyg_prompts')
        .select(`
          row_id,
          prompt_name,
          is_assistant,
          cyg_assistants!cyg_assistants_prompt_row_id_fkey(
            row_id,
            name,
            status,
            openai_assistant_id,
            instructions
          )
        `)
        .eq('is_assistant', true)
        .eq('is_deleted', false)
        .is('parent_row_id', null)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Transform to include assistant info
      const assistantsWithPrompts = prompts
        .filter(p => p.cyg_assistants)
        .map(p => ({
          promptRowId: p.row_id,
          promptName: p.prompt_name,
          assistant: p.cyg_assistants,
        }));

      setAssistantPrompts(assistantsWithPrompts);
    } catch (error) {
      console.error('Error fetching assistant prompts:', error);
      toast.error('Failed to fetch assistants');
    } finally {
      setIsLoadingAssistants(false);
    }
  }, [supabase]);

  // Fetch threads for selected assistant (Studio threads only - child_prompt_row_id is null)
  const fetchThreads = useCallback(async (assistantRowId) => {
    if (!supabase || !assistantRowId) return;

    setIsLoadingThreads(true);
    try {
      const { data, error } = await supabase
        .from('cyg_threads')
        .select('*')
        .eq('assistant_row_id', assistantRowId)
        .is('child_prompt_row_id', null) // Studio threads only
        .order('last_message_at', { ascending: false, nullsFirst: false });

      if (error) throw error;
      setThreads(data || []);

      // Auto-select first thread if available
      if (data && data.length > 0 && !activeThread) {
        setActiveThread(data[0]);
      }
    } catch (error) {
      console.error('Error fetching threads:', error);
    } finally {
      setIsLoadingThreads(false);
    }
  }, [supabase, activeThread]);

  // Fetch messages for active thread
  const fetchMessages = useCallback(async (threadRowId) => {
    if (!supabase || !threadRowId) return;

    setIsLoadingMessages(true);
    try {
      const { data, error } = await supabase.functions.invoke('thread-manager', {
        body: {
          action: 'get_messages',
          thread_row_id: threadRowId,
          limit: 100,
        },
      });

      if (error) throw error;
      if (data.error) throw new Error(data.error);

      setMessages(data.messages || []);
    } catch (error) {
      console.error('Error fetching messages:', error);
      setMessages([]);
    } finally {
      setIsLoadingMessages(false);
    }
  }, [supabase]);

  // Select an assistant
  const selectAssistant = useCallback((promptRowId) => {
    const assistant = assistantPrompts.find(a => a.promptRowId === promptRowId);
    if (assistant) {
      setSelectedAssistantId(promptRowId);
      setSelectedAssistant(assistant);
      setActiveThread(null);
      setMessages([]);
      setThreads([]);
      
      if (assistant.assistant?.row_id) {
        fetchThreads(assistant.assistant.row_id);
      }
    }
  }, [assistantPrompts, fetchThreads]);

  // Switch to a thread
  const switchThread = useCallback((threadRowId) => {
    const thread = threads.find(t => t.row_id === threadRowId);
    if (thread) {
      setActiveThread(thread);
      fetchMessages(threadRowId);
    }
  }, [threads, fetchMessages]);

  // Create a new thread
  const createThread = useCallback(async () => {
    if (!supabase || !selectedAssistant?.assistant?.row_id) return null;

    try {
      const { data, error } = await supabase.functions.invoke('thread-manager', {
        body: {
          action: 'create',
          assistant_row_id: selectedAssistant.assistant.row_id,
          child_prompt_row_id: null, // Studio thread
          name: `Studio Chat ${new Date().toLocaleDateString()}`,
        },
      });

      if (error) throw error;
      if (data.error) throw new Error(data.error);

      const newThread = data.thread;
      setThreads(prev => [newThread, ...prev]);
      setActiveThread(newThread);
      setMessages([]);
      toast.success('New thread created');
      return newThread;
    } catch (error) {
      console.error('Error creating thread:', error);
      toast.error('Failed to create thread');
      return null;
    }
  }, [supabase, selectedAssistant]);

  // Delete a thread
  const deleteThread = useCallback(async (threadRowId) => {
    if (!supabase) return false;

    try {
      const { data, error } = await supabase.functions.invoke('thread-manager', {
        body: {
          action: 'delete',
          thread_row_id: threadRowId,
        },
      });

      if (error) throw error;
      if (data.error) throw new Error(data.error);

      setThreads(prev => prev.filter(t => t.row_id !== threadRowId));
      if (activeThread?.row_id === threadRowId) {
        setActiveThread(null);
        setMessages([]);
      }
      toast.success('Thread deleted');
      return true;
    } catch (error) {
      console.error('Error deleting thread:', error);
      toast.error('Failed to delete thread');
      return false;
    }
  }, [supabase, activeThread]);

  // Send a message
  const sendMessage = useCallback(async (userMessage) => {
    if (!supabase || !selectedAssistant?.assistant?.row_id || !userMessage.trim()) {
      return null;
    }

    setIsSending(true);

    // Optimistically add user message to UI
    const tempUserMessage = {
      id: `temp-${Date.now()}`,
      role: 'user',
      content: userMessage,
      created_at: new Date().toISOString(),
    };
    setMessages(prev => [...prev, tempUserMessage]);

    try {
      const { data, error } = await supabase.functions.invoke('studio-chat', {
        body: {
          assistant_row_id: selectedAssistant.assistant.row_id,
          user_message: userMessage,
          thread_row_id: activeThread?.row_id || null,
          include_child_context: true,
        },
      });

      if (error) throw error;
      if (data.error) throw new Error(data.error);

      // If this created a new thread, update state
      if (!activeThread && data.thread_row_id) {
        const newThread = {
          row_id: data.thread_row_id,
          openai_thread_id: data.thread_id,
          name: `Studio Chat ${new Date().toLocaleDateString()}`,
          created_at: new Date().toISOString(),
          last_message_at: new Date().toISOString(),
        };
        setThreads(prev => [newThread, ...prev]);
        setActiveThread(newThread);
      }

      // Add assistant response
      const assistantMessage = {
        id: `assistant-${Date.now()}`,
        role: 'assistant',
        content: data.response,
        created_at: new Date().toISOString(),
      };
      setMessages(prev => [...prev, assistantMessage]);

      // Log context included
      if (data.context_included?.length > 0) {
        console.log('Context included from:', data.context_included);
      }

      return data;
    } catch (error) {
      console.error('Error sending message:', error);
      toast.error(error.message || 'Failed to send message');
      // Remove optimistic message on error
      setMessages(prev => prev.filter(m => m.id !== tempUserMessage.id));
      return null;
    } finally {
      setIsSending(false);
    }
  }, [supabase, selectedAssistant, activeThread]);

  // Initial fetch
  useEffect(() => {
    fetchAssistantPrompts();
  }, [fetchAssistantPrompts]);

  // Fetch messages when active thread changes
  useEffect(() => {
    if (activeThread?.row_id) {
      fetchMessages(activeThread.row_id);
    }
  }, [activeThread?.row_id, fetchMessages]);

  return {
    assistantPrompts,
    selectedAssistant,
    selectedAssistantId,
    threads,
    activeThread,
    messages,
    isLoading: isLoadingAssistants,
    isLoadingThreads,
    isLoadingMessages,
    isSending,
    selectAssistant,
    switchThread,
    createThread,
    deleteThread,
    sendMessage,
    refetchAssistants: fetchAssistantPrompts,
  };
};
