export const fetchPrompts = async (supabase, parentRowId = null) => {
  try {
    let query = supabase
      .from('prompts')
      .select('row_id, parent_row_id, prompt_name, note, created')
      .eq('is_deleted', false)
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
    console.error('Error fetching prompts:', error);
    throw error;
  }
};

export const addPrompt = async (supabase, parentId, defaultAdminPrompt) => {
  try {
    const newItem = {
      parent_row_id: parentId,
      prompt_name: 'New Prompt',
      note: '',
      created: new Date().toISOString(),
      is_deleted: false,
      input_admin_prompt: defaultAdminPrompt
    };

    const { data, error } = await supabase.from('prompts').insert(newItem).select().single();

    if (error) throw error;

    return data.row_id;
  } catch (error) {
    console.error('Error adding new prompt:', error);
    throw error;
  }
};

export const updatePrompt = async (supabase, id, updates) => {
  try {
    const { error } = await supabase.from('prompts').update(updates).eq('row_id', id);
    if (error) throw error;
  } catch (error) {
    console.error('Error updating prompt:', error);
    throw error;
  }
};

export const deletePrompt = async (supabase, id) => {
  try {
    const markAsDeleted = async (itemId) => {
      const { error } = await supabase
        .from('prompts')
        .update({ is_deleted: true })
        .eq('row_id', itemId);
      
      if (error) throw error;

      const { data: children, error: childrenError } = await supabase
        .from('prompts')
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
    const duplicateRecursive = async (id, parentId) => {
      const { data: originalItem } = await supabase
        .from('prompts')
        .select('*')
        .eq('row_id', id)
        .single();

      if (!originalItem) throw new Error('Item not found');

      const newItem = { ...originalItem, row_id: undefined, parent_row_id: parentId };
      delete newItem.id;
      newItem.prompt_name = `${newItem.prompt_name} (Copy)`;

      const { data: insertedItem, error: insertError } = await supabase
        .from('prompts')
        .insert(newItem)
        .select()
        .single();

      if (insertError) throw insertError;

      const { data: children } = await supabase
        .from('prompts')
        .select('row_id')
        .eq('parent_row_id', id);

      for (const child of children) {
        await duplicateRecursive(child.row_id, insertedItem.row_id);
      }

      return insertedItem.row_id;
    };

    const { data: originalItem } = await supabase
      .from('prompts')
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
    const { error } = await supabase
      .from('prompts')
      .update({ parent_row_id: newParentId })
      .eq('row_id', itemId);

    if (error) throw error;
  } catch (error) {
    console.error('Error moving prompt:', error);
    throw error;
  }
};
