import React, { useState } from 'react';
import { Accordion } from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { TooltipProvider } from "@/components/ui/tooltip";
import { v4 as uuidv4 } from 'uuid';
import TreeItem from '../components/TreeItem';

const Projects = () => {
  const [expandedItems, setExpandedItems] = useState([]);
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

  const [editingItem, setEditingItem] = useState(null);

  const toggleItem = (itemId) => {
    setExpandedItems((prevExpanded) =>
      prevExpanded.includes(itemId)
        ? prevExpanded.filter((id) => id !== itemId)
        : [...prevExpanded, itemId]
    );
  };

  const updateTreeData = (items, id, updateFn) => {
    return items.map(item => {
      if (item.id === id) {
        return updateFn(item);
      }
      if (item.children) {
        return {
          ...item,
          children: updateTreeData(item.children, id, updateFn)
        };
      }
      return item;
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
      return updateTreeData(prevData, parentId, (item) => ({
        ...item,
        children: [...(item.children || []), newItem]
      }));
    });

    if (type === 'folder') {
      setExpandedItems(prev => [...prev, parentId]);
    }
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

  const startRenaming = (id) => {
    const item = findItemById(treeData, id);
    if (item) {
      setEditingItem({ id, name: item.name });
    }
  };

  const finishRenaming = () => {
    if (editingItem) {
      setTreeData(prevData => 
        updateTreeData(prevData, editingItem.id, (item) => ({
          ...item,
          name: editingItem.name
        }))
      );
      setEditingItem(null);
    }
  };

  const findItemById = (items, id) => {
    for (let item of items) {
      if (item.id === id) return item;
      if (item.children) {
        const found = findItemById(item.children, id);
        if (found) return found;
      }
    }
    return null;
  };

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">Projects</h1>
      <div className="flex gap-4">
        <div className="w-1/5 border rounded-lg p-4">
          <TooltipProvider>
            <Accordion
              type="multiple"
              value={expandedItems}
              onValueChange={setExpandedItems}
              className="w-full"
            >
              {treeData.map((item) => (
                <TreeItem
                  key={item.id}
                  item={item}
                  level={0}
                  expandedItems={expandedItems}
                  toggleItem={toggleItem}
                  addItem={addItem}
                  deleteItem={deleteItem}
                  startRenaming={startRenaming}
                  editingItem={editingItem}
                  setEditingItem={setEditingItem}
                  finishRenaming={finishRenaming}
                />
              ))}
            </Accordion>
          </TooltipProvider>
          <div className="mt-4 space-x-4">
            <Button
              variant="link"
              className="text-blue-600 hover:text-blue-800 underline p-0"
              onClick={() => addItem(null, 'folder')}
            >
              Add Root Folder
            </Button>
            <Button
              variant="link"
              className="text-blue-600 hover:text-blue-800 underline p-0"
              onClick={() => addItem(null, 'file')}
            >
              Add Root File
            </Button>
          </div>
        </div>
        <div className="w-4/5 flex flex-col gap-4">
          <div className="border rounded-lg p-4 h-1/3">
            <h2 className="text-xl font-semibold mb-2">Full Width Box</h2>
            <p>Content for the full width box goes here.</p>
          </div>
          <div className="flex flex-wrap gap-4 h-2/3">
            <div className="w-[calc(50%-0.5rem)] border rounded-lg p-4">
              <h2 className="text-xl font-semibold mb-2">Half Width Box 1</h2>
              <p>Content for the first half width box goes here.</p>
            </div>
            <div className="w-[calc(50%-0.5rem)] border rounded-lg p-4">
              <h2 className="text-xl font-semibold mb-2">Half Width Box 2</h2>
              <p>Content for the second half width box goes here.</p>
            </div>
            <div className="w-[calc(50%-0.5rem)] border rounded-lg p-4">
              <h2 className="text-xl font-semibold mb-2">Half Width Box 3</h2>
              <p>Content for the third half width box goes here.</p>
            </div>
            <div className="w-[calc(50%-0.5rem)] border rounded-lg p-4">
              <h2 className="text-xl font-semibold mb-2">Half Width Box 4</h2>
              <p>Content for the fourth half width box goes here.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Projects;
