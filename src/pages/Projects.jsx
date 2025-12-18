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
import AssistantChatPanel from '../components/AssistantChatPanel';
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
  const [isAddingPrompt, setIsAddingPrompt] = useState(false);
  const { handleAddItem: addItem, handleDeleteItem, handleDuplicateItem, handleMoveItem } = useTreeOperations(supabase, refreshTreeData);
  const { updateField, fetchItemData } = usePromptData(supabase);

  // Wrap handleAddItem to auto-expand parent when adding a child and prevent multi-click
  const handleAddItem = useCallback(async (parentId) => {
    if (isAddingPrompt) return null; // Prevent multi-click
    setIsAddingPrompt(true);
    try {
      const newItemId = await addItem(parentId);
      if (newItemId && parentId) {
        // Expand the parent to show the new child
        setExpandedItems(prev => 
          prev.includes(parentId) ? prev : [...prev, parentId]
        );
      }
      return newItemId;
    } finally {
      setIsAddingPrompt(false);
    }
  }, [addItem, isAddingPrompt]);

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

  useEffect(() => {
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

  // Determine if we should show the chat panel (top-level prompt with active assistant)
  const isTopLevel = selectedItemData && !selectedItemData.parent_row_id;
  const showChatPanel = isTopLevel && selectedItemData?.is_assistant;

  if (!supabase) {
    return <div>Loading Supabase client...</div>;
  }

  return (
    <DndProvider backend={HTML5Backend}>
      <div className="container mx-auto p-4 h-[calc(100vh-6rem)]">
        <PanelGroup direction="horizontal" className="h-full">
          {/* Tree Panel */}
          <Panel defaultSize={showChatPanel ? 20 : 30} minSize={15}>
            <div className="border rounded-lg p-4 overflow-x-auto overflow-y-auto h-[calc(100vh-8rem)]">
              <div className="mb-2 flex space-x-2">
                <Button 
                  variant="ghost" 
                  size="icon" 
                  onClick={() => handleAddItem(null)}
                  disabled={isAddingPrompt}
                >
                  <PlusCircle className={`h-5 w-5 ${isAddingPrompt ? 'animate-spin' : ''}`} />
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

          <PanelResizeHandle className="w-2 bg-muted hover:bg-muted-foreground/20 transition-colors" />

          {/* Details Panel */}
          <Panel defaultSize={showChatPanel ? 40 : 70} minSize={30}>
            <div className="h-full overflow-y-auto">
              {activeItem ? (
                selectedItemData ? (
                  <ProjectPanels 
                    selectedItemData={selectedItemData} 
                    projectRowId={activeItem} 
                    onUpdateField={handleUpdateField}
                    onCascade={handleCascade}
                    isTopLevel={isTopLevel}
                  />
                ) : (
                  <div className="flex items-center justify-center h-full">
                    <p className="text-muted-foreground">Loading prompt details...</p>
                  </div>
                )
              ) : (
                <div className="flex items-center justify-center h-full">
                  <p className="text-muted-foreground">Select a prompt to view details</p>
                </div>
              )}
            </div>
          </Panel>

          {/* Chat Panel - only show for top-level prompts with active assistant */}
          {showChatPanel && (
            <>
              <PanelResizeHandle className="w-2 bg-muted hover:bg-muted-foreground/20 transition-colors" />
              <Panel defaultSize={40} minSize={25}>
                <AssistantChatPanel
                  promptRowId={activeItem}
                  promptName={selectedItemData?.prompt_name}
                />
              </Panel>
            </>
          )}
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