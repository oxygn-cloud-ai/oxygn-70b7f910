// @ts-nocheck
import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { ChatMessage } from '@/types/chat';

export interface UsePromptFamilyChatMessagesReturn {
  messages: ChatMessage[];
  setMessages: React.Dispatch<React.SetStateAction<ChatMessage[]>>;
  addMessage: (role: 'user' | 'assistant', content: string, threadId: string) => ChatMessage | null;
  clearMessages: () => void;
  fetchMessages: (threadId: string) => Promise<ChatMessage[]>;
}

export function usePromptFamilyChatMessages(): UsePromptFamilyChatMessagesReturn {
  const [messages, setMessages] = useState<ChatMessage[]>([]);

  // Add a message to local state only
  const addMessage = useCallback((
    role: 'user' | 'assistant', 
    content: string, 
    threadId: string
  ): ChatMessage | null => {
    if (!threadId) {
      console.warn('[usePromptFamilyChatMessages] addMessage failed: no threadId');
      return null;
    }

    const localMsg: ChatMessage = {
      row_id: `local-${crypto.randomUUID()}`,
      thread_row_id: threadId,
      role,
      content,
      created_at: new Date().toISOString()
    };
    
    setMessages(prev => [...prev, localMsg]);
    return localMsg;
  }, []);

  // Clear all messages
  const clearMessages = useCallback(() => {
    setMessages([]);
  }, []);

  // Fetch messages for a thread from OpenAI via thread-manager
  const fetchMessages = useCallback(async (threadId: string): Promise<ChatMessage[]> => {
    if (!threadId) {
      return [];
    }

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      const response = await supabase.functions.invoke('thread-manager', {
        body: {
          action: 'get_messages',
          thread_row_id: threadId,
          limit: 100,
        }
      });

      if (response.error) throw response.error;
      
      const fetchedMessages = (response.data?.messages || []).map((m: { id: string; role: 'user' | 'assistant'; content: string; created_at?: string }) => ({
        row_id: m.id,
        role: m.role as 'user' | 'assistant',
        content: m.content,
        created_at: m.created_at,
      }));
      
      setMessages(fetchedMessages);
      return fetchedMessages;
    } catch (error) {
      console.error('Error fetching messages:', error);
      setMessages([]);
      return [];
    }
  }, []);

  return {
    messages,
    setMessages,
    addMessage,
    clearMessages,
    fetchMessages,
  };
}
