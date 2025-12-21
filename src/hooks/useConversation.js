import { useState, useEffect, useCallback, useRef } from 'react';
import { useSupabase } from './useSupabase';
import { toast } from '@/components/ui/sonner';

export const useConversation = (promptRowId) => {
  const supabase = useSupabase();
  const [conversation, setConversation] = useState(null);
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
          .single();
        
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
          .single();

        if (createError) {
          console.error('Error creating conversation record:', createError);
          creatingRef.current = false;
        } else {
          console.log('Created conversation record:', newConversation.row_id);
          setConversation(newConversation);
          creatingRef.current = false;
        }
      } else {
        setConversation(data);
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

  const createConversation = useCallback(async (initialData = {}) => {
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
        .single();

      if (error) throw error;
      setConversation(data);
      return data;
    } catch (error) {
      console.error('Error creating conversation:', error);
      toast.error('Failed to create conversation');
      return null;
    }
  }, [supabase, promptRowId]);

  const updateConversation = useCallback(async (updates) => {
    if (!supabase || !conversation?.row_id) return false;

    try {
      const { error } = await supabase
        .from(import.meta.env.VITE_ASSISTANTS_TBL)
        .update(updates)
        .eq('row_id', conversation.row_id);

      if (error) throw error;
      setConversation(prev => ({ ...prev, ...updates }));
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
