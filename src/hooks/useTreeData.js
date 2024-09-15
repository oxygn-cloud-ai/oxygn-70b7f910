import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { toast } from 'sonner';

const useTreeData = () => {
  const [treeData, setTreeData] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchProjectNames = useCallback(async () => {
    setIsLoading(true);
    try {
      const { data: projectNames, error } = await supabase
        .from('project_names')
        .select('project_id, project_name, created')
        .order('created', { ascending: false });

      if (error) throw error;

      const projectsWithChildren = await Promise.all(projectNames.map(async (project) => {
        const children = await fetchProjectChildren(project.project_id);
        return {
          ...project,
          id: project.project_id,
          name: project.project_name,
          children: children
        };
      }));

      setTreeData(projectsWithChildren);
    } catch (error) {
      console.error('Error fetching project names:', error);
      toast.error(`Failed to fetch projects: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const fetchProjectChildren = async (projectId, parentRowId = null, level = 1) => {
    try {
      let query = supabase
        .from('projects')
        .select('*')
        .eq('project_id', projectId)
        .eq('level', level);

      if (parentRowId) {
        query = query.eq('parent_row_id', parentRowId);
      }

      const { data, error } = await query.order('created', { ascending: false });

      if (error) throw error;

      const childrenWithSubchildren = await Promise.all(data.map(async (child) => {
        const subchildren = await fetchProjectChildren(projectId, child.project_row_id, level + 1);
        return {
          ...child,
          id: child.project_row_id,
          name: child.prompt_name,
          children: subchildren
        };
      }));

      return childrenWithSubchildren;
    } catch (error) {
      console.error(`Error fetching children for project ${projectId} at level ${level}:`, error);
      return [];
    }
  };

  useEffect(() => {
    fetchProjectNames();
  }, [fetchProjectNames]);

  const addItem = useCallback(async (parentId, level = 0) => {
    const newItem = {
      name: 'New Prompt',
      created: new Date().toISOString(),
    };

    try {
      let projectId;
      if (level === 0) {
        const { data: insertedProject, error } = await supabase
          .from('project_names')
          .insert({ project_name: newItem.name, created: newItem.created })
          .select()
          .single();

        if (error) throw error;
        projectId = insertedProject.project_id;
        newItem.id = projectId;
      } else {
        const { data: parentProject, error: parentError } = await supabase
          .from('projects')
          .select('project_id')
          .eq('project_row_id', parentId)
          .single();

        if (parentError) throw parentError;
        projectId = parentProject.project_id;

        // Check if project_id exists in project_names
        const { data: projectExists, error: checkError } = await supabase
          .from('project_names')
          .select('project_id')
          .eq('project_id', projectId)
          .single();

        if (checkError && checkError.code !== 'PGRST116') throw checkError;

        if (!projectExists) {
          // If project_id doesn't exist, create it in project_names
          const { error: insertError } = await supabase
            .from('project_names')
            .insert({ project_id: projectId, project_name: 'Untitled Project', created: newItem.created });

          if (insertError) throw insertError;
        }

        const { data: insertedPrompt, error } = await supabase
          .from('projects')
          .insert({
            project_id: projectId,
            prompt_name: newItem.name,
            created: newItem.created,
            level: level,
            parent_row_id: level > 1 ? parentId : null
          })
          .select()
          .single();

        if (error) throw error;
        newItem.id = insertedPrompt.project_row_id;
      }

      setTreeData(prevData => {
        if (level === 0) {
          return [{ ...newItem, children: [] }, ...prevData];
        }
        return addItemToChildren(prevData, parentId, { ...newItem, children: [] }, level);
      });

      return newItem.id;
    } catch (error) {
      console.error('Error adding new item:', error);
      toast.error(`Failed to add new item: ${error.message}`);
      return null;
    }
  }, []);

  const deleteItem = useCallback(async (id, level = 0) => {
    try {
      if (level === 0) {
        // Delete the project and all its associated records
        const { error: deleteProjectError } = await supabase
          .from('project_names')
          .delete()
          .eq('project_id', id);
        if (deleteProjectError) throw deleteProjectError;
      } else {
        // For items at level 1 or higher
        const { data: itemData, error: itemError } = await supabase
          .from('projects')
          .select('project_id')
          .eq('project_row_id', id)
          .single();
        if (itemError) throw itemError;

        const projectId = itemData.project_id;

        // Recursive deletion function
        const deleteRecursively = async (currentLevel) => {
          const { data: itemsToDelete, error: fetchError } = await supabase
            .from('projects')
            .select('project_row_id, parent_row_id')
            .eq('project_id', projectId)
            .eq('level', currentLevel);
          
          if (fetchError) throw fetchError;

          for (const item of itemsToDelete) {
            if (await isDescendantOf(item.project_row_id, id)) {
              const { error: deleteError } = await supabase
                .from('projects')
                .delete()
                .eq('project_row_id', item.project_row_id);
              if (deleteError) throw deleteError;
            }
          }

          if (currentLevel > level) {
            await deleteRecursively(currentLevel - 1);
          }
        };

        // Start deletion from the highest possible level
        await deleteRecursively(99);

        // Delete the originally selected item
        const { error: deleteItemError } = await supabase
          .from('projects')
          .delete()
          .eq('project_row_id', id);
        if (deleteItemError) throw deleteItemError;
      }

      setTreeData(prevData => removeItemFromTree(prevData, id));
      return true;
    } catch (error) {
      console.error('Error deleting item:', error);
      toast.error(`Failed to delete item: ${error.message}`);
      return false;
    }
  }, []);

  const isDescendantOf = async (itemId, ancestorId) => {
    let currentId = itemId;
    while (currentId) {
      if (currentId === ancestorId) return true;
      const { data, error } = await supabase
        .from('projects')
        .select('parent_row_id')
        .eq('project_row_id', currentId)
        .single();
      if (error || !data) return false;
      currentId = data.parent_row_id;
    }
    return false;
  };

  const updateItemName = useCallback(async (id, newName, level = 0) => {
    try {
      if (level === 0) {
        const { error } = await supabase
          .from('project_names')
          .update({ project_name: newName })
          .eq('project_id', id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('projects')
          .update({ prompt_name: newName })
          .eq('project_row_id', id);
        if (error) throw error;
      }

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
    refreshTreeData: fetchProjectNames
  };
};

const addItemToChildren = (items, parentId, newItem, level) => {
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
