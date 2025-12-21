import React, { useState, useEffect, useCallback } from 'react';
import { useSupabase } from '@/hooks/useSupabase';
import { toast } from '@/components/ui/sonner';
import { Bot, Loader2 } from 'lucide-react';
import { useApiCallContext } from '@/contexts/ApiCallContext';

import ChatPanel from './chat/ChatPanel';
import ThreadSidebar from './chat/ThreadSidebar';

const AssistantChatPanel = ({ promptRowId, promptName, selectedChildPromptId }) => {
  const supabase = useSupabase();
  const { registerCall } = useApiCallContext();
  const [assistant, setAssistant] = useState(null);
  const [threads, setThreads] = useState([]);
  const [activeThread, setActiveThread] = useState(null);
  const [messages, setMessages] = useState([]);
  const [isLoadingAssistant, setIsLoadingAssistant] = useState(true);
  const [isLoadingThreads, setIsLoadingThreads] = useState(false);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [selectedChildPromptName, setSelectedChildPromptName] = useState(null);
  const [isThreadsOpen, setIsThreadsOpen] = useState(false);
  const [childPromptsCount, setChildPromptsCount] = useState(0);

  // Fetch child prompts count
  useEffect(() => {
    const fetchChildPromptsCount = async () => {
      if (!supabase || !promptRowId) return;
      try {
        const { count } = await supabase
          .from(import.meta.env.VITE_PROMPTS_TBL)
          .select('*', { count: 'exact', head: true })
          .eq('parent_row_id', promptRowId)
          .eq('is_deleted', false);
        setChildPromptsCount(count || 0);
      } catch {
        setChildPromptsCount(0);
      }
    };
    fetchChildPromptsCount();
  }, [supabase, promptRowId]);

  // Fetch child prompt name when viewing a child prompt
  useEffect(() => {
    const fetchChildPromptName = async () => {
      if (!supabase || !selectedChildPromptId) {
        setSelectedChildPromptName(null);
        return;
      }
      try {
        const { data, error } = await supabase
          .from(import.meta.env.VITE_PROMPTS_TBL)
          .select('prompt_name')
          .eq('row_id', selectedChildPromptId)
          .maybeSingle();
        if (error && error.code !== 'PGRST116') throw error;
        setSelectedChildPromptName(data?.prompt_name ?? null);
      } catch {
        setSelectedChildPromptName(null);
      }
    };
    fetchChildPromptName();
  }, [supabase, selectedChildPromptId]);

  const fetchAssistant = useCallback(async () => {
    if (!supabase || !promptRowId) return;
    setIsLoadingAssistant(true);
    try {
      const { data, error } = await supabase
        .from(import.meta.env.VITE_ASSISTANTS_TBL)
        .select('*')
        .eq('prompt_row_id', promptRowId)
        .maybeSingle();
      if (error && error.code !== 'PGRST116') throw error;
      setAssistant(data ?? null);
    } catch (error) {
      console.error('Failed to fetch assistant:', error);
      setAssistant(null);
    } finally {
      setIsLoadingAssistant(false);
    }
  }, [supabase, promptRowId]);

  const fetchThreads = useCallback(async (assistantRowId) => {
    if (!supabase || !assistantRowId) return;
    setIsLoadingThreads(true);
    try {
      const { data, error } = await supabase
        .from(import.meta.env.VITE_THREADS_TBL)
        .select('*')
        .eq('assistant_row_id', assistantRowId)
        .is('child_prompt_row_id', null)
        .order('last_message_at', { ascending: false, nullsFirst: false });
      if (error) throw error;
      setThreads(data || []);
      if (data && data.length > 0 && !activeThread) {
        setActiveThread(data[0]);
      }
    } catch (error) {
      console.error('Failed to fetch threads:', error);
    } finally {
      setIsLoadingThreads(false);
    }
  }, [supabase, activeThread]);

  const fetchMessages = useCallback(async (threadRowId) => {
    if (!supabase || !threadRowId) return;
    setIsLoadingMessages(true);
    try {
      const { data, error } = await supabase.functions.invoke('thread-manager', {
        body: { action: 'get_messages', thread_row_id: threadRowId, limit: 100 },
      });
      if (error) throw error;
      if (data.error) throw new Error(data.error);
      setMessages(data.messages || []);
    } catch (error) {
      console.error('Failed to fetch messages:', error);
      setMessages([]);
    } finally {
      setIsLoadingMessages(false);
    }
  }, [supabase]);

  const createThread = useCallback(async () => {
    if (!supabase || !assistant?.row_id) return;
    try {
      const { data, error } = await supabase.functions.invoke('thread-manager', {
        body: { action: 'create', assistant_row_id: assistant.row_id, child_prompt_row_id: null, name: `Chat ${new Date().toLocaleDateString()}` },
      });
      if (error) throw error;
      if (data.error) throw new Error(data.error);
      const newThread = data.thread;
      setThreads(prev => [newThread, ...prev]);
      setActiveThread(newThread);
      setMessages([]);
      setIsThreadsOpen(false);
      toast.success('New conversation created');
    } catch (error) {
      console.error('Failed to create thread:', error);
      toast.error('Failed to create conversation');
    }
  }, [supabase, assistant]);

  const deleteThread = useCallback(async (threadRowId) => {
    if (!supabase) return;
    try {
      const { data, error } = await supabase.functions.invoke('thread-manager', {
        body: { action: 'delete', thread_row_id: threadRowId },
      });
      if (error) throw error;
      if (data.error) throw new Error(data.error);
      setThreads(prev => prev.filter(t => t.row_id !== threadRowId));
      if (activeThread?.row_id === threadRowId) {
        setActiveThread(null);
        setMessages([]);
      }
      toast.success('Conversation deleted');
    } catch (error) {
      console.error('Failed to delete thread:', error);
      toast.error('Failed to delete conversation');
    }
  }, [supabase, activeThread]);

  const renameThread = useCallback(async (threadRowId, newName) => {
    if (!supabase) return;
    try {
      const { error } = await supabase
        .from(import.meta.env.VITE_THREADS_TBL)
        .update({ name: newName })
        .eq('row_id', threadRowId);
      if (error) throw error;
      setThreads(prev => prev.map(t => t.row_id === threadRowId ? { ...t, name: newName } : t));
      if (activeThread?.row_id === threadRowId) {
        setActiveThread(prev => ({ ...prev, name: newName }));
      }
      toast.success('Conversation renamed');
    } catch (error) {
      console.error('Failed to rename thread:', error);
      toast.error('Failed to rename conversation');
    }
  }, [supabase, activeThread]);

  const switchThread = useCallback((threadRowId) => {
    const thread = threads.find(t => t.row_id === threadRowId);
    if (thread) {
      setActiveThread(thread);
      fetchMessages(threadRowId);
      setIsThreadsOpen(false);
    }
  }, [threads, fetchMessages]);

  const sendMessage = useCallback(async (userMessage) => {
    if (!supabase || !assistant?.row_id || !userMessage.trim()) return;
    const unregisterCall = registerCall();
    setIsSending(true);
    const tempUserMessage = { id: `temp-${Date.now()}`, role: 'user', content: userMessage, created_at: new Date().toISOString() };
    setMessages(prev => [...prev, tempUserMessage]);
    try {
      const { data, error } = await supabase.functions.invoke('studio-chat', {
        body: { assistant_row_id: assistant.row_id, user_message: userMessage, thread_row_id: activeThread?.row_id || null, include_child_context: true },
      });
      if (error) throw error;
      if (data.error) throw new Error(data.error);
      if (!activeThread && data.thread_row_id) {
        const newThread = { row_id: data.thread_row_id, name: `Chat ${new Date().toLocaleDateString()}`, created_at: new Date().toISOString(), last_message_at: new Date().toISOString() };
        setThreads(prev => [newThread, ...prev]);
        setActiveThread(newThread);
      }
      const assistantMessage = { id: `assistant-${Date.now()}`, role: 'assistant', content: data.response, created_at: new Date().toISOString() };
      setMessages(prev => [...prev, assistantMessage]);
    } catch (error) {
      console.error('Failed to send message:', error);
      toast.error(error.message || 'Failed to send message');
      setMessages(prev => prev.filter(m => m.id !== tempUserMessage.id));
    } finally {
      unregisterCall();
      setIsSending(false);
    }
  }, [supabase, assistant, activeThread, registerCall]);

  useEffect(() => { fetchAssistant(); }, [fetchAssistant]);
  useEffect(() => {
    if (assistant?.row_id) {
      fetchThreads(assistant.row_id);
    } else {
      setThreads([]); setActiveThread(null); setMessages([]);
    }
  }, [assistant?.row_id, fetchThreads]);
  useEffect(() => { if (activeThread?.row_id) fetchMessages(activeThread.row_id); }, [activeThread?.row_id, fetchMessages]);

  if (isLoadingAssistant) {
    return (
      <div className="h-full flex items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  if (!assistant) {
    return (
      <div className="h-full flex items-center justify-center bg-muted/20">
        <div className="text-center text-muted-foreground p-8 max-w-xs">
          <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mx-auto mb-4">
            <Bot className="h-8 w-8 opacity-50" />
          </div>
          <p className="font-medium text-foreground">No Assistant Found</p>
          <p className="text-sm mt-1">Create an assistant to start chatting</p>
        </div>
      </div>
    );
  }

  const contextItems = selectedChildPromptName ? [{ id: selectedChildPromptId, name: selectedChildPromptName }] : [];

  return (
    <div className="h-full flex flex-col overflow-hidden bg-background relative">
      {/* Thread Drawer - positioned relative to chat container */}
      {isThreadsOpen && (
        <>
          {/* Backdrop */}
          <div 
            className="absolute inset-0 bg-black/50 z-40"
            onClick={() => setIsThreadsOpen(false)}
          />
          {/* Drawer panel */}
          <div className="absolute top-0 left-0 w-[60%] min-w-[280px] max-w-[320px] max-h-[70%] z-50 bg-background border-r border-b border-border rounded-br-lg shadow-lg animate-in slide-in-from-top duration-300">
            <ThreadSidebar
              threads={threads}
              activeThread={activeThread}
              isLoading={isLoadingThreads}
              onSelectThread={(id) => {
                switchThread(id);
                setIsThreadsOpen(false);
              }}
              onCreateThread={createThread}
              onDeleteThread={deleteThread}
              onRenameThread={renameThread}
              onClose={() => setIsThreadsOpen(false)}
            />
          </div>
        </>
      )}

      {/* Chat takes full width */}
      <ChatPanel
        messages={messages}
        onSendMessage={sendMessage}
        isLoadingMessages={isLoadingMessages}
        isSending={isSending}
        disabled={false}
        placeholder={`Message ${promptName || 'Assistant'}...`}
        assistantName={promptName || 'Assistant'}
        contextItems={contextItems}
        childPromptsCount={childPromptsCount}
        onToggleThreads={() => setIsThreadsOpen(true)}
        activeThreadName={activeThread?.name}
        threadCount={threads.length}
      />
    </div>
  );
};

export default AssistantChatPanel;