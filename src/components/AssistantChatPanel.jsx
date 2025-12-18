import React, { useState, useEffect, useCallback } from 'react';
import { useSupabase } from '@/hooks/useSupabase';
import { toast } from 'sonner';
import { Bot, Plus, Trash2, MessageSquare, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';
import StudioChat from './StudioChat';

const AssistantChatPanel = ({ promptRowId, promptName }) => {
  const supabase = useSupabase();
  const [assistant, setAssistant] = useState(null);
  const [threads, setThreads] = useState([]);
  const [activeThread, setActiveThread] = useState(null);
  const [messages, setMessages] = useState([]);
  const [isLoadingAssistant, setIsLoadingAssistant] = useState(true);
  const [isLoadingThreads, setIsLoadingThreads] = useState(false);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const [isSending, setIsSending] = useState(false);

  // Fetch assistant for this prompt
  const fetchAssistant = useCallback(async () => {
    if (!supabase || !promptRowId) return;

    setIsLoadingAssistant(true);
    try {
      const { data, error } = await supabase
        .from('cyg_assistants')
        .select('*')
        .eq('prompt_row_id', promptRowId)
        .single();

      if (error) throw error;
      setAssistant(data);
    } catch (error) {
      console.error('Failed to fetch assistant:', error);
      setAssistant(null);
    } finally {
      setIsLoadingAssistant(false);
    }
  }, [supabase, promptRowId]);

  // Fetch threads for this assistant (studio threads only - child_prompt_row_id is null)
  const fetchThreads = useCallback(async (assistantRowId) => {
    if (!supabase || !assistantRowId) return;

    setIsLoadingThreads(true);
    try {
      const { data, error } = await supabase
        .from('cyg_threads')
        .select('*')
        .eq('assistant_row_id', assistantRowId)
        .is('child_prompt_row_id', null)
        .order('last_message_at', { ascending: false, nullsFirst: false });

      if (error) throw error;
      setThreads(data || []);

      // Auto-select first thread
      if (data && data.length > 0 && !activeThread) {
        setActiveThread(data[0]);
      }
    } catch (error) {
      console.error('Failed to fetch threads:', error);
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
      console.error('Failed to fetch messages:', error);
      setMessages([]);
    } finally {
      setIsLoadingMessages(false);
    }
  }, [supabase]);

  // Create new thread
  const createThread = useCallback(async () => {
    if (!supabase || !assistant?.row_id) return;

    try {
      const { data, error } = await supabase.functions.invoke('thread-manager', {
        body: {
          action: 'create',
          assistant_row_id: assistant.row_id,
          child_prompt_row_id: null,
          name: `Chat ${new Date().toLocaleDateString()}`,
        },
      });

      if (error) throw error;
      if (data.error) throw new Error(data.error);

      const newThread = data.thread;
      setThreads(prev => [newThread, ...prev]);
      setActiveThread(newThread);
      setMessages([]);
      toast.success('New thread created');
    } catch (error) {
      console.error('Failed to create thread:', error);
      toast.error('Failed to create thread');
    }
  }, [supabase, assistant]);

  // Delete thread
  const deleteThread = useCallback(async (threadRowId) => {
    if (!supabase) return;

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
    } catch (error) {
      console.error('Failed to delete thread:', error);
      toast.error('Failed to delete thread');
    }
  }, [supabase, activeThread]);

  // Switch thread
  const switchThread = useCallback((threadRowId) => {
    const thread = threads.find(t => t.row_id === threadRowId);
    if (thread) {
      setActiveThread(thread);
      fetchMessages(threadRowId);
    }
  }, [threads, fetchMessages]);

  // Send message
  const sendMessage = useCallback(async (userMessage) => {
    if (!supabase || !assistant?.row_id || !userMessage.trim()) return;

    setIsSending(true);

    // Optimistic update
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
          assistant_row_id: assistant.row_id,
          user_message: userMessage,
          thread_row_id: activeThread?.row_id || null,
          include_child_context: true,
        },
      });

      if (error) throw error;
      if (data.error) throw new Error(data.error);

      // If new thread was created
      if (!activeThread && data.thread_row_id) {
        const newThread = {
          row_id: data.thread_row_id,
          openai_thread_id: data.thread_id,
          name: `Chat ${new Date().toLocaleDateString()}`,
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
    } catch (error) {
      console.error('Failed to send message:', error);
      toast.error(error.message || 'Failed to send message');
      // Remove optimistic message
      setMessages(prev => prev.filter(m => m.id !== tempUserMessage.id));
    } finally {
      setIsSending(false);
    }
  }, [supabase, assistant, activeThread]);

  // Initial fetch
  useEffect(() => {
    fetchAssistant();
  }, [fetchAssistant]);

  // Fetch threads when assistant changes
  useEffect(() => {
    if (assistant?.row_id && assistant.status === 'active') {
      fetchThreads(assistant.row_id);
    } else {
      setThreads([]);
      setActiveThread(null);
      setMessages([]);
    }
  }, [assistant?.row_id, assistant?.status, fetchThreads]);

  // Fetch messages when active thread changes
  useEffect(() => {
    if (activeThread?.row_id) {
      fetchMessages(activeThread.row_id);
    }
  }, [activeThread?.row_id, fetchMessages]);

  if (isLoadingAssistant) {
    return (
      <div className="h-full flex items-center justify-center border-l border-border">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!assistant || assistant.status !== 'active') {
    return (
      <div className="h-full flex items-center justify-center border-l border-border bg-muted/30">
        <div className="text-center text-muted-foreground p-8">
          <Bot className="h-12 w-12 mx-auto mb-3 opacity-50" />
          <p className="font-medium">Assistant Not Active</p>
          <p className="text-sm mt-1">
            {assistant?.status === 'destroyed' 
              ? 'Re-enable the assistant to start chatting'
              : 'Wait for the assistant to be instantiated'}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex border-l border-border">
      {/* Thread sidebar */}
      <div className="w-48 border-r border-border bg-muted/30 flex flex-col">
        <div className="p-3 border-b border-border flex items-center justify-between">
          <span className="text-xs font-medium text-muted-foreground">Threads</span>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" className="h-6 w-6" onClick={createThread}>
                  <Plus className="h-3 w-3" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>New Thread</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
        <ScrollArea className="flex-1">
          <div className="p-2 space-y-1">
            {isLoadingThreads ? (
              [1, 2].map(i => <Skeleton key={i} className="h-12 w-full" />)
            ) : threads.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-4">No threads yet</p>
            ) : (
              threads.map(thread => (
                <div
                  key={thread.row_id}
                  onClick={() => switchThread(thread.row_id)}
                  className={cn(
                    'group flex items-start gap-2 px-2 py-1.5 rounded cursor-pointer text-sm',
                    activeThread?.row_id === thread.row_id
                      ? 'bg-primary/10 text-primary'
                      : 'hover:bg-muted/50'
                  )}
                >
                  <MessageSquare className="h-3 w-3 mt-0.5 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-medium truncate">{thread.name || 'Untitled'}</div>
                    {thread.last_message_at && (
                      <div className="text-[10px] text-muted-foreground">
                        {formatDistanceToNow(new Date(thread.last_message_at), { addSuffix: true })}
                      </div>
                    )}
                  </div>
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-5 w-5 opacity-0 group-hover:opacity-100"
                          onClick={(e) => { e.stopPropagation(); deleteThread(thread.row_id); }}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Delete Thread</TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
              ))
            )}
          </div>
        </ScrollArea>
      </div>

      {/* Chat area */}
      <div className="flex-1">
        <StudioChat
          messages={messages}
          onSendMessage={sendMessage}
          isLoadingMessages={isLoadingMessages}
          isSending={isSending}
          disabled={false}
          placeholder={`Message ${promptName || 'Assistant'}...`}
        />
      </div>
    </div>
  );
};

export default AssistantChatPanel;