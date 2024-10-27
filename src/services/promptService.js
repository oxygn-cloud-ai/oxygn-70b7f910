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
    const promptsTable = import.meta.env.VITE_PROMPTS_TBL;
    
    if (!promptsTable) {
      throw new Error('Prompts table environment variable is not defined');
    }

    let query = supabase
      .from(promptsTable)
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

export const addPrompt = async (supabase, parentId, defaultAdminPrompt) => {
  try {
    const promptsTable = import.meta.env.VITE_PROMPTS_TBL;
    
    if (!promptsTable) {
      throw new Error('Prompts table environment variable is not defined');
    }

    const { data: siblings } = await supabase
      .from(promptsTable)
      .select('position')
      .eq('parent_row_id', parentId)
      .order('position', { ascending: false })
      .limit(1);

    const lastPosition = siblings?.[0]?.position;
    const newPosition = lastPosition ? calculatePosition(lastPosition, null) : getInitialPosition();

    const { data, error } = await supabase
      .from(promptsTable)
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

export const updatePrompt = async (supabase, id, updates) => {
  try {
    const promptsTable = import.meta.env.VITE_PROMPTS_TBL;
    
    if (!promptsTable) {
      throw new Error('Prompts table environment variable is not defined');
    }

    const { error } = await supabase
      .from(promptsTable)
      .update(updates)
      .eq('row_id', id);
    if (error) throw error;
  } catch (error) {
    console.error('Error updating prompt:', error);
    throw error;
  }
};

export const deletePrompt = async (supabase, id) => {
  try {
    const promptsTable = import.meta.env.VITE_PROMPTS_TBL;
    
    if (!promptsTable) {
      throw new Error('Prompts table environment variable is not defined');
    }

    const markAsDeleted = async (itemId) => {
      const { error } = await supabase
        .from(promptsTable)
        .update({ is_deleted: true })
        .eq('row_id', itemId);
      
      if (error) throw error;

      const { data: children, error: childrenError } = await supabase
        .from(promptsTable)
        .select('row_id')
        .eq('parent_row_id', itemId);
      
      if (childrenError) throw childrenError;

      for (const child of children) {
        await markAsDeleted(child.row_id);
      }
    };

    await markAsDeleted(id);
  } catch (error) {
    console.error('Error deleting prompt:', error);
    throw error;
  }
};

export const duplicatePrompt = async (supabase, itemId) => {
  try {
    const promptsTable = import.meta.env.VITE_PROMPTS_TBL;
    
    if (!promptsTable) {
      throw new Error('Prompts table environment variable is not defined');
    }

    const duplicateRecursive = async (id, parentId) => {
      const { data: originalItem } = await supabase
        .from(promptsTable)
        .select('*')
        .eq('row_id', id)
        .single();

      if (!originalItem) throw new Error('Item not found');

      const newItem = { ...originalItem, row_id: undefined, parent_row_id: parentId };
      delete newItem.id;
      newItem.prompt_name = `${newItem.prompt_name} (Copy)`;

      const { data: insertedItem, error: insertError } = await supabase
        .from(promptsTable)
        .insert(newItem)
        .select()
        .single();

      if (insertError) throw insertError;

      const { data: children } = await supabase
        .from(promptsTable)
        .select('row_id')
        .eq('parent_row_id', id);

      for (const child of children) {
        await duplicateRecursive(child.row_id, insertedItem.row_id);
      }

      return insertedItem.row_id;
    };

    const { data: originalItem } = await supabase
      .from(promptsTable)
      .select('parent_row_id')
      .eq('row_id', itemId)
      .single();

    await duplicateRecursive(itemId, originalItem.parent_row_id);
  } catch (error) {
    console.error('Error duplicating prompt:', error);
    throw error;
  }
};

export const movePrompt = async (supabase, itemId, newParentId) => {
  try {
    const promptsTable = import.meta.env.VITE_PROMPTS_TBL;
    
    if (!promptsTable) {
      throw new Error('Prompts table environment variable is not defined');
    }

    const { error } = await supabase
      .from(promptsTable)
      .update({ parent_row_id: newParentId })
      .eq('row_id', itemId);

    if (error) throw error;
  } catch (error) {
    console.error('Error moving prompt:', error);
    throw error;
  }
};