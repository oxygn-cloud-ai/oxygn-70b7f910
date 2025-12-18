import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { PlusCircle, Loader2, Check, X, Square } from 'lucide-react';
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
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Progress } from "@/components/ui/progress";

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

  // Bulk add state for top-level button
  const [showBulkAdd, setShowBulkAdd] = useState(false);
  const [bulkCount, setBulkCount] = useState('2');
  const [bulkProgress, setBulkProgress] = useState({ current: 0, total: 0, isAdding: false });
  const longPressTimer = useRef(null);
  const longPressTriggered = useRef(false);
  const cancelBulkAdd = useRef(false);

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

  // Bulk add handlers for top-level button
  const handleBulkAdd = async () => {
    const count = parseInt(bulkCount, 10);
    if (isNaN(count) || count < 1 || count > 999) {
      toast.error('Please enter a number between 1 and 999');
      return;
    }
    setShowBulkAdd(false);
    cancelBulkAdd.current = false;
    setBulkProgress({ current: 0, total: count, isAdding: true });
    
    let added = 0;
    for (let i = 0; i < count; i++) {
      if (cancelBulkAdd.current) {
        toast.info(`Cancelled after adding ${added} prompts`);
        break;
      }
      await addItem(null);
      added++;
      setBulkProgress(prev => ({ ...prev, current: added }));
    }
    
    setBulkProgress({ current: 0, total: 0, isAdding: false });
    if (!cancelBulkAdd.current) {
      toast.success(`Added ${count} top-level prompts`);
    }
    cancelBulkAdd.current = false;
  };

  const handleCancelBulkAdd = useCallback(() => {
    cancelBulkAdd.current = true;
  }, []);

  const startLongPress = useCallback((e) => {
    e.preventDefault();
    longPressTriggered.current = false;
    longPressTimer.current = setTimeout(() => {
      longPressTriggered.current = true;
      setShowBulkAdd(true);
    }, 500);
  }, []);

  const cancelLongPress = useCallback(() => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  }, []);

  const handleAddClick = useCallback(() => {
    cancelLongPress();
    if (!longPressTriggered.current && !showBulkAdd) {
      handleAddItem(null);
    }
    longPressTriggered.current = false;
  }, [cancelLongPress, showBulkAdd, handleAddItem]);

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
        // This item is at this level, return it if top-level
        return item.parent_row_id ? null : item;
      }
      if (item.children && item.children.length > 0) {
        // Check if rowId is in this subtree
        const foundInChildren = findTopLevelAncestor(rowId, item.children);
        if (foundInChildren !== null) {
          // The item was found in this subtree, so this item is an ancestor
          return item.parent_row_id ? null : item;
        }
        // Also check if the item is a direct child
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
    
    // Walk up the tree to find top-level parent
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
  
  // The row_id to pass to AssistantChatPanel (always the top-level prompt)
  const chatPanelPromptRowId = isTopLevel ? activeItem : topLevelAncestor?.id;
  const chatPanelPromptName = isTopLevel ? selectedItemData?.prompt_name : topLevelAncestor?.prompt_name;

  if (!supabase) {
    return <div>Loading Supabase client...</div>;
  }

  return (
    <DndProvider backend={HTML5Backend}>
      <div className="w-full px-4 py-4 h-[calc(100vh-6rem)]">
        <PanelGroup direction="horizontal" className="h-full">
          {/* Tree Panel */}
          <Panel defaultSize={showChatPanel ? 20 : 30} minSize={15}>
            <div className="border rounded-lg p-4 overflow-x-auto overflow-y-auto h-[calc(100vh-8rem)]">
              <div className="mb-2 flex space-x-2">
                {bulkProgress.isAdding ? (
                  <div className="flex items-center gap-1 px-1">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span className="text-xs text-muted-foreground">{bulkProgress.current}/{bulkProgress.total}</span>
                    <Progress value={(bulkProgress.current / bulkProgress.total) * 100} className="w-16 h-1.5" />
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={handleCancelBulkAdd}>
                            <Square className="h-3 w-3 fill-current" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Cancel</TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </div>
                ) : (
                  <Popover open={showBulkAdd} onOpenChange={setShowBulkAdd}>
                    <PopoverTrigger asChild>
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        onClick={handleAddClick}
                        onMouseDown={startLongPress}
                        onMouseLeave={cancelLongPress}
                        onTouchStart={startLongPress}
                        disabled={isAddingPrompt}
                        title="Add Prompt (long-press for bulk)"
                      >
                        <PlusCircle className={`h-5 w-5 ${isAddingPrompt ? 'animate-spin' : ''}`} />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-1.5" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center gap-1">
                        <Input
                          type="number"
                          min="1"
                          max="999"
                          value={bulkCount}
                          onChange={(e) => setBulkCount(e.target.value)}
                          className="h-6 w-14 text-xs text-center px-1"
                          onKeyDown={(e) => e.key === 'Enter' && handleBulkAdd()}
                          autoFocus
                        />
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={handleBulkAdd}>
                                <Check className="h-3 w-3" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Add</TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => setShowBulkAdd(false)}>
                                <X className="h-3 w-3" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Cancel</TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </div>
                    </PopoverContent>
                  </Popover>
                )}
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

          {/* Chat Panel - show for any prompt with a top-level ancestor that has an active assistant */}
          {showChatPanel && chatPanelPromptRowId && (
            <>
              <PanelResizeHandle className="w-2 bg-muted hover:bg-muted-foreground/20 transition-colors" />
              <Panel defaultSize={40} minSize={25}>
                <AssistantChatPanel
                  promptRowId={chatPanelPromptRowId}
                  promptName={chatPanelPromptName}
                  selectedChildPromptId={!isTopLevel ? activeItem : null}
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
