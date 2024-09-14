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

      const projectsWithSubItems = await Promise.all(projectsData.map(async (project) => {
        const { data: level1Data, error: level1Error } = await supabase
          .from('projects')
          .select('project_row_id, project_id, prompt_name')
          .eq('project_id', project.project_id)
          .eq('level', 1)
          .order('prompt_name');

        if (level1Error) throw level1Error;

        const level1WithSubItems = await Promise.all(level1Data.map(async (level1Item) => {
          const { data: level2Data, error: level2Error } = await supabase
            .from('projects')
            .select('project_row_id, project_id, prompt_name')
            .eq('project_id', project.project_id)
            .eq('level', 2)
            .eq('parent_row_id', level1Item.project_row_id)
            .order('prompt_name');

          if (level2Error) throw level2Error;

          const level2WithSubItems = await Promise.all(level2Data.map(async (level2Item) => {
            const { data: level3Data, error: level3Error } = await supabase
              .from('projects')
              .select('project_row_id, project_id, prompt_name')
              .eq('project_id', project.project_id)
              .eq('level', 3)
              .eq('parent_row_id', level2Item.project_row_id)
              .order('prompt_name');

            if (level3Error) throw level3Error;

            const level3WithSubItems = await Promise.all(level3Data.map(async (level3Item) => {
              const { data: level4Data, error: level4Error } = await supabase
                .from('projects')
                .select('project_row_id, project_id, prompt_name')
                .eq('project_id', project.project_id)
                .eq('level', 4)
                .eq('parent_row_id', level3Item.project_row_id)
                .order('prompt_name');

              if (level4Error) throw level4Error;

              const level4WithSubItems = await Promise.all(level4Data.map(async (level4Item) => {
                const { data: level5Data, error: level5Error } = await supabase
                  .from('projects')
                  .select('project_row_id, project_id, prompt_name')
                  .eq('project_id', project.project_id)
                  .eq('level', 5)
                  .eq('parent_row_id', level4Item.project_row_id)
                  .order('prompt_name');

                if (level5Error) throw level5Error;

                return {
                  id: level4Item.project_row_id,
                  name: level4Item.prompt_name,
                  type: 'folder',
                  children: level5Data.map(level5Item => ({
                    id: level5Item.project_row_id,
                    name: level5Item.prompt_name,
                    type: 'file'
                  }))
                };
              }));

              return {
                id: level3Item.project_row_id,
                name: level3Item.prompt_name,
                type: 'folder',
                children: level4WithSubItems
              };
            }));

            return {
              id: level2Item.project_row_id,
              name: level2Item.prompt_name,
              type: 'folder',
              children: level3WithSubItems
            };
          }));

          return {
            id: level1Item.project_row_id,
            name: level1Item.prompt_name,
            type: 'folder',
            children: level2WithSubItems
          };
        }));

        return {
          id: project.project_id,
          name: project.project_name,
          type: 'folder',
          children: level1WithSubItems
        };
      }));

      setTreeData(projectsWithSubItems);
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
