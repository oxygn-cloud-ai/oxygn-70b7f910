import { useState, useEffect, useCallback, useRef } from 'react';
import { useSupabase } from './useSupabase';
import { toast } from '@/components/ui/sonner';

export interface Conversation {
  row_id: string;
  prompt_row_id: string | null;
  name: string | null;
  instructions: string | null;
  use_global_tool_defaults: boolean | null;
  status: string | null;
  api_version: string | null;
  openai_assistant_id?: string | null;
  vector_store_id?: string | null;
  model_override?: string | null;
  temperature_override?: string | null;
  code_interpreter_enabled?: boolean | null;
  file_search_enabled?: boolean | null;
  function_calling_enabled?: boolean | null;
  confluence_enabled?: boolean | null;
  [key: string]: unknown;
}

interface ConversationInitialData {
  name?: string;
  instructions?: string;
}

interface UseConversationReturn {
  conversation: Conversation | null;
  isLoading: boolean;
  createConversation: (initialData?: ConversationInitialData) => Promise<Conversation | null>;
  updateConversation: (updates: Partial<Conversation>) => Promise<boolean>;
  refetch: () => Promise<void>;
}

export const useConversation = (promptRowId: string | null): UseConversationReturn => {
  const supabase = useSupabase();
  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const creatingRef = useRef(false); // Prevent duplicate creation

  const fetchConversation = useCallback(async () => {
    if (!supabase || !promptRowId) {
      setIsLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from(import.meta.env.VITE_ASSISTANTS_TBL)
        .select('*')
        .eq('prompt_row_id', promptRowId)
        .maybeSingle();

      if (error) throw error;
      
      // If no conversation record exists, we need to create one
      if (!data && !creatingRef.current) {
        creatingRef.current = true;
        console.log('No conversation record found, creating one for prompt:', promptRowId);
        
        // Fetch prompt name for the conversation
        const { data: prompt } = await supabase
          .from(import.meta.env.VITE_PROMPTS_TBL)
          .select('prompt_name')
          .eq('row_id', promptRowId)
          .maybeSingle();
        
        // For Responses API, conversations are always "active" - no instantiation needed
        const { data: newConversation, error: createError } = await supabase
          .from(import.meta.env.VITE_ASSISTANTS_TBL)
          .insert({
            prompt_row_id: promptRowId,
            name: prompt?.prompt_name || 'New Conversation',
            instructions: '',
            use_global_tool_defaults: true,
            status: 'active', // Responses API is always ready
            api_version: 'responses',
          })
          .select()
          .maybeSingle();

        if (createError) {
          console.error('Error creating conversation record:', createError);
          creatingRef.current = false;
        } else if (newConversation) {
          console.log('Created conversation record:', newConversation.row_id);
          setConversation(newConversation as Conversation);
          creatingRef.current = false;
        }
      } else {
        setConversation(data as Conversation | null);
      }
    } catch (error) {
      console.error('Error fetching conversation:', error);
      toast.error('Failed to load conversation');
    } finally {
      setIsLoading(false);
    }
  }, [supabase, promptRowId]);

  useEffect(() => {
    creatingRef.current = false; // Reset on promptRowId change
    setIsLoading(true);
    fetchConversation();
  }, [fetchConversation]);

  const createConversation = useCallback(async (initialData: ConversationInitialData = {}): Promise<Conversation | null> => {
    if (!supabase || !promptRowId) return null;

    try {
      const { data, error } = await supabase
        .from(import.meta.env.VITE_ASSISTANTS_TBL)
        .insert({
          prompt_row_id: promptRowId,
          name: initialData.name || 'New Conversation',
          instructions: initialData.instructions || '',
          use_global_tool_defaults: true,
          status: 'active', // Responses API is always ready
          api_version: 'responses',
        })
        .select()
        .maybeSingle();

      if (error) throw error;
      setConversation(data as Conversation);
      return data as Conversation;
    } catch (error) {
      console.error('Error creating conversation:', error);
      toast.error('Failed to create conversation');
      return null;
    }
  }, [supabase, promptRowId]);

  const updateConversation = useCallback(async (updates: Partial<Conversation>): Promise<boolean> => {
    if (!supabase || !conversation?.row_id) return false;

    try {
      const { error } = await supabase
        .from(import.meta.env.VITE_ASSISTANTS_TBL)
        .update(updates)
        .eq('row_id', conversation.row_id);

      if (error) throw error;
      setConversation(prev => prev ? { ...prev, ...updates } : null);
      return true;
    } catch (error) {
      console.error('Error updating conversation:', error);
      toast.error('Failed to update conversation');
      return false;
    }
  }, [supabase, conversation?.row_id]);

  return {
    conversation,
    isLoading,
    createConversation,
    updateConversation,
    refetch: fetchConversation,
  };
};
