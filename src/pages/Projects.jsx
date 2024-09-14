import React, { useState } from 'react';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { FolderIcon, FileIcon, ChevronRightIcon, ChevronDownIcon, PlusIcon, TrashIcon, EditIcon } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { v4 as uuidv4 } from 'uuid';

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

  const renderTree = (items, level = 0) => {
    return (
      <Accordion
        type="multiple"
        value={expandedItems}
        onValueChange={setExpandedItems}
        className="w-full"
      >
        {items.map((item) => (
          <AccordionItem value={item.id} key={item.id} className="border-none">
            <AccordionTrigger
              onClick={() => toggleItem(item.id)}
              className={`hover:no-underline py-1 ${
                level > 0 ? `pl-${level * 4}` : ''
              }`}
            >
              <div className="flex items-center w-full">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 w-6 p-0 mr-2"
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleItem(item.id);
                  }}
                >
                  {expandedItems.includes(item.id) ? (
                    <ChevronDownIcon className="h-4 w-4" />
                  ) : (
                    <ChevronRightIcon className="h-4 w-4" />
                  )}
                </Button>
                {item.type === 'folder' ? (
                  <FolderIcon className="mr-2 h-4 w-4" />
                ) : (
                  <FileIcon className="mr-2 h-4 w-4" />
                )}
                {editingItem && editingItem.id === item.id ? (
                  <Input
                    value={editingItem.name}
                    onChange={(e) => setEditingItem({ ...editingItem, name: e.target.value })}
                    onBlur={finishRenaming}
                    onKeyPress={(e) => e.key === 'Enter' && finishRenaming()}
                    onClick={(e) => e.stopPropagation()}
                    className="h-6 py-0 px-1"
                  />
                ) : (
                  item.name
                )}
              </div>
              <div className="flex space-x-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    addItem(item.id, 'file');
                  }}
                >
                  <PlusIcon className="h-4 w-4" />
                </Button>
                {item.type === 'folder' && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      addItem(item.id, 'folder');
                    }}
                  >
                    <FolderIcon className="h-4 w-4" />
                  </Button>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    startRenaming(item.id);
                  }}
                >
                  <EditIcon className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    deleteItem(item.id);
                  }}
                >
                  <TrashIcon className="h-4 w-4" />
                </Button>
              </div>
            </AccordionTrigger>
            {item.children && (
              <AccordionContent>
                {renderTree(item.children, level + 1)}
              </AccordionContent>
            )}
          </AccordionItem>
        ))}
      </Accordion>
    );
  };

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">Projects</h1>
      <div className="border rounded-lg p-4">
        {renderTree(treeData)}
      </div>
      <div className="mt-4 space-x-2">
        <Button onClick={() => addItem(null, 'folder')}>Add Root Folder</Button>
        <Button onClick={() => addItem(null, 'file')}>Add Root File</Button>
      </div>
    </div>
  );
};

export default Projects;
