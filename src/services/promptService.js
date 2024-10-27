import { calculatePosition, getInitialPosition } from '../utils/positionUtils';
import { toast } from 'sonner';

const handleSupabaseError = (error, operation) => {
  console.error(`Error ${operation}:`, error);
  if (error.message === 'Failed to fetch') {
    toast.error('Network error: Unable to connect to the database. Please check your internet connection.');
  } else {
    toast.error(`Error ${operation}: ${error.message}`);
  }
  throw error;
};

export const fetchPrompts = async (supabase, parentRowId = null) => {
  try {
    let query = supabase
      .from(import.meta.env.VITE_PROMPTS_TBL)
      .select('row_id, parent_row_id, prompt_name, note, created, position')
      .eq('is_deleted', false)
      .order('position', { ascending: true })
      .order('created', { ascending: true });

    if (parentRowId) {
      query = query.eq('parent_row_id', parentRowId);
    } else {
      query = query.is('parent_row_id', null);
    }

    const { data, error } = await query;

    if (error) throw error;

    const promptsWithChildren = await Promise.all(data.map(async (prompt) => {
      const children = await fetchPrompts(supabase, prompt.row_id);
      return {
        ...prompt,
        id: prompt.row_id,
        name: prompt.prompt_name,
        children: children.length > 0 ? children : undefined
      };
    }));

    return promptsWithChildren;
  } catch (error) {
    handleSupabaseError(error, 'fetching prompts');
  }
};

export const fetchPromptChildren = async (supabase, parentId) => {
  try {
    const children = await fetchPrompts(supabase, parentId);
    return children.map(child => ({
      ...child,
      id: child.row_id,
      name: child.prompt_name
    }));
  } catch (error) {
    handleSupabaseError(error, 'fetching prompt children');
  }
};

export const addPrompt = async (supabase, parentId, defaultAdminPrompt) => {
  try {
    const { data: siblings } = await supabase
      .from(import.meta.env.VITE_PROMPTS_TBL)
      .select('position')
      .eq('parent_row_id', parentId)
      .order('position', { ascending: false })
      .limit(1);

    const lastPosition = siblings?.[0]?.position;
    const newPosition = lastPosition ? calculatePosition(lastPosition, null) : getInitialPosition();

    const { data, error } = await supabase
      .from(import.meta.env.VITE_PROMPTS_TBL)
      .insert({
        parent_row_id: parentId,
        prompt_name: 'New Prompt',
        position: newPosition,
        input_admin_prompt: defaultAdminPrompt,
        frequency_penalty_on: false,
        model_on: true,
        temperature_on: true,
        max_tokens_on: true,
        top_p_on: false,
        presence_penalty_on: false,
        stop_on: false,
        n_on: false,
        logit_bias_on: false,
        o_user_on: false,
        stream: false,
        stream_on: false,
        best_of_on: false,
        logprobs_on: false,
        echo: false,
        echo_on: false,
        suffix_on: false,
        temperature_scaling_on: false,
        prompt_tokens_on: false,
        response_tokens_on: false,
        batch_size_on: false,
        learning_rate_multiplier_on: false,
        n_epochs_on: false,
        validation_file_on: false,
        training_file_on: false,
        engine_on: false,
        input_on: false,
        context_length_on: false,
        custom_finetune_on: false,
        response_format_on: false
      })
      .select()
      .single();

    if (error) throw error;
    return data.row_id;
  } catch (error) {
    handleSupabaseError(error, 'adding new prompt');
  }
};

export const deletePrompt = async (supabase, id) => {
  try {
    const markAsDeleted = async (itemId) => {
      const { error } = await supabase
        .from(import.meta.env.VITE_PROMPTS_TBL)
        .update({ is_deleted: true })
        .eq('row_id', itemId);
      
      if (error) throw error;

      const { data: children, error: childrenError } = await supabase
        .from(import.meta.env.VITE_PROMPTS_TBL)
        .select('row_id')
        .eq('parent_row_iI understand that you're encountering a "ReferenceError: deleteItem is not defined" error in the Projects component. Let's fix this issue by properly implementing the `deleteItem` function and ensuring it's available in the component.

<lov-code>
First, we need to update the `useTreeData` hook to include the `deleteItem` function:

<lov-write file_path="src/hooks/useTreeData.js">
import { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import { fetchPrompts, addPrompt, deletePrompt } from '../services/promptService';
import { retry } from '../utils/retryUtils';

const useTreeData = (supabase) => {
  const [treeData, setTreeData] = useState([]);
  const [defaultAdminPrompt, setDefaultAdminPrompt] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  const fetchTreeData = useCallback(async () => {
    if (!supabase) return;

    try {
      const data = await retry(() => fetchPrompts(supabase), {
        retries: 3,
        delay: 1000
      });
      
      setTreeData(data);

      const { data: settingsData, error: settingsError } = await retry(() => 
        supabase
          .from(import.meta.env.VITE_SETTINGS_TBL)
          .select('def_admin_prompt')
          .single()
      , {
        retries: 3,
        delay: 1000
      });

      if (settingsError) throw settingsError;
      setDefaultAdminPrompt(settingsData?.def_admin_prompt || '');
    } catch (error) {
      console.error('Error fetching tree data:', error);
      toast.error('Network error: Please check your connection and try again');
      setTreeData([]);
    } finally {
      setIsLoading(false);
    }
  }, [supabase]);

  const handleAddItem = useCallback(async (parentId) => {
    if (!supabase) return null;
    try {
      const newItemId = await addPrompt(supabase, parentId, defaultAdminPrompt);
      await fetchTreeData();
      return newItemId;
    } catch (error) {
      console.error('Error adding new prompt:', error);
      toast.error('Failed to add new prompt');
      return null;
    }
  }, [supabase, defaultAdminPrompt, fetchTreeData]);

  const handleDeleteItem = useCallback(async (itemId) => {
    if (!supabase) return false;
    try {
      await deletePrompt(supabase, itemId);
      await fetchTreeData();
      return true;
    } catch (error) {
      console.error('Error deleting prompt:', error);
      toast.error('Failed to delete prompt');
      return false;
    }
  }, [supabase, fetchTreeData]);

  useEffect(() => {
    fetchTreeData();
  }, [fetchTreeData]);

  return { 
    treeData, 
    defaultAdminPrompt, 
    isLoading, 
    refreshTreeData: fetchTreeData,
    addItem: handleAddItem,
    deleteItem: handleDeleteItem
  };
};

export default useTreeData;