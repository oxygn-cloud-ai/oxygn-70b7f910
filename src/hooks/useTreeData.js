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
        .select('project_id, project_name')
        .order('project_name');

      if (projectsError) throw projectsError;

      const projectsWithAllLevels = await Promise.all(projectsData.map(async (project) => {
        const { data: allLevelsData, error: allLevelsError } = await supabase
          .from('projects')
          .select('project_row_id, project_id, prompt_name, level, parent_row_id')
          .eq('project_id', project.project_id)
          .order('level, prompt_name');

        if (allLevelsError) throw allLevelsError;

        const buildTreeStructure = (items, parentId = null, level = 0) => {
          return items
            .filter(item => item.level === level + 1 && item.parent_row_id === parentId)
            .map(item => ({
              id: item.project_row_id,
              name: item.prompt_name,
              type: level < 4 ? 'folder' : 'file',
              children: buildTreeStructure(items, item.project_row_id, level + 1)
            }));
        };

        const treeStructure = buildTreeStructure(allLevelsData);

        return {
          id: project.project_id,
          name: project.project_name,
          type: 'folder',
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
