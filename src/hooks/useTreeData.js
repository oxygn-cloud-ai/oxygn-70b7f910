import { useState, useEffect, useCallback } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { supabase } from '../lib/supabase';
import { toast } from 'sonner';

const useTreeData = () => {
  const [treeData, setTreeData] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchProjectNames = useCallback(async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('project_names')
        .select('project_id, project_name, created')
        .order('created', { ascending: false });

      if (error) throw error;

      setTreeData(data.map(project => ({
        id: project.project_id,
        name: project.project_name,
        created: project.created,
        children: []
      })));
    } catch (error) {
      console.error('Error fetching project names:', error);
      toast.error(`Failed to fetch projects: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchProjectNames();
  }, [fetchProjectNames]);

  const addItem = useCallback(async (parentId) => {
    const newItem = {
      id: uuidv4(),
      name: 'New Prompt',
      created: new Date().toISOString(),
    };

    try {
      const { data, error } = parentId
        ? await supabase
            .from('projects')
            .insert({
              project_id: parentId,
              prompt_name: newItem.name,
              created: newItem.created
            })
            .select()
            .single()
        : await supabase
            .from('project_names')
            .insert({ project_id: newItem.id, project_name: newItem.name, created: newItem.created })
            .select()
            .single();

      if (error) throw error;

      setTreeData(prevData => {
        if (!parentId) {
          return [{ ...newItem, id: data.project_id }, ...prevData];
        }
        return addItemToChildren(prevData, parentId, { ...newItem, id: data.project_row_id });
      });

      return parentId ? data.project_row_id : data.project_id;
    } catch (error) {
      console.error('Error adding new item:', error);
      toast.error(`Failed to add new item: ${error.message}`);
      return null;
    }
  }, []);

  const deleteItem = useCallback(async (id) => {
    try {
      const { error } = await supabase
        .from('project_names')
        .delete()
        .eq('project_id', id);

      if (error) throw error;

      setTreeData(prevData => prevData.filter(item => item.id !== id));
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
        .from('project_names')
        .update({ project_name: newName })
        .eq('project_id', id);

      if (error) throw error;

      setTreeData(prevData => prevData.map(item => 
        item.id === id ? { ...item, name: newName } : item
      ));
      return true;
    } catch (error) {
      console.error('Error updating item name:', error);
      toast.error(`Failed to update item name: ${error.message}`);
      return false;
    }
  }, []);

  const fetchItemData = useCallback(async (id) => {
    try {
      const { data, error } = await supabase
        .from('projects')
        .select('*')
        .eq('project_id', id)
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error fetching item data:', error);
      toast.error(`Failed to fetch project data: ${error.message}`);
      return null;
    }
  }, []);

  return { 
    treeData, 
    addItem, 
    deleteItem, 
    updateItemName, 
    fetchItemData,
    isLoading,
    refreshTreeData: fetchProjectNames
  };
};

const addItemToChildren = (items, parentId, newItem) => {
  return items.map(item => {
    if (item.id === parentId) {
      return {
        ...item,
        children: [newItem, ...(item.children || [])]
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

export default useTreeData;
