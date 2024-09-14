import React, { useState } from 'react';
import { Accordion } from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { TooltipProvider } from "@/components/ui/tooltip";
import TreeItem from '../components/TreeItem';
import PromptBox from '../components/PromptBox';
import HalfWidthBox from '../components/HalfWidthBox';
import { useTreeData } from '../hooks/useTreeData';

const Projects = () => {
  const [expandedItems, setExpandedItems] = useState([]);
  const { treeData, addItem, deleteItem, updateTreeData } = useTreeData();
  const [editingItem, setEditingItem] = useState(null);

  const toggleItem = (itemId) => {
    setExpandedItems((prevExpanded) =>
      prevExpanded.includes(itemId)
        ? prevExpanded.filter((id) => id !== itemId)
        : [...prevExpanded, itemId]
    );
  };

  const startRenaming = (id) => {
    const item = findItemById(treeData, id);
    if (item) {
      setEditingItem({ id, name: item.name });
    }
  };

  const finishRenaming = () => {
    if (editingItem) {
      updateTreeData(editingItem.id, (item) => ({
        ...item,
        name: editingItem.name
      }));
      setEditingItem(null);
    }
  };

  const findItemById = (items, id) => {
    if (!items) return null;
    for (let item of items) {
      if (item.id === id) return item;
      if (item.children) {
        const found = findItemById(item.children, id);
        if (found) return found;
      }
    }
    return null;
  };

  const renderTreeItems = () => {
    if (!treeData || treeData.length === 0) {
      return <div>No items to display</div>;
    }
    return (
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
    );
  };

  const renderAddButtons = () => (
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
  );

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">Projects</h1>
      <div className="flex gap-4">
        <div className="w-1/5 border rounded-lg p-4 overflow-auto" style={{ height: 'calc(100vh - 8rem)' }}>
          {renderTreeItems()}
          {renderAddButtons()}
        </div>
        <div className="w-4/5 flex flex-col gap-4">
          <div className="flex-none">
            <PromptBox title="Admin Prompt" />
          </div>
          <div className="flex-none">
            <PromptBox title="User Prompt" />
          </div>
          <div className="flex flex-wrap gap-4 flex-grow overflow-auto" style={{ height: 'calc(100vh - 24rem)' }}>
            <HalfWidthBox title="Input Admin Prompt" content="Content for the first half width box goes here." />
            <HalfWidthBox title="Half Width Box 2" content="Content for the second half width box goes here." />
            <HalfWidthBox title="Half Width Box 3" content="Content for the third half width box goes here." />
            <HalfWidthBox title="Half Width Box 4" content="Content for the fourth half width box goes here." />
          </div>
        </div>
      </div>
    </div>
  );
};

export default Projects;
