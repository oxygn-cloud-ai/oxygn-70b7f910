import React, { useState } from 'react';
import { Accordion } from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { TooltipProvider } from "@/components/ui/tooltip";
import TreeItem from '../components/TreeItem';
import { Textarea } from "@/components/ui/textarea";
import { useTreeData } from '../hooks/useTreeData';
import { PanelGroup, Panel, PanelResizeHandle } from 'react-resizable-panels';

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
      <PanelGroup direction="horizontal">
        <Panel defaultSize={20} minSize={15}>
          <div className="border rounded-lg p-4 overflow-auto h-[calc(100vh-8rem)]">
            {renderTreeItems()}
            {renderAddButtons()}
          </div>
        </Panel>
        <PanelResizeHandle className="w-2 bg-gray-200 hover:bg-gray-300 transition-colors" />
        <Panel>
          <div className="flex flex-col gap-4 h-[calc(100vh-8rem)] overflow-auto">
            <Textarea placeholder="Admin Prompt" className="w-full p-2 border rounded" />
            <Textarea placeholder="User Prompt" className="w-full p-2 border rounded" />
            <div className="grid grid-cols-2 gap-4">
              <Textarea placeholder="Input Admin Prompt" className="w-full p-2 border rounded" />
              <Textarea placeholder="Input User Prompt" className="w-full p-2 border rounded" />
              <Textarea placeholder="Prompt Settings" className="w-full p-2 border rounded" />
              <Textarea placeholder="Half Width Box 4" className="w-full p-2 border rounded" />
            </div>
          </div>
        </Panel>
      </PanelGroup>
    </div>
  );
};

export default Projects;
