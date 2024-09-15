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
        .select('row_id, parent_row_id, prompt_name, note')
        .order('prompt_name', { ascending: true });

      if (parentRowId) {
        query = query.eq('parent_row_id', parentRowId);
      } else {
        query = query.is('parent_row_id', null);
      }

      console.log('Supabase API Call:', {
        url: query.url.toString(),
        method: 'GET',
        headers: query.headers,
        body: null,
      });

      const { data, error } = await query;

      console.log('Supabase API Response:', {
        status: data ? 200 : 500,
        data: data,
        error: error,
      });

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
        note: ''
      };

      const query = supabase.from('prompts').insert(newItem).select().single();

      console.log('Supabase API Call:', {
        url: query.url.toString(),
        method: 'POST',
        headers: query.headers,
        body: JSON.stringify(newItem),
      });

      const { data, error } = await query;

      console.log('Supabase API Response:', {
        status: data ? 200 : 500,
        data: data,
        error: error,
      });

      if (error) throw error;

      setTreeData(prevData => addItemToChildren(prevData, parentId, {
        id: data.row_id,
        name: data.prompt_name,
        children: []
      }));

      return data.row_id;
    } catch (error) {
      console.error('Error adding new item:', error);
      toast.error(`Failed to add new item: ${error.message}`);
      return null;
    }
  }, [supabase]);

  const deleteItem = useCallback(async (id) => {
    if (!supabase) return false;
    try {
      const deleteRecursively = async (itemId) => {
        const selectQuery = supabase.from('prompts').select('row_id').eq('parent_row_id', itemId);

        console.log('Supabase API Call:', {
          url: selectQuery.url.toString(),
          method: 'GET',
          headers: selectQuery.headers,
          body: null,
        });

        const { data: children, error: selectError } = await selectQuery;

        console.log('Supabase API Response:', {
          status: children ? 200 : 500,
          data: children,
          error: selectError,
        });

        if (selectError) throw selectError;

        for (const child of children) {
          await deleteRecursively(child.row_id);
        }

        const deleteQuery = supabase.from('prompts').delete().eq('row_id', itemId);

        console.log('Supabase API Call:', {
          url: deleteQuery.url.toString(),
          method: 'DELETE',
          headers: deleteQuery.headers,
          body: null,
        });

        const { error: deleteError } = await deleteQuery;

        console.log('Supabase API Response:', {
          status: deleteError ? 500 : 200,
          data: null,
          error: deleteError,
        });

        if (deleteError) throw deleteError;
      };

      await deleteRecursively(id);

      setTreeData(prevData => removeItemFromTree(prevData, id));
      return true;
    } catch (error) {
      console.error('Error deleting item:', error);
      toast.error(`Failed to delete item: ${error.message}`);
      return false;
    }
  }, [supabase]);

  const updateItemName = useCallback(async (id, newName) => {
    if (!supabase) return false;
    try {
      const query = supabase.from('prompts').update({ prompt_name: newName }).eq('row_id', id);

      console.log('Supabase API Call:', {
        url: query.url.toString(),
        method: 'PATCH',
        headers: query.headers,
        body: JSON.stringify({ prompt_name: newName }),
      });

      const { error } = await query;

      console.log('Supabase API Response:', {
        status: error ? 500 : 200,
        data: null,
        error: error,
      });

      if (error) throw error;

      setTreeData(prevData => updateItemInTree(prevData, id, { name: newName }));
      return true;
    } catch (error) {
      console.error('Error updating item name:', error);
      toast.error(`Failed to update item name: ${error.message}`);
      return false;
    }
  }, [supabase]);

  return { 
    treeData, 
    addItem, 
    deleteItem, 
    updateItemName,
    isLoading,
    refreshTreeData: fetchTreeData
  };
};

const addItemToChildren = (items, parentId, newItem) => {
  return items.map(item => {
    if (item.id === parentId) {
      return {
        ...item,
        children: [...(item.children || []), newItem]
      };
    }
    if (item.children) {
      return {
        ...item,
        children: addItemToChildren(item.children, parentId, newItem)
      };
    }
    return item;
  });
};

const removeItemFromTree = (items, idToRemove) => {
  return items.filter(item => item.id !== idToRemove).map(item => {
    if (item.children) {
      return {
        ...item,
        children: removeItemFromTree(item.children, idToRemove)
      };
    }
    return item;
  });
};

const updateItemInTree = (items, idToUpdate, newProps) => {
  return items.map(item => {
    if (item.id === idToUpdate) {
      return { ...item, ...newProps };
    }
    if (item.children) {
      return {
        ...item,
        children: updateItemInTree(item.children, idToUpdate, newProps)
      };
    }
    return item;
  });
};

export default useTreeData;
