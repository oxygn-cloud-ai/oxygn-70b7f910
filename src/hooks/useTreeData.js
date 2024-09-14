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
      // Fetch top-level projects
      const { data: projectsData, error: projectsError } = await supabase
        .from('project_names')
        .select('project_id, project_name')
        .order('project_name');

      if (projectsError) throw projectsError;

      const projectsWithSubItems = await Promise.all(projectsData.map(async (project) => {
        const subItems = await fetchSubItems(project.project_id, null, 1);
        return {
          id: project.project_id,
          name: project.project_name,
          type: 'folder',
          children: subItems
        };
      }));

      setTreeData(projectsWithSubItems);
    } catch (error) {
      console.error('Error fetching project data:', error);
    }
  };

  const fetchSubItems = async (projectId, parentRowId, level) => {
    if (level > 99) return []; // Stop at level 99

    const { data, error } = await supabase
      .from('projects')
      .select('project_row_id, project_id, prompt_name')
      .eq('project_id', projectId)
      .eq('level', level)
      .eq('parent_row_id', parentRowId)
      .order('prompt_name');

    if (error) throw error;

    const subItemsWithChildren = await Promise.all(data.map(async (item) => {
      const children = await fetchSubItems(projectId, item.project_row_id, level + 1);
      return {
        id: item.project_row_id,
        name: item.prompt_name,
        type: children.length > 0 ? 'folder' : 'file',
        children: children
      };
    }));

    return subItemsWithChildren;
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

  const addItem = (parentId, type) => {
    const newItem = {
      id: uuidv4(),
      name: type === 'folder' ? 'New Folder' : 'New File',
      type: type,
      children: type === 'folder' ? [] : undefined
    };

    setTreeData(prevData => {
      if (!parentId) {
        return [...prevData, newItem];
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

  const deleteItem = (id) => {
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
  };

  return { treeData, addItem, deleteItem, updateTreeData };
};
