import { useState } from 'react';
import { v4 as uuidv4 } from 'uuid';

export const useTreeData = () => {
  const [treeData, setTreeData] = useState([]);

  const addItem = (parentId) => {
    const newItem = {
      id: uuidv4(),
      name: 'New Prompt',
      created: new Date().toISOString(),
      children: []
    };

    setTreeData(prevData => {
      if (!parentId) {
        return [newItem, ...prevData];
      }
      return addItemToChildren(prevData, parentId, newItem);
    });

    return newItem.id;
  };

  const deleteItem = (id) => {
    setTreeData(prevData => {
      const isLevel0 = prevData.some(item => item.id === id);
      if (isLevel0) {
        return prevData.filter(item => item.id !== id);
      }
      return deleteRecursive(prevData, id);
    });
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

  const updateItemName = (id, newName) => {
    updateTreeData(id, item => ({ ...item, name: newName }));
  };

  return { 
    treeData, 
    addItem, 
    deleteItem, 
    updateTreeData, 
    updateItemName
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
