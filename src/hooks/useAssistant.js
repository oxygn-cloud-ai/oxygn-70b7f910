import { useState, useEffect, useCallback, useRef } from 'react';
import { useSupabase } from './useSupabase';
import { toast } from '@/components/ui/sonner';

export const useAssistant = (promptRowId) => {
  const supabase = useSupabase();
  const [assistant, setAssistant] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isInstantiating, setIsInstantiating] = useState(false);
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
        
        const { data: newAssistant, error: createError } = await supabase
          .from(import.meta.env.VITE_ASSISTANTS_TBL)
          .insert({
            prompt_row_id: promptRowId,
            name: prompt?.prompt_name || 'New Assistant',
            instructions: '',
            use_global_tool_defaults: true,
            status: 'not_instantiated',
            api_version: 'assistants', // Default to legacy for backwards compatibility
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

  const instantiate = useCallback(async () => {
    if (!assistant?.row_id) return false;

    setIsInstantiating(true);
    try {
      const { data, error } = await supabase.functions.invoke('assistant-manager', {
        body: { action: 'instantiate', assistant_row_id: assistant.row_id },
      });

      if (error) throw error;
      if (data.error) throw new Error(data.error);

      await fetchAssistant();
      toast.success('Assistant instantiated successfully');
      return true;
    } catch (error) {
      console.error('Error instantiating assistant:', error);
      toast.error(`Failed to instantiate: ${error.message}`);
      return false;
    } finally {
      setIsInstantiating(false);
    }
  }, [supabase, assistant?.row_id, fetchAssistant]);

  const destroy = useCallback(async () => {
    if (!assistant?.row_id) return false;

    try {
      const { data, error } = await supabase.functions.invoke('assistant-manager', {
        body: { action: 'destroy', assistant_row_id: assistant.row_id },
      });

      if (error) throw error;
      if (data.error) throw new Error(data.error);

      await fetchAssistant();
      toast.success('Assistant destroyed');
      return true;
    } catch (error) {
      console.error('Error destroying assistant:', error);
      toast.error(`Failed to destroy: ${error.message}`);
      return false;
    }
  }, [supabase, assistant?.row_id, fetchAssistant]);

  const sync = useCallback(async () => {
    if (!assistant?.row_id) return false;

    try {
      const { data, error } = await supabase.functions.invoke('assistant-manager', {
        body: { action: 'sync', assistant_row_id: assistant.row_id },
      });

      if (error) throw error;
      if (data.error) throw new Error(data.error);

      await fetchAssistant();
      toast.success(data.message || 'Files synced');
      return true;
    } catch (error) {
      console.error('Error syncing assistant:', error);
      toast.error(`Failed to sync: ${error.message}`);
      return false;
    }
  }, [supabase, assistant?.row_id, fetchAssistant]);

  const reInstantiate = useCallback(async () => {
    if (!assistant?.row_id) return false;

    setIsInstantiating(true);
    try {
      const { data, error } = await supabase.functions.invoke('assistant-manager', {
        body: { action: 're-instantiate', assistant_row_id: assistant.row_id },
      });

      if (error) throw error;
      if (data.error) throw new Error(data.error);

      await fetchAssistant();
      toast.success('Assistant re-enabled successfully');
      return true;
    } catch (error) {
      console.error('Error re-instantiating assistant:', error);
      toast.error(`Failed to re-enable: ${error.message}`);
      return false;
    } finally {
      setIsInstantiating(false);
    }
  }, [supabase, assistant?.row_id, fetchAssistant]);

  return {
    assistant,
    isLoading,
    isInstantiating,
    createAssistant,
    updateAssistant,
    instantiate,
    destroy,
    sync,
    reInstantiate,
    refetch: fetchAssistant,
  };
};
