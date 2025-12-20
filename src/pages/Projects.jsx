import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { Loader2 } from 'lucide-react';
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
import EmptyState from '../components/EmptyState';
import { PanelGroup, Panel, PanelResizeHandle } from 'react-resizable-panels';
import { toast } from '@/components/ui/sonner';
import { useCreatePrompt } from '@/contexts/CreatePromptContext';

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
  const { setCreatePromptHandler } = useCreatePrompt();

  // Wrap handleAddItem to auto-expand parent when adding a child and prevent multi-click
  const handleAddItem = useCallback(async (parentId) => {
    if (isAddingPrompt) return null;
    setIsAddingPrompt(true);
    try {
      const newItemId = await addItem(parentId);
      if (newItemId && parentId) {
        setExpandedItems(prev => 
          prev.includes(parentId) ? prev : [...prev, parentId]
        );
      }
      return newItemId;
    } finally {
      setIsAddingPrompt(false);
    }
  }, [addItem, isAddingPrompt]);

  // Register create prompt handler for sidebar
  useEffect(() => {
    setCreatePromptHandler(() => () => handleAddItem(null));
    return () => setCreatePromptHandler(null);
  }, [handleAddItem, setCreatePromptHandler]);

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

  // Find the top-level ancestor for a prompt (recursive tree walk)
  const findTopLevelAncestor = useCallback((rowId, data = treeData) => {
    for (const item of data) {
      if (item.id === rowId) {
        return item.parent_row_id ? null : item;
      }
      if (item.children && item.children.length > 0) {
        const foundInChildren = findTopLevelAncestor(rowId, item.children);
        if (foundInChildren !== null) {
          return item.parent_row_id ? null : item;
        }
        const isDirectChild = item.children.some(c => c.id === rowId);
        if (isDirectChild) {
          return item.parent_row_id ? null : item;
        }
      }
    }
    return null;
  }, [treeData]);

  // Determine if we should show the chat panel
  const isTopLevel = selectedItemData && !selectedItemData.parent_row_id;
  
  // Find top-level ancestor for chat panel visibility
  const topLevelAncestor = useMemo(() => {
    if (!activeItem || !treeData.length) return null;
    if (isTopLevel) return selectedItemData;
    
    const findAncestorInTree = (items, targetId, ancestors = []) => {
      for (const item of items) {
        if (item.id === targetId) {
          return ancestors.length > 0 ? ancestors[0] : null;
        }
        if (item.children?.length > 0) {
          const found = findAncestorInTree(item.children, targetId, [item, ...ancestors]);
          if (found) return found;
        }
      }
      return null;
    };
    
    return findAncestorInTree(treeData, activeItem);
  }, [activeItem, treeData, isTopLevel, selectedItemData]);

  // Show chat panel if we have a top-level prompt with is_assistant=true
  const showChatPanel = isTopLevel 
    ? selectedItemData?.is_assistant 
    : topLevelAncestor?.is_assistant;
  
  // The row_id to pass to AssistantChatPanel
  const chatPanelPromptRowId = isTopLevel ? activeItem : topLevelAncestor?.id;
  const chatPanelPromptName = isTopLevel ? selectedItemData?.prompt_name : topLevelAncestor?.prompt_name;

  if (!supabase) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <DndProvider backend={HTML5Backend}>
      <div className="w-full h-[calc(100vh-4rem)] bg-background">
        <PanelGroup direction="horizontal" className="h-full">
          {/* Tree Panel */}
          <Panel defaultSize={showChatPanel ? 22 : 28} minSize={18}>
            <div className="h-full border-r border-border bg-card/50">
              {isLoading ? (
                <div className="flex items-center justify-center h-full">
                  <Loader2 className="h-6 w-6 animate-spin text-primary" />
                </div>
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

          {/* Resize Handle */}
          <PanelResizeHandle className="w-1.5 bg-border hover:bg-primary/30 active:bg-primary/50 transition-colors cursor-col-resize group">
            <div className="w-full h-full flex items-center justify-center">
              <div className="w-0.5 h-8 bg-muted-foreground/30 group-hover:bg-primary/50 rounded-full transition-colors" />
            </div>
          </PanelResizeHandle>

          {/* Details Panel */}
          <Panel defaultSize={showChatPanel ? 40 : 72} minSize={30}>
            <div className="h-full overflow-y-auto bg-background">
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
                    <Loader2 className="h-6 w-6 animate-spin text-primary" />
                  </div>
                )
              ) : (
                <EmptyState
                  icon="folder"
                  title="Select a prompt"
                  description="Choose a prompt from the panel on the left to view and edit its details."
                  className="h-full"
                />
              )}
            </div>
          </Panel>

          {/* Chat Panel */}
          {showChatPanel && chatPanelPromptRowId && (
            <>
              <PanelResizeHandle className="w-1.5 bg-border hover:bg-primary/30 active:bg-primary/50 transition-colors cursor-col-resize group">
                <div className="w-full h-full flex items-center justify-center">
                  <div className="w-0.5 h-8 bg-muted-foreground/30 group-hover:bg-primary/50 rounded-full transition-colors" />
                </div>
              </PanelResizeHandle>
              <Panel defaultSize={38} minSize={25}>
                <div className="h-full border-l border-border">
                  <AssistantChatPanel
                    promptRowId={chatPanelPromptRowId}
                    promptName={chatPanelPromptName}
                    selectedChildPromptId={!isTopLevel ? activeItem : null}
                  />
                </div>
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
