import React, { useState } from 'react';
import { Accordion } from "@/components/ui/accordion";
import { TooltipProvider, Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import TreeItem from '../components/TreeItem';
import { useTreeData } from '../hooks/useTreeData';
import { PanelGroup, Panel, PanelResizeHandle } from 'react-resizable-panels';
import { PlusCircle } from 'lucide-react';
import { Button } from "@/components/ui/button";
import DeleteConfirmationDialog from '../components/DeleteConfirmationDialog';
import ProjectPanels from '../components/ProjectPanels';

const Projects = () => {
  const [expandedItems, setExpandedItems] = useState([]);
  const [activeItem, setActiveItem] = useState(null);
  const { treeData, addItem, deleteItem, updateTreeData, updateItemName, fetchItemData } = useTreeData();
  const [editingItem, setEditingItem] = useState(null);
  const [deleteConfirmation, setDeleteConfirmation] = useState({ isOpen: false, itemId: null, confirmCount: 0 });
  const [selectedItemData, setSelectedItemData] = useState(null);

  const toggleItem = async (itemId) => {
    setExpandedItems(prev => {
      const newExpanded = prev.includes(itemId)
        ? prev.filter(id => id !== itemId)
        : [...prev, itemId];
      return newExpanded;
    });
    setActiveItem(itemId);
    const itemData = await fetchItemData(itemId);
    setSelectedItemData(itemData);
  };

  const startRenaming = (id) => {
    const item = findItemById(treeData, id);
    if (item) {
      setEditingItem({ id, name: item.name });
    }
  };

  const finishRenaming = async () => {
    if (editingItem) {
      const success = await updateItemName(editingItem.id, editingItem.name);
      if (success) {
        updateTreeData(editingItem.id, (item) => ({
          ...item,
          name: editingItem.name
        }));
      } else {
        console.error("Failed to update item name in the database");
      }
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

  const handleAddItem = async (parentId) => {
    const newItemId = await addItem(parentId);
    if (newItemId) {
      setActiveItem(newItemId);
      setExpandedItems(prev => [...prev, parentId].filter(Boolean));
      return newItemId;
    }
  };

  const handleDeleteItem = (id) => {
    const isLevel0 = treeData.some(item => item.id === id);
    if (isLevel0) {
      setDeleteConfirmation({ isOpen: true, itemId: id, confirmCount: 0 });
    } else {
      deleteItem(id);
    }
    if (activeItem === id) {
      setActiveItem(null);
      setSelectedItemData(null);
    }
  };

  const handleDeleteConfirm = async () => {
    if (deleteConfirmation.confirmCount === 0) {
      setDeleteConfirmation(prev => ({ ...prev, confirmCount: 1 }));
    } else {
      const success = await deleteItem(deleteConfirmation.itemId);
      if (success) {
        setDeleteConfirmation({ isOpen: false, itemId: null, confirmCount: 0 });
        if (activeItem === deleteConfirmation.itemId) {
          setActiveItem(null);
          setSelectedItemData(null);
        }
      } else {
        console.error("Failed to delete item");
      }
    }
  };

  const renderTreeItems = () => {
    if (!treeData || treeData.length === 0) {
      return <div>No items to display</div>;
    }
    return (
      <TooltipProvider>
        <div className="overflow-x-scroll whitespace-nowrap" style={{ width: '100%' }}>
          <div className="mb-2">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => handleAddItem(null)}
                >
                  <PlusCircle className="h-5 w-5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>New File</TooltipContent>
            </Tooltip>
          </div>
          <Accordion
            type="multiple"
            value={expandedItems}
            onValueChange={setExpandedItems}
            className="w-full min-w-max"
          >
            {treeData.map((item) => (
              <TreeItem
                key={item.id}
                item={item}
                level={0}
                expandedItems={expandedItems}
                toggleItem={toggleItem}
                addItem={handleAddItem}
                deleteItem={handleDeleteItem}
                startRenaming={startRenaming}
                editingItem={editingItem}
                setEditingItem={setEditingItem}
                finishRenaming={finishRenaming}
                activeItem={activeItem}
                setActiveItem={setActiveItem}
              />
            ))}
          </Accordion>
        </div>
      </TooltipProvider>
    );
  };

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">Projects</h1>
      <PanelGroup direction="horizontal">
        <Panel defaultSize={20} minSize={15}>
          <div className="border rounded-lg p-4 overflow-x-scroll overflow-y-auto h-[calc(100vh-8rem)]">
            {renderTreeItems()}
          </div>
        </Panel>
        <PanelResizeHandle className="w-2 bg-gray-200 hover:bg-gray-300 transition-colors" />
        <Panel>
          <ProjectPanels selectedItemData={selectedItemData} />
        </Panel>
      </PanelGroup>
      <DeleteConfirmationDialog
        isOpen={deleteConfirmation.isOpen}
        onOpenChange={(isOpen) => setDeleteConfirmation(prev => ({ ...prev, isOpen }))}
        confirmCount={deleteConfirmation.confirmCount}
        onConfirm={handleDeleteConfirm}
      />
    </div>
  );
};

export default Projects;
