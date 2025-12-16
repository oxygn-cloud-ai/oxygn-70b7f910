import React, { useState, useEffect, useCallback } from 'react';
import { PlusCircle } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { DndProvider } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';
import { useSupabase } from '../hooks/useSupabase';
import { useOpenAIModels } from '../hooks/useOpenAIModels';
import useTreeData from '../hooks/useTreeData';
import { useTreeOperations } from '../hooks/useTreeOperations';
import { usePromptData } from '../hooks/usePromptData';
import ProjectPanels from '../components/ProjectPanels';
import ParentPromptPopup from '../components/ParentPromptPopup';
import TreeView from '../components/TreeView';
import { PanelGroup, Panel, PanelResizeHandle } from 'react-resizable-panels';
import { toast } from 'sonner';

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
  const { handleAddItem: addItem, handleDeleteItem, handleDuplicateItem, handleMoveItem } = useTreeOperations(supabase, refreshTreeData);
  const { updateField, fetchItemData } = usePromptData(supabase);

  // Wrap handleAddItem to auto-expand parent when adding a child
  const handleAddItem = useCallback(async (parentId) => {
    const newItemId = await addItem(parentId);
    if (newItemId && parentId) {
      // Expand the parent to show the new child
      setExpandedItems(prev => 
        prev.includes(parentId) ? prev : [...prev, parentId]
      );
    }
    return newItemId;
  }, [addItem]);

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
        if (fieldName === 'prompt_name') {
          setSelectedItemData(prev => ({
            ...prev,
            prompt_name: value
          }));
          await refreshTreeData();
        } else {
          setSelectedItemData(prev => ({
            ...prev,
            [fieldName]: value
          }));
        }
      }
    }
  }, [activeItem, updateField, refreshTreeData]);

  const handleCascade = useCallback((fieldName) => {
    if (selectedItemData) {
      setCascadeInfo({ 
        itemName: selectedItemData.prompt_name || 'Prompt', 
        fieldName 
      });
      setShowParentPromptPopup(true);
    }
  }, [selectedItemData]);
    const loadItemData = async () => {
      if (activeItem) {
        const data = await fetchItemData(activeItem);
        if (data) {
          setSelectedItemData(prev => ({
            ...prev,
            ...data
          }));
        }
      } else {
        setSelectedItemData(null);
      }
    };

    loadItemData();
  }, [activeItem, fetchItemData]);

  if (!supabase) {
    return <div>Loading Supabase client...</div>;
  }

  return (
    <DndProvider backend={HTML5Backend}>
      <div className="container mx-auto p-4">
        <PanelGroup direction="horizontal">
          <Panel defaultSize={30} minSize={20}>
            <div className="border rounded-lg p-4 overflow-x-auto overflow-y-auto h-[calc(100vh-8rem)]">
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