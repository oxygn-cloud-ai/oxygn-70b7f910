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
  const { treeData, addItem, deleteItem, updateItemName, isLoading, refreshTreeData } = useTreeData();
  const [editingItem, setEditingItem] = useState(null);
  const [deleteConfirmation, setDeleteConfirmation] = useState({ isOpen: false, itemId: null, confirmCount: 0 });
  const [selectedItemData, setSelectedItemData] = useState(null);
  const { callOpenAI, isLoading: isGenerating } = useOpenAICall();

  const toggleItem = useCallback((itemId) => {
    setExpandedItems(prev => 
      prev.includes(itemId) ? prev.filter(id => id !== itemId) : [...prev, itemId]
    );
    setActiveItem(itemId);
  }, []);

  const handleAddItem = useCallback(async (parentId, level) => {
    const newItemId = await addItem(parentId, level);
    if (newItemId) {
      setActiveItem(newItemId);
      setExpandedItems(prev => [...prev, parentId].filter(Boolean));
    }
  }, [addItem]);

  const handleDeleteItem = useCallback((id, level) => {
    setDeleteConfirmation({ isOpen: true, itemId: id, level, confirmCount: 0 });
  }, []);

  const handleDeleteConfirm = useCallback(async () => {
    if (deleteConfirmation.confirmCount === 0) {
      setDeleteConfirmation(prev => ({ ...prev, confirmCount: 1 }));
    } else {
      const success = await deleteItem(deleteConfirmation.itemId, deleteConfirmation.level);
      if (success) {
        setDeleteConfirmation({ isOpen: false, itemId: null, level: 0, confirmCount: 0 });
        if (activeItem === deleteConfirmation.itemId) {
          setActiveItem(null);
          setSelectedItemData(null);
        }
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

  const renderTreeItems = useCallback((items, level = 0) => {
    return items.map((item) => (
      <TreeItem
        key={item.id}
        item={item}
        level={level}
        expandedItems={expandedItems}
        toggleItem={toggleItem}
        addItem={(parentId) => handleAddItem(parentId, level + 1)}
        deleteItem={(id) => handleDeleteItem(id, level)}
        startRenaming={(id) => setEditingItem({ id, name: item.name })}
        editingItem={editingItem}
        setEditingItem={setEditingItem}
        finishRenaming={() => {
          if (editingItem) {
            updateItemName(editingItem.id, editingItem.name, level);
            setEditingItem(null);
          }
        }}
        activeItem={activeItem}
        setActiveItem={setActiveItem}
        projectId={level === 0 ? item.id : item.project_id}
      >
        {item.children && renderTreeItems(item.children, level + 1)}
      </TreeItem>
    ));
  }, [expandedItems, toggleItem, handleAddItem, handleDeleteItem, updateItemName, editingItem, activeItem]);

  useEffect(() => {
    const intervalId = setInterval(refreshTreeData, 60000);
    return () => clearInterval(intervalId);
  }, [refreshTreeData]);

  useEffect(() => {
    if (activeItem) {
      const fetchItemData = async () => {
        try {
          const { data, error } = await supabase
            .from('projects')
            .select('*')
            .eq('project_row_id', activeItem)
            .single();

          if (error) throw error;
          setSelectedItemData(data);
        } catch (error) {
          console.error('Error fetching item data:', error);
          toast.error(`Failed to fetch project data: ${error.message}`);
        }
      };

      fetchItemData();
    } else {
      setSelectedItemData(null);
    }
  }, [activeItem]);

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
          <div className="border rounded-lg p-4 overflow-x-auto overflow-y-auto h-[calc(100vh-8rem)]">
            {isLoading ? (
              <div>Loading...</div>
            ) : (
              <TooltipProvider>
                <div className="overflow-x-auto whitespace-nowrap w-full">
                  <div className="mb-2">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleAddItem(null, 0)}
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
                    {renderTreeItems(treeData)}
                  </Accordion>
                </div>
              </TooltipProvider>
            )}
          </div>
        </Panel>
        <PanelResizeHandle className="w-2 bg-gray-200 hover:bg-gray-300 transition-colors" />
        <Panel>
          {activeItem ? (
            selectedItemData ? (
              <ProjectPanels 
                selectedItemData={selectedItemData} 
                projectRowId={activeItem} 
                onUpdateField={handleUpdateField}
              />
            ) : (
              <div className="flex items-center justify-center h-full">
                <p className="text-gray-500">Loading project details...</p>
              </div>
            )
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

export default Projects;
