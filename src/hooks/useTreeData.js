import { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';

const useTreeData = (supabase) => {
  const [treeData, setTreeData] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchPrompts = useCallback(async (parentRowId = null, level = 1) => {
    if (!supabase) return [];
    try {
      let query = supabase
        .from('prompts')
        .select('row_id, parent_row_id, prompt_name, note, created, level')
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
        const children = await fetchPrompts(prompt.row_id, level + 1);
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
      let level = 1;
      if (parentId) {
        const { data: parentData, error: parentError } = await supabase
          .from('prompts')
          .select('level')
          .eq('row_id', parentId)
          .single();

        if (parentError) throw parentError;
        level = parentData.level + 1;
      }

      const newItem = {
        parent_row_id: parentId,
        prompt_name: 'New Prompt',
        note: '',
        created: new Date().toISOString(),
        is_deleted: false,
        level: level
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

  const deleteItem = useCallback(async (id) => {
    if (!supabase) return false;
    try {
      const markAsDeleted = async (itemId) => {
        const { error } = await supabase
          .from('prompts')
          .update({ is_deleted: true })
          .eq('row_id', itemId);

        if (error) throw error;

        const { data: children, error: selectError } = await supabase
          .from('prompts')
          .select('row_id')
          .eq('parent_row_id', itemId)
          .eq('is_deleted', false);

        if (selectError) throw selectError;

        for (const child of children) {
          await markAsDeleted(child.row_id);
        }
      };

      await markAsDeleted(id);
      await fetchTreeData();
      return true;
    } catch (error) {
      console.error('Error marking item as deleted:', error);
      toast.error(`Failed to mark item as deleted: ${error.message}`);
      return false;
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

  return { 
    treeData, 
    addItem, 
    deleteItem, 
    updateItemName,
    isLoading,
    refreshTreeData: fetchTreeData
  };
};

export default useTreeData;
