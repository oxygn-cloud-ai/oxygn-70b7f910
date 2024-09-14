import { useState } from 'react';
import { v4 as uuidv4 } from 'uuid';

export const useTreeData = () => {
  const [treeData, setTreeData] = useState([
    {
      id: '1',
      name: 'Project A',
      type: 'folder',
      children: [
        { id: '1-1', name: 'file1.txt', type: 'file' },
        { id: '1-2', name: 'file2.txt', type: 'file' },
        {
          id: '1-3',
          name: 'Subfolder',
          type: 'folder',
          children: [
            { id: '1-3-1', name: 'subfile1.txt', type: 'file' },
            { id: '1-3-2', name: 'subfile2.txt', type: 'file' },
          ],
        },
      ],
    },
    {
      id: '2',
      name: 'Project B',
      type: 'folder',
      children: [
        { id: '2-1', name: 'fileB1.txt', type: 'file' },
        { id: '2-2', name: 'fileB2.txt', type: 'file' },
      ],
    },
  ]);

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
      if (item.id === parentId && item.type === 'folder') {
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
