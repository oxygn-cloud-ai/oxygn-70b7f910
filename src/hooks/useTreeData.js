import { useState, useEffect, useCallback } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { supabase } from '../lib/supabase';
import { toast } from 'sonner';

const useTreeData = () => {
  const [treeData, setTreeData] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [lastFetchTime, setLastFetchTime] = useState(0);

  const fetchProjectNames = useCallback(async (force = false) => {
    const now = Date.now();
    if (!force && now - lastFetchTime < 60000) {
      return; // Don't fetch if less than a minute has passed
    }

    setIsLoading(true);
    try {
      const { data: projectsData, error: projectsError } = await supabase
        .from('project_names')
        .select('project_id, project_name, created')
        .order('created', { ascending: false });

      if (projectsError) throw projectsError;

      const newTreeData = projectsData.map(project => ({
        id: project.project_id,
        name: project.project_name,
        created: project.created,
        children: []
      }));

      setTreeData(newTreeData);
      setLastFetchTime(now);
    } catch (error) {
      console.error('Error fetching project names:', error);
      toast.error(`Failed to fetch projects: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  }, [lastFetchTime]);

  useEffect(() => {
    fetchProjectNames();
  }, [fetchProjectNames]);

  const addItem = useCallback(async (parentId) => {
    const newItem = {
      id: uuidv4(),
      name: 'New Prompt',
      created: new Date().toISOString(),
      children: []
    };

    try {
      const { data, error } = parentId
        ? await supabase
            .from('projects')
            .insert({
              project_id: findProjectId(treeData, parentId),
              prompt_name: newItem.name,
              level: getItemLevel(treeData, parentId) + 1,
              parent_row_id: parentId,
              created: newItem.created
            })
            .select()
        : await supabase
            .from('project_names')
            .insert({ project_id: newItem.id, project_name: newItem.name, created: newItem.created })
            .select();

      if (error) throw error;

      const newItemId = parentId ? data[0].project_row_id : data[0].project_id;
      newItem.id = newItemId;

      setTreeData(prevData => {
        if (!parentId) {
          return [newItem, ...prevData];
        }
        return addItemToChildren(prevData, parentId, newItem);
      });

      return newItemId;
    } catch (error) {
      console.error('Error adding new item:', error);
      toast.error(`Failed to add new item: ${error.message}`);
      return null;
    }
  }, [treeData]);

  const deleteItem = useCallback(async (id) => {
    const isLevel0 = treeData.some(item => item.id === id);
    try {
      if (isLevel0) {
        await supabase.from('project_names').delete().eq('project_id', id);
        await supabase.from('projects').delete().eq('project_id', id);
      } else {
        await supabase.from('projects').delete().eq('project_row_id', id);
      }

      setTreeData(prevData => {
        if (isLevel0) {
          return prevData.filter(item => item.id !== id);
        }
        return deleteRecursive(prevData, id);
      });

      return true;
    } catch (error) {
      console.error('Error deleting item:', error);
      toast.error(`Failed to delete item: ${error.message}`);
      return false;
    }
  }, [treeData]);

  const updateItemName = useCallback(async (id, newName) => {
    const isLevel0 = treeData.some(item => item.id === id);
    try {
      if (isLevel0) {
        await supabase.from('project_names').update({ project_name: newName }).eq('project_id', id);
      } else {
        await supabase.from('projects').update({ prompt_name: newName }).eq('project_row_id', id);
      }

      setTreeData(prevData => updateTreeDataName(prevData, id, newName));
      return true;
    } catch (error) {
      console.error('Error updating item name:', error);
      toast.error(`Failed to update item name: ${error.message}`);
      return false;
    }
  }, [treeData]);

  const fetchItemData = useCallback(async (id) => {
    try {
      const { data, error } = await supabase
        .from('projects')
        .select('*')
        .eq('project_id', id)
        .eq('level', 1)
        .single();

      if (error) throw error;
      if (!data) {
        toast.warning('No data found for this project');
        return null;
      }
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
    refreshTreeData: () => fetchProjectNames(true)
  };
};

const findProjectId = (items, id) => {
  for (let item of items) {
    if (item.id === id) return item.id;
    if (item.children) {
      const found = findProjectId(item.children, id);
      if (found) return item.id;
    }
  }
  return null;
};

const getItemLevel = (items, id, level = 0) => {
  for (let item of items) {
    if (item.id === id) return level;
    if (item.children) {
      const childLevel = getItemLevel(item.children, id, level + 1);
      if (childLevel !== -1) return childLevel;
    }
  }
  return -1;
};

const addItemToChildren = (items, parentId, newItem) => {
  return items.map(item => {
    if (item.id === parentId) {
      return {
        ...item,
        children: [newItem, ...(item.children || [])].sort((a, b) => new Date(b.created) - new Date(a.created))
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

const deleteRecursive = (items, id) => {
  return items.filter(item => {
    if (item.id === id) return false;
    if (item.children) {
      item.children = deleteRecursive(item.children, id);
    }
    return true;
  });
};

const updateTreeDataName = (items, id, newName) => {
  return items.map(item => {
    if (item.id === id) {
      return { ...item, name: newName };
    }
    if (item.children) {
      return {
        ...item,
        children: updateTreeDataName(item.children, id, newName)
      };
    }
    return item;
  });
};

export default useTreeData;
