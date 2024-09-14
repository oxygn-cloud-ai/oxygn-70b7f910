import { useState, useEffect } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { supabase } from '../lib/supabase';

export const useTreeData = () => {
  const [treeData, setTreeData] = useState([]);

  useEffect(() => {
    fetchProjectData();
  }, []);

  const fetchProjectData = async () => {
    try {
      const { data: projectsData, error: projectsError } = await supabase
        .from('project_names')
        .select('project_id, project_name, created')
        .order('created', { ascending: false });

      if (projectsError) throw projectsError;

      const projectsWithAllLevels = await Promise.all(projectsData.map(async (project) => {
        const { data: allLevelsData, error: allLevelsError } = await supabase
          .from('projects')
          .select('project_row_id, project_id, prompt_name, level, parent_row_id, created')
          .eq('project_id', project.project_id)
          .order('created');

        if (allLevelsError) throw allLevelsError;

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

        const treeStructure = buildTreeStructure(allLevelsData);

        return {
          id: project.project_id,
          name: project.project_name,
          created: project.created,
          children: treeStructure
        };
      }));

      setTreeData(projectsWithAllLevels);
    } catch (error) {
      console.error('Error fetching project data:', error);
    }
  };

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
      name: 'New File',
      created: new Date().toISOString(),
      children: []
    };

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

    newItem.id = parentId ? data[0].project_row_id : data[0].project_id;

    setTreeData(prevData => {
      if (!parentId) {
        return [newItem, ...prevData];
      }
      return addItemToChildren(prevData, parentId, newItem);
    });

    return newItem.id;
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

  const deleteItem = async (id) => {
    const isLevel0 = treeData.some(item => item.id === id);

    const { error } = isLevel0
      ? await supabase.from('project_names').delete().eq('project_id', id)
      : await supabase.from('projects').delete().eq('project_row_id', id);

    if (error) {
      console.error('Error deleting item:', error);
      return false;
    }

    setTreeData(prevData => {
      const deleteRecursive = (items) => {
        return items.filter(item => {
          if (item.id === id) return false;
          if (item.children) {
            item.children = deleteRecursive(item.children);
          }
          return true;
        });
      };
      return deleteRecursive(prevData);
    });

    return true;
  };

  const updateItemName = async (id, newName) => {
    const isLevel0 = treeData.some(item => item.id === id);
    const { error } = isLevel0
      ? await supabase.from('project_names').update({ project_name: newName }).eq('project_id', id)
      : await supabase.from('projects').update({ prompt_name: newName }).eq('project_row_id', id);

    if (error) {
      console.error('Error updating item name:', error);
      return false;
    }

    updateTreeData(id, item => ({ ...item, name: newName }));
    return true;
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

  const fetchItemData = async (id) => {
    const { data, error } = await supabase
      .from('projects')
      .select('admin_prompt_result, user_prompt_result, input_admin_prompt, input_user_prompt')
      .eq('project_row_id', id)
      .single();

    if (error) {
      console.error('Error fetching item data:', error);
      return null;
    }

    return data;
  };

  return { treeData, addItem, deleteItem, updateTreeData, updateItemName, fetchItemData };
};
