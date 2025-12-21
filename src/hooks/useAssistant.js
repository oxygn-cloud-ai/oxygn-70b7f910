import { useState, useEffect, useCallback, useRef } from 'react';
import { useSupabase } from './useSupabase';
import { toast } from '@/components/ui/sonner';

export const useAssistant = (promptRowId) => {
  const supabase = useSupabase();
  const [assistant, setAssistant] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const creatingRef = useRef(false); // Prevent duplicate creation

  const fetchAssistant = useCallback(async () => {
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
      
      // If no assistant record exists, we need to create one
      if (!data && !creatingRef.current) {
        creatingRef.current = true;
        console.log('No assistant record found, creating one for prompt:', promptRowId);
        
        // Fetch prompt name for the assistant
        const { data: prompt } = await supabase
          .from(import.meta.env.VITE_PROMPTS_TBL)
          .select('prompt_name')
          .eq('row_id', promptRowId)
          .single();
        
        // For Responses API, assistants are always "active" - no instantiation needed
        const { data: newAssistant, error: createError } = await supabase
          .from(import.meta.env.VITE_ASSISTANTS_TBL)
          .insert({
            prompt_row_id: promptRowId,
            name: prompt?.prompt_name || 'New Assistant',
            instructions: '',
            use_global_tool_defaults: true,
            status: 'active', // Responses API is always ready
            api_version: 'responses',
          })
          .select()
          .single();

        if (createError) {
          console.error('Error creating assistant record:', createError);
          creatingRef.current = false;
        } else {
          console.log('Created assistant record:', newAssistant.row_id);
          setAssistant(newAssistant);
          creatingRef.current = false;
        }
      } else {
        setAssistant(data);
      }
    } catch (error) {
      console.error('Error fetching assistant:', error);
    } finally {
      setIsLoading(false);
    }
  }, [supabase, promptRowId]);

  useEffect(() => {
    creatingRef.current = false; // Reset on promptRowId change
    setIsLoading(true);
    fetchAssistant();
  }, [fetchAssistant]);

  const createAssistant = useCallback(async (initialData = {}) => {
    if (!supabase || !promptRowId) return null;

    try {
      const { data, error } = await supabase
        .from(import.meta.env.VITE_ASSISTANTS_TBL)
        .insert({
          prompt_row_id: promptRowId,
          name: initialData.name || 'New Assistant',
          instructions: initialData.instructions || '',
          use_global_tool_defaults: true,
          status: 'active', // Responses API is always ready
          api_version: 'responses',
        })
        .select()
        .single();

      if (error) throw error;
      setAssistant(data);
      return data;
    } catch (error) {
      console.error('Error creating assistant:', error);
      toast.error('Failed to create assistant');
      return null;
    }
  }, [supabase, promptRowId]);

  const updateAssistant = useCallback(async (updates) => {
    if (!supabase || !assistant?.row_id) return false;

    try {
      const { error } = await supabase
        .from(import.meta.env.VITE_ASSISTANTS_TBL)
        .update(updates)
        .eq('row_id', assistant.row_id);

      if (error) throw error;
      setAssistant(prev => ({ ...prev, ...updates }));
      return true;
    } catch (error) {
      console.error('Error updating assistant:', error);
      toast.error('Failed to update assistant');
      return false;
    }
  }, [supabase, assistant?.row_id]);

  return {
    assistant,
    isLoading,
    createAssistant,
    updateAssistant,
    refetch: fetchAssistant,
  };
};
