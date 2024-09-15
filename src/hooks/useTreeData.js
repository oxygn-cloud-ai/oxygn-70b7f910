import { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';

const useTreeData = (supabase) => {
  const [treeData, setTreeData] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

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
      const newItem = {
        parent_row_id: parentId,
        prompt_name: 'New Prompt',
        note: '',
        created: new Date().toISOString(),
        is_deleted: false
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

  return { 
    treeData, 
    addItem, 
    updateItemName,
    isLoading,
    refreshTreeData: fetchTreeData
  };
};

export default useTreeData;
