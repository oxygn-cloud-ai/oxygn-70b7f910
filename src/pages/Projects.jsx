import React, { useState, useEffect, useCallback } from 'react';
import { Accordion } from "@/components/ui/accordion";
import { TooltipProvider } from "@/components/ui/tooltip";
import TreeItem from '../components/TreeItem';
import useTreeData from '../hooks/useTreeData';
import { PanelGroup, Panel, PanelResizeHandle } from 'react-resizable-panels';
import { PlusCircle } from 'lucide-react';
import { Button } from "@/components/ui/button";
import DeleteConfirmationDialog from '../components/DeleteConfirmationDialog';
import ProjectPanels from '../components/ProjectPanels';
import { useOpenAICall } from '../hooks/useOpenAICall';
import { toast } from 'sonner';
import { supabase } from '../lib/supabase';

const Projects = () => {
  const [expandedItems, setExpandedItems] = useState([]);
  const [activeItem, setActiveItem] = useState(null);
  const { treeData, addItem, deleteItem, updateItemName, fetchItemData, isLoading, refreshTreeData } = useTreeData();
  const [editingItem, setEditingItem] = useState(null);
  const [deleteConfirmation, setDeleteConfirmation] = useState({ isOpen: false, itemId: null, confirmCount: 0 });
  const [selectedItemData, setSelectedItemData] = useState(null);
  const { callOpenAI, isLoading: isGenerating } = useOpenAICall();

  const toggleItem = useCallback(async (itemId) => {
    setExpandedItems(prev => {
      const newExpanded = prev.includes(itemId)
        ? prev.filter(id => id !== itemId)
        : [...prev, itemId];
      return newExpanded;
    });
    setActiveItem(itemId);
    if (itemId) {
      const itemData = await fetchItemData(itemId);
      setSelectedItemData(itemData);
    } else {
      setSelectedItemData(null);
    }
  }, [fetchItemData]);

  const startRenaming = useCallback((id) => {
    const item = findItemById(treeData, id);
    if (item) {
      setEditingItem({ id, name: item.name });
    }
  }, [treeData]);

  const finishRenaming = useCallback(async () => {
    if (editingItem) {
      const success = await updateItemName(editingItem.id, editingItem.name);
      if (!success) {
        console.error("Failed to update item name in the database");
      }
      setEditingItem(null);
    }
  }, [editingItem, updateItemName]);

  const handleAddItem = useCallback(async (parentId) => {
    const newItemId = await addItem(parentId);
    if (newItemId) {
      setActiveItem(newItemId);
      setExpandedItems(prev => [...prev, parentId].filter(Boolean));
      return newItemId;
    }
  }, [addItem]);

  const handleDeleteItem = useCallback((id) => {
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
  }, [treeData, deleteItem, activeItem]);

  const handleDeleteConfirm = useCallback(async () => {
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
  }, [deleteConfirmation, deleteItem, activeItem]);

  const handleGeneratePrompts = useCallback(async () => {
    if (!selectedItemData) {
      toast.error("No project selected");
      return;
    }

    try {
      const result = await callOpenAI(
        selectedItemData.input_admin_prompt,
        selectedItemData.input_user_prompt,
        selectedItemData
      );

      if (result) {
        const updatedData = { ...selectedItemData, user_prompt_result: result };
        setSelectedItemData(updatedData);
        await supabase
          .from('projects')
          .update({ user_prompt_result: result })
          .eq('project_row_id', activeItem);
        toast.success("Prompts generated successfully");
      }
    } catch (error) {
      console.error("Error generating prompts:", error);
      toast.error(`Failed to generate prompts: ${error.message}`);
    }
  }, [selectedItemData, callOpenAI, activeItem]);

  const handleUpdateField = useCallback(async (fieldName, value) => {
    if (activeItem) {
      try {
        const { error } = await supabase
          .from('projects')
          .update({ [fieldName]: value })
          .eq('project_row_id', activeItem);

        if (error) throw error;
        
        // Update local state
        setSelectedItemData(prevData => ({
          ...prevData,
          [fieldName]: value
        }));
      } catch (error) {
        console.error('Error updating field:', error);
        toast.error(`Failed to update ${fieldName}: ${error.message}`);
      }
    }
  }, [activeItem]);

  const renderTreeItems = useCallback(() => {
    if (!treeData || treeData.length === 0) {
      return <div>No items to display</div>;
    }
    return (
      <TooltipProvider>
        <div className="overflow-x-scroll whitespace-nowrap" style={{ width: '100%' }}>
          <div className="mb-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => handleAddItem(null)}
            >
              <PlusCircle className="h-5 w-5" />
            </Button>
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
                projectId={item.id}
              />
            ))}
          </Accordion>
        </div>
      </TooltipProvider>
    );
  }, [treeData, expandedItems, handleAddItem, toggleItem, handleDeleteItem, startRenaming, editingItem, finishRenaming, activeItem]);

  useEffect(() => {
    const intervalId = setInterval(() => {
      refreshTreeData();
    }, 60000); // Refresh every minute

    return () => clearInterval(intervalId);
  }, [refreshTreeData]);

  return (
    <div className="container mx-auto p-4">
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-2xl font-bold">Projects</h1>
        <Button 
          variant="link" 
          className="text-blue-500 hover:text-blue-700"
          onClick={handleGeneratePrompts}
          disabled={!selectedItemData || isGenerating}
        >
          {isGenerating ? "Generating..." : "Generate Prompts"}
        </Button>
      </div>
      <PanelGroup direction="horizontal">
        <Panel defaultSize={20} minSize={15}>
          <div className="border rounded-lg p-4 overflow-x-scroll overflow-y-auto h-[calc(100vh-8rem)]">
            {isLoading ? <div>Loading...</div> : renderTreeItems()}
          </div>
        </Panel>
        <PanelResizeHandle className="w-2 bg-gray-200 hover:bg-gray-300 transition-colors" />
        <Panel>
          {activeItem ? (
            <ProjectPanels 
              selectedItemData={selectedItemData} 
              projectRowId={activeItem} 
              onUpdateField={handleUpdateField}
            />
          ) : (
            <div className="flex items-center justify-center h-full">
              <p className="text-gray-500">Select a project to view details</p>
            </div>
          )}
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

export default Projects;
