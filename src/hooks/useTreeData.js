import { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';

const useTreeData = (supabase) => {
  const [treeData, setTreeData] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [defaultAdminPrompt, setDefaultAdminPrompt] = useState('');

  const fetchPrompts = useCallback(async (parentRowId = null) => {
    if (!supabase) return [];
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
        const children = await fetchPrompts(prompt.row_id);
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
      return [];
    }
  }, [supabase]);

  const fetchTreeData = useCallback(async () => {
    if (!supabase) return;
    setIsLoading(true);
    try {
      const data = await fetchPrompts();
      setTreeData(data);

      // Fetch default admin prompt from settings
      const { data: settingsData, error: settingsError } = await supabase
        .from('settings')
        .select('def_admin_prompt')
        .single();

      if (settingsError) throw settingsError;
      setDefaultAdminPrompt(settingsData.def_admin_prompt || '');
    } catch (error) {
      console.error('Error fetching tree data:', error);
      toast.error(`Failed to fetch prompts: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  }, [fetchPrompts, supabase]);

  useEffect(() => {
    if (supabase) {
      fetchTreeData();
    }
  }, [fetchTreeData, supabase]);

  const addItem = useCallback(async (parentId) => {
    if (!supabase) return null;
    try {
      // Fetch the latest def_admin_prompt value
      const { data: settingsData, error: settingsError } = await supabase
        .from('settings')
        .select('def_admin_prompt')
        .single();

      if (settingsError) throw settingsError;

      const latestDefaultAdminPrompt = settingsData.def_admin_prompt || '';

      const newItem = {
        parent_row_id: parentId,
        prompt_name: 'New Prompt',
        note: '',
        created: new Date().toISOString(),
        is_deleted: false,
        input_admin_prompt: latestDefaultAdminPrompt
      };

      const { data, error } = await supabase.from('prompts').insert(newItem).select().single();

      if (error) throw error;

      await fetchTreeData();
      return data.row_id;
    } catch (error) {
      console.error('Error adding new item:', error);
      toast.error(`Failed to add new item: ${error.message}`);
      return null;
    }
  }, [supabase, fetchTreeData]);

  const updateItemName = useCallback(async (id, newName) => {
    if (!supabase) return false;
    try {
      const { error } = await supabase.from('prompts').update({ prompt_name: newName }).eq('row_id', id);

      if (error) throw error;

      await fetchTreeData();
      return true;
    } catch (error) {
      console.error('Error updating item name:', error);
      toast.error(`Failed to update item name: ${error.message}`);
      return false;
    }
  }, [supabase, fetchTreeData]);

  const deleteItem = useCallback(async (id) => {
    if (!supabase) return false;
    try {
      // Mark the item and its children as deleted
      const markAsDeleted = async (itemId) => {
        const { error } = await supabase
          .from('prompts')
          .update({ is_deleted: true })
          .eq('row_id', itemId);
        
        if (error) throw error;

        // Fetch and mark children as deleted
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
      await fetchTreeData();
      toast.success('Item deleted successfully');
      return true;
    } catch (error) {
      console.error('Error deleting item:', error);
      toast.error(`Failed to delete item: ${error.message}`);
      return false;
    }
  }, [supabase, fetchTreeData]);

  const duplicateItem = useCallback(async (itemId) => {
    if (!supabase) return;
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
      await fetchTreeData();
      toast.success('Item duplicated successfully');
    } catch (error) {
      console.error('Error duplicating item:', error);
      toast.error(`Failed to duplicate item: ${error.message}`);
    }
  }, [supabase, fetchTreeData]);

  return { 
    treeData, 
    addItem, 
    updateItemName,
    deleteItem,
    duplicateItem,
    isLoading,
    refreshTreeData: fetchTreeData,
    defaultAdminPrompt
  };
};

export default useTreeData;
