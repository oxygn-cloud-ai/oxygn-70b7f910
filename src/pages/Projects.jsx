import React, { useState, useEffect, useCallback } from 'react';
import { Accordion } from "@/components/ui/accordion";
import TreeItem from '../components/TreeItem';
import useTreeData from '../hooks/useTreeData';
import { PanelGroup, Panel, PanelResizeHandle } from 'react-resizable-panels';
import { PlusCircle } from 'lucide-react';
import { Button } from "@/components/ui/button";
import ProjectPanels from '../components/ProjectPanels';
import { useSupabase } from '../hooks/useSupabase';
import { useOpenAIModels } from '../hooks/useOpenAIModels';
import ParentPromptPopup from '../components/ParentPromptPopup';
import { DndProvider } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';
import { useTreeOperations } from '../hooks/useTreeOperations';
import { usePromptData } from '../hooks/usePromptData';
import { toast } from 'sonner';

// Extract tree rendering logic to a separate component
const TreeView = ({ treeData, expandedItems, toggleItem, editingItem, setEditingItem, handleUpdateField, refreshTreeData, activeItem, setActiveItem, handleAddItem, handleDeleteItem, handleDuplicateItem, handleMoveItem }) => {
  const renderTreeItems = useCallback((items) => (
    items.map((item) => (
      <TreeItem
        key={item.id}
        item={item}
        level={1}
        expandedItems={expandedItems}
        toggleItem={toggleItem}
        addItem={handleAddItem}
        startRenaming={(id, name) => setEditingItem({ id, name })}
        editingItem={editingItem}
        setEditingItem={setEditingItem}
        finishRenaming={async () => {
          if (editingItem) {
            // Only update the prompt_name field
            await handleUpdateField('prompt_name', editingItem.name);
            setEditingItem(null);
            await refreshTreeData();
          }
        }}
        cancelRenaming={() => setEditingItem(null)}
        activeItem={activeItem}
        setActiveItem={setActiveItem}
        deleteItem={handleDeleteItem}
        duplicateItem={handleDuplicateItem}
        moveItem={handleMoveItem}
        onRefreshTreeData={refreshTreeData}
      />
    ))
  ), [expandedItems, toggleItem, handleAddItem, editingItem, activeItem, refreshTreeData, handleDeleteItem, handleDuplicateItem, handleMoveItem, handleUpdateField, setEditingItem, setActiveItem]);

  return (
    <Accordion
      type="multiple"
      value={expandedItems}
      onValueChange={setExpandedItems}
      className="w-full min-w-max"
    >
      {treeData.length > 0 ? renderTreeItems(treeData) : <div className="text-gray-500 p-2">No prompts available</div>}
    </Accordion>
  );
};

const Projects = () => {
  const [expandedItems, setExpandedItems] = useState([]);
  const [activeItem, setActiveItem] = useState(null);
  const supabase = useSupabase();
  const { treeData, isLoading, refreshTreeData } = useTreeData(supabase);
  const [editingItem, setEditingItem] = useState(null);
  const [selectedItemData, setSelectedItemData] = useState(null);
  const { models } = useOpenAIModels();
  const [showParentPromptPopup, setShowParentPromptPopup] = useState(false);
  const [cascadeInfo, setCascadeInfo] = useState({ itemName: '', fieldName: '' });
  const { handleAddItem, handleDeleteItem, handleDuplicateItem, handleMoveItem } = useTreeOperations(supabase, refreshTreeData);
  const { updateField, fetchItemData } = usePromptData(supabase);

  useEffect(() => {
    const loadExpandedState = async () => {
      if (!supabase || !treeData.length) return;
      
      try {
        const { data, error } = await supabase
          .from(import.meta.env.VITE_PROMPTS_TBL)
          .select('row_id, expanded_item')
          .eq('is_deleted', false);

        if (error) throw error;

        const expandedIds = data
          .filter(item => item.expanded_item)
          .map(item => item.row_id);

        setExpandedItems(expandedIds);
      } catch (error) {
        console.error('Error loading expanded state:', error);
        toast.error('Failed to load expanded states');
      }
    };

    loadExpandedState();
  }, [treeData, supabase]);

  const toggleItem = useCallback((itemId) => {
    setExpandedItems(prev => 
      prev.includes(itemId) ? prev.filter(id => id !== itemId) : [...prev, itemId]
    );
    setActiveItem(itemId);
  }, []);

  const handleUpdateField = useCallback(async (fieldName, value) => {
    if (activeItem) {
      const success = await updateField(activeItem, fieldName, value);
      if (success) {
        setSelectedItemData(prevData => ({
          ...prevData,
          [fieldName]: value
        }));
      }
    }
  }, [activeItem, updateField]);

  useEffect(() => {
    const loadItemData = async () => {
      if (activeItem) {
        const data = await fetchItemData(activeItem);
        if (data) {
          setSelectedItemData(data);
        }
      } else {
        setSelectedItemData(null);
      }
    };

    loadItemData();
  }, [activeItem, fetchItemData]);

  const handleCascade = useCallback((fieldName) => {
    const itemName = selectedItemData?.prompt_name || 'Unknown';
    setCascadeInfo({ itemName, fieldName });
    setShowParentPromptPopup(true);
  }, [selectedItemData]);

  if (!supabase) {
    return <div>Loading Supabase client...</div>;
  }

  return (
    <DndProvider backend={HTML5Backend}>
      <div className="container mx-auto p-4">
        <PanelGroup direction="horizontal">
          <Panel defaultSize={30} minSize={20}>
            <div className="border rounded-lg p-4 overflow-x-auto overflow-y-auto h-[calc(100vh-8rem)]">
              <div className="overflow-x-auto whitespace-nowrap w-full">
                <div className="mb-2 flex space-x-2">
                  <Button variant="ghost" size="icon" onClick={() => handleAddItem(null)}>
                    <PlusCircle className="h-5 w-5" />
                  </Button>
                </div>
                {isLoading ? (
                  <div>Loading...</div>
                ) : (
                  <TreeView
                    treeData={treeData}
                    expandedItems={expandedItems}
                    toggleItem={toggleItem}
                    editingItem={editingItem}
                    setEditingItem={setEditingItem}
                    handleUpdateField={handleUpdateField}
                    refreshTreeData={refreshTreeData}
                    activeItem={activeItem}
                    setActiveItem={setActiveItem}
                    handleAddItem={handleAddItem}
                    handleDeleteItem={handleDeleteItem}
                    handleDuplicateItem={handleDuplicateItem}
                    handleMoveItem={handleMoveItem}
                  />
                )}
              </div>
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
                  onCascade={handleCascade}
                />
              ) : (
                <div className="flex items-center justify-center h-full">
                  <p className="text-gray-500">Loading prompt details...</p>
                </div>
              )
            ) : (
              <div className="flex items-center justify-center h-full">
                <p className="text-gray-500">Select a prompt to view details</p>
              </div>
            )}
          </Panel>
        </PanelGroup>
        <ParentPromptPopup
          isOpen={showParentPromptPopup}
          onClose={() => setShowParentPromptPopup(false)}
          parentData={selectedItemData}
          cascadeField={cascadeInfo.fieldName}
        />
      </div>
    </DndProvider>
  );
};

export default Projects;