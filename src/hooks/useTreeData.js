import { useState, useEffect } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { supabase } from '../lib/supabase';
import { toast } from 'sonner';

const fetchProjectNames = async () => {
  try {
    const { data: projectsData, error: projectsError } = await supabase
      .from('project_names')
      .select('project_id, project_name, created')
      .order('created', { ascending: false });

    if (projectsError) throw projectsError;

    return projectsData.map(project => ({
      id: project.project_id,
      name: project.project_name,
      created: project.created,
      children: []
    }));
  } catch (error) {
    console.error('Error fetching project names:', error);
    toast.error(`Failed to fetch projects: ${error.message}`);
    return [];
  }
};

const buildTreeStructure = (items, parentId = null) => {
  return items
    .filter(item => item.parent_row_id === parentId)
    .sort((a, b) => new Date(a.created) - new Date(b.created))
    .map(item => ({
      id: item.project_row_id,
      name: item.prompt_name,
      created: item.created,
      children: buildTreeStructure(items, item.project_row_id)
    }));
};

const databaseOperations = {
  addItem: async (parentId, newItem) => {
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

    if (error) {
      console.error('Error adding new item:', error);
      return null;
    }

    return parentId ? data[0].project_row_id : data[0].project_id;
  },

  deleteItem: async (id, isLevel0) => {
    let error;

    if (isLevel0) {
      const { error: projectNamesError } = await supabase
        .from('project_names')
        .delete()
        .eq('project_id', id);

      const { error: projectsError } = await supabase
        .from('projects')
        .delete()
        .eq('project_id', id);

      error = projectNamesError || projectsError;
    } else {
      const { error: projectsError } = await supabase
        .from('projects')
        .delete()
        .eq('project_row_id', id);

      error = projectsError;
    }

    if (error) {
      console.error('Error deleting item:', error);
      return false;
    }

    return true;
  },

  updateItemName: async (id, newName, isLevel0) => {
    const { error } = isLevel0
      ? await supabase.from('project_names').update({ project_name: newName }).eq('project_id', id)
      : await supabase.from('projects').update({ prompt_name: newName }).eq('project_row_id', id);

    if (error) {
      console.error('Error updating item name:', error);
      return false;
    }

    return true;
  },

  fetchItemData: async (id) => {
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
  }
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

export const useTreeData = () => {
  const [treeData, setTreeData] = useState([]);

  useEffect(() => {
    fetchProjectNames().then(setTreeData);
  }, []);

  const updateTreeData = (id, updateFn) => {
    setTreeData(prevData => {
      const update = (items) => {
        return items.map(item => {
          if (item.id === id) {
            return updateFn(item);
          }
          if (item.children) {
            return {
              ...item,
              children: update(item.children)
            };
          }
          return item;
        });
      };
      return update(prevData);
    });
  };

  const addItem = async (parentId) => {
    const newItem = {
      id: uuidv4(),
      name: 'New Prompt',
      created: new Date().toISOString(),
      children: []
    };

    const newItemId = await databaseOperations.addItem(parentId, newItem);
    if (!newItemId) return null;

    newItem.id = newItemId;

    setTreeData(prevData => {
      if (!parentId) {
        return [newItem, ...prevData];
      }
      return addItemToChildren(prevData, parentId, newItem);
    });

    return newItem.id;
  };

  const deleteItem = async (id) => {
    const isLevel0 = treeData.some(item => item.id === id);
    const success = await databaseOperations.deleteItem(id, isLevel0);

    if (success) {
      setTreeData(prevData => {
        if (isLevel0) {
          return prevData.filter(item => item.id !== id);
        }
        return deleteRecursive(prevData, id);
      });
    }

    return success;
  };

  const updateItemName = async (id, newName) => {
    const isLevel0 = treeData.some(item => item.id === id);
    const success = await databaseOperations.updateItemName(id, newName, isLevel0);

    if (success) {
      updateTreeData(id, item => ({ ...item, name: newName }));
    }

    return success;
  };

  return { 
    treeData, 
    addItem, 
    deleteItem, 
    updateTreeData, 
    updateItemName, 
    fetchItemData: databaseOperations.fetchItemData 
  };
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
