import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { toast } from 'sonner';

const useTreeData = () => {
  const [treeData, setTreeData] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchPrompts = useCallback(async (parentRowId = null, level = 1) => {
    try {
      let query = supabase
        .from('prompts')
        .select('row_id, parent_row_id, prompt_name, note')
        .eq('level', level)
        .order('prompt_name', { ascending: true });

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
      console.error(`Error fetching prompts at level ${level}:`, error);
      return [];
    }
  });

  const fetchTreeData = useCallback(async () => {
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
  }, [fetchPrompts]);

  useEffect(() => {
    fetchTreeData();
  }, [fetchTreeData]);

  const addItem = useCallback(async (parentId, level) => {
    try {
      const { data, error } = await supabase
        .from('prompts')
        .insert({
          parent_row_id: parentId,
          prompt_name: 'New Prompt',
          level: level,
          note: ''
        })
        .select()
        .single();

      if (error) throw error;

      setTreeData(prevData => addItemToChildren(prevData, parentId, {
        id: data.row_id,
        name: data.prompt_name,
        children: []
      }, level));

      return data.row_id;
    } catch (error) {
      console.error('Error adding new item:', error);
      toast.error(`Failed to add new item: ${error.message}`);
      return null;
    }
  }, []);

  const deleteItem = useCallback(async (id) => {
    try {
      const deleteRecursively = async (itemId) => {
        const { data: children } = await supabase
          .from('prompts')
          .select('row_id')
          .eq('parent_row_id', itemId);

        for (const child of children) {
          await deleteRecursively(child.row_id);
        }

        const { error } = await supabase
          .from('prompts')
          .delete()
          .eq('row_id', itemId);

        if (error) throw error;
      };

      await deleteRecursively(id);

      setTreeData(prevData => removeItemFromTree(prevData, id));
      return true;
    } catch (error) {
      console.error('Error deleting item:', error);
      toast.error(`Failed to delete item: ${error.message}`);
      return false;
    }
  }, []);

  const updateItemName = useCallback(async (id, newName) => {
    try {
      const { error } = await supabase
        .from('prompts')
        .update({ prompt_name: newName })
        .eq('row_id', id);

      if (error) throw error;

      setTreeData(prevData => updateItemInTree(prevData, id, { name: newName }));
      return true;
    } catch (error) {
      console.error('Error updating item name:', error);
      toast.error(`Failed to update item name: ${error.message}`);
      return false;
    }
  }, []);

  return { 
    treeData, 
    addItem, 
    deleteItem, 
    updateItemName,
    isLoading,
    refreshTreeData: fetchTreeData
  };
};

const addItemToChildren = (items, parentId, newItem, level) => {
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
        children: addItemToChildren(item.children, parentId, newItem, level)
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
