import React, { useState, useCallback } from 'react';
import { PanelGroup, Panel, PanelResizeHandle } from 'react-resizable-panels';
import ProjectPanels from '../components/ProjectPanels';
import TreeView from '../components/TreeView';
import UnsavedChangesDialog from '../components/UnsavedChangesDialog';
import { useSupabase } from '../hooks/useSupabase';
import useTreeData from '../hooks/useTreeData';

const Projects = () => {
  const [activeItem, setActiveItem] = useState(null);
  const [selectedItemData, setSelectedItemData] = useState(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [pendingActiveItem, setPendingActiveItem] = useState(null);
  const supabase = useSupabase();
  const { treeData, addItem, updateItemName, deleteItem, isLoading, refreshTreeData } = useTreeData(supabase);

  const handleItemSelect = useCallback((itemId) => {
    if (hasUnsavedChanges) {
      setPendingActiveItem(itemId);
      setShowSaveDialog(true);
    } else {
      setActiveItem(itemId);
    }
  }, [hasUnsavedChanges]);

  const handleSaveChanges = async () => {
    // Implement save logic here
    setHasUnsavedChanges(false);
    setShowSaveDialog(false);
    if (pendingActiveItem) {
      setActiveItem(pendingActiveItem);
      setPendingActiveItem(null);
    }
  };

  const handleDiscardChanges = () => {
    setHasUnsavedChanges(false);
    setShowSaveDialog(false);
    if (pendingActiveItem) {
      setActiveItem(pendingActiveItem);
      setPendingActiveItem(null);
    }
  };

  const handleUpdateField = useCallback(async (fieldName, value) => {
    if (activeItem && supabase) {
      try {
        const { error } = await supabase
          .from('prompts')
          .update({ [fieldName]: value })
          .eq('row_id', activeItem);

        if (error) throw error;
        
        setSelectedItemData(prevData => ({
          ...prevData,
          [fieldName]: value
        }));

        if (fieldName === 'prompt_name') {
          await updateItemName(activeItem, value);
          await refreshTreeData();
        }
        setHasUnsavedChanges(false);
      } catch (error) {
        console.error('Error updating field:', error);
      }
    }
  }, [activeItem, updateItemName, supabase, refreshTreeData]);

  return (
    <div className="container mx-auto p-4">
      <PanelGroup direction="horizontal">
        <Panel defaultSize={30} minSize={20}>
          <TreeView
            treeData={treeData}
            activeItem={activeItem}
            onItemSelect={handleItemSelect}
            onAddItem={addItem}
            onUpdateItemName={updateItemName}
            onDeleteItem={deleteItem}
            isLoading={isLoading}
            refreshTreeData={refreshTreeData}
          />
        </Panel>
        <PanelResizeHandle className="w-2 bg-gray-200 hover:bg-gray-300 transition-colors" />
        <Panel>
          <ProjectPanels 
            selectedItemData={selectedItemData} 
            projectRowId={activeItem} 
            onUpdateField={handleUpdateField}
            setHasUnsavedChanges={setHasUnsavedChanges}
          />
        </Panel>
      </PanelGroup>
      <UnsavedChangesDialog
        open={showSaveDialog}
        onOpenChange={setShowSaveDialog}
        onSave={handleSaveChanges}
        onDiscard={handleDiscardChanges}
      />
    </div>
  );
};

export default Projects;
