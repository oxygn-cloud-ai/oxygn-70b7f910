import React, { useState, useRef, useCallback } from 'react';
import { PlusIcon, EditIcon, Trash2Icon, Copy, ArrowUp, ArrowDown, Info, Check, X, Loader2, Square } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { useSupabase } from '../hooks/useSupabase';
import { movePromptPosition } from '../services/promptMutations';
import { toast } from '@/components/ui/sonner';
import DebugInfoPopup from './DebugInfoPopup';
import NewPromptChoiceDialog from './NewPromptChoiceDialog';
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Progress } from "@/components/ui/progress";

export const TreeItemActions = ({ 
  item, 
  addItem, 
  deleteItem, 
  duplicateItem, 
  startRenaming, 
  siblings,
  onRefreshTreeData
}) => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [showDebugInfo, setShowDebugInfo] = useState(false);
  const [showBulkAdd, setShowBulkAdd] = useState(false);
  const [showNewPromptChoice, setShowNewPromptChoice] = useState(false);
  const [bulkCount, setBulkCount] = useState('2');
  const [bulkProgress, setBulkProgress] = useState({ current: 0, total: 0, isAdding: false });
  const longPressTimer = useRef(null);
  const cancelBulkAdd = useRef(false);
  const supabase = useSupabase();

  const handleMove = async (direction) => {
    const siblingsArray = Array.isArray(siblings) ? siblings : [];
    
    if (siblingsArray.length === 0) {
      try {
        const { data: topLevelItems } = await supabase
          .from(import.meta.env.VITE_PROMPTS_TBL)
          .select('row_id, position, prompt_name')
          .is('parent_row_id', null)
          .eq('is_deleted', false)
          .order('position', { ascending: true });

        if (topLevelItems && topLevelItems.length > 0) {
          const currentIndex = topLevelItems.findIndex(prompt => prompt.row_id === item.id);
          if (currentIndex === -1) {
            toast.error('Item not found in current level');
            return;
          }

          try {
            setIsProcessing(true);
            const success = await movePromptPosition(supabase, item.id, topLevelItems, currentIndex, direction);
            if (success) {
              if (typeof onRefreshTreeData === 'function') {
                await onRefreshTreeData();
              }
              toast.success(`Moved ${direction}`);
            }
          } finally {
            setIsProcessing(false);
          }
          return;
        }
      } catch (error) {
        console.error('Error fetching top-level items:', error);
        toast.error('Failed to move item');
        return;
      }
    }

    const currentIndex = siblingsArray.findIndex(sibling => sibling.id === item.id);
    if (currentIndex === -1) {
      toast.error('Item not found in current level');
      return;
    }

    try {
      setIsProcessing(true);
      const success = await movePromptPosition(supabase, item.id, siblingsArray, currentIndex, direction);
      if (success) {
        if (typeof onRefreshTreeData === 'function') {
          await onRefreshTreeData();
        }
        toast.success(`Moved ${direction}`);
      }
    } finally {
      setIsProcessing(false);
    }
  };

  const handleUpdatePosition = async (newPosition) => {
    try {
      const { error } = await supabase
        .from(import.meta.env.VITE_PROMPTS_TBL)
        .update({ position: newPosition })
        .eq('row_id', item.id);

      if (error) throw error;
      if (typeof onRefreshTreeData === 'function') {
        await onRefreshTreeData();
      }
    } catch (error) {
      console.error('Error updating position:', error);
      throw error;
    }
  };

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
    try {
      for (let i = 0; i < count; i++) {
        if (cancelBulkAdd.current) {
          toast.info(`Cancelled after adding ${added} prompts`);
          break;
        }
        // Skip refresh during bulk add - we'll refresh once at the end
        await addItem(item.id, { skipRefresh: true });
        added++;
        setBulkProgress(prev => ({ ...prev, current: added }));
      }
    } finally {
      // Always refresh tree once at the end
      if (added > 0 && onRefreshTreeData) {
        await onRefreshTreeData();
      }
      setBulkProgress({ current: 0, total: 0, isAdding: false });
    }
    
    if (!cancelBulkAdd.current && added === count) {
      toast.success(`Added ${count} child prompts`);
    }
    cancelBulkAdd.current = false;
  };

  const handleCancelBulkAdd = useCallback(() => {
    cancelBulkAdd.current = true;
  }, []);

  const longPressTriggered = useRef(false);

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

  const handleAddClick = useCallback((e) => {
    cancelLongPress();
    if (!longPressTriggered.current && !showBulkAdd && addItem) {
      addItem(item.id);
    }
    longPressTriggered.current = false;
  }, [cancelLongPress, showBulkAdd, addItem, item.id]);

  const siblingsArray = Array.isArray(siblings) ? siblings : [];
  const isFirstSibling = siblingsArray.length > 0 && siblingsArray[0]?.id === item.id;
  const isLastSibling = siblingsArray.length > 0 && siblingsArray[siblingsArray.length - 1]?.id === item.id;

  const ActionButton = ({ icon, onClick, tooltip, disabled, variant = 'default' }) => (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className={`
              h-6 w-6 p-0 
              ${variant === 'destructive' ? 'hover:bg-destructive/10 hover:text-destructive' : 'hover:bg-muted'}
              ${disabled ? 'opacity-30 cursor-not-allowed' : ''}
            `}
            onClick={async (e) => {
              if (onClick && !disabled) {
                e.stopPropagation();
                setIsProcessing(true);
                try {
                  await onClick(e);
                } finally {
                  setIsProcessing(false);
                }
              }
            }}
            disabled={disabled || isProcessing}
          >
            {icon}
          </Button>
        </TooltipTrigger>
        <TooltipContent side="top" className="text-xs">
          {tooltip}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );

  return (
    <div className="flex items-center gap-0.5" onClick={(e) => e.stopPropagation()}>
      {bulkProgress.isAdding ? (
        <div className="flex items-center gap-1.5 px-1.5 py-0.5 bg-muted rounded">
          <Loader2 className="h-3 w-3 animate-spin text-primary" />
          <span className="text-[10px] text-muted-foreground font-medium">
            {bulkProgress.current}/{bulkProgress.total}
          </span>
          <Progress value={(bulkProgress.current / bulkProgress.total) * 100} className="w-10 h-1" />
          <Button 
            variant="ghost" 
            size="sm" 
            className="h-5 w-5 p-0 hover:bg-destructive/10" 
            onClick={handleCancelBulkAdd}
          >
            <Square className="h-2.5 w-2.5 fill-current text-destructive" />
          </Button>
        </div>
      ) : (
        <>
          {/* Add button - opens choice dialog */}
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 w-6 p-0 hover:bg-primary/10 hover:text-primary"
                  disabled={isProcessing}
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowNewPromptChoice(true);
                  }}
                >
                  <PlusIcon className="h-3.5 w-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="top" className="text-xs">
                Add child prompt
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>

          {/* Bulk add popover */}
          <Popover open={showBulkAdd} onOpenChange={setShowBulkAdd}>
            <PopoverTrigger asChild>
              <span className="hidden" />
            </PopoverTrigger>
            <PopoverContent className="w-auto p-2 bg-popover" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center gap-1.5">
                <span className="text-xs text-muted-foreground">Add</span>
                <Input
                  type="number"
                  min="1"
                  max="999"
                  value={bulkCount}
                  onChange={(e) => setBulkCount(e.target.value)}
                  className="h-7 w-14 text-xs text-center px-1"
                  onKeyDown={(e) => e.key === 'Enter' && handleBulkAdd()}
                  autoFocus
                />
                <span className="text-xs text-muted-foreground">children</span>
                <Button variant="ghost" size="sm" className="h-7 w-7 p-0 hover:bg-primary/10" onClick={handleBulkAdd}>
                  <Check className="h-3.5 w-3.5 text-primary" />
                </Button>
                <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => setShowBulkAdd(false)}>
                  <X className="h-3.5 w-3.5" />
                </Button>
              </div>
            </PopoverContent>
          </Popover>

          {/* New Prompt Choice Dialog */}
          <NewPromptChoiceDialog
            isOpen={showNewPromptChoice}
            onClose={() => setShowNewPromptChoice(false)}
            parentId={item.id}
            onCreatePlain={() => addItem(item.id)}
            onPromptCreated={async () => {
              if (typeof onRefreshTreeData === 'function') {
                await onRefreshTreeData();
              }
            }}
          />

          <ActionButton 
            icon={<ArrowUp className="h-3.5 w-3.5" />} 
            onClick={() => handleMove('up')}
            tooltip="Move up"
            disabled={isFirstSibling}
          />
          <ActionButton 
            icon={<ArrowDown className="h-3.5 w-3.5" />} 
            onClick={() => handleMove('down')}
            tooltip="Move down"
            disabled={isLastSibling}
          />
          <ActionButton 
            icon={<EditIcon className="h-3.5 w-3.5" />} 
            onClick={() => startRenaming(item.id, item.prompt_name)} 
            tooltip="Rename" 
          />
          <ActionButton 
            icon={<Copy className="h-3.5 w-3.5" />} 
            onClick={() => duplicateItem(item.id)} 
            tooltip="Duplicate" 
          />
          <ActionButton 
            icon={<Trash2Icon className="h-3.5 w-3.5" />} 
            onClick={() => deleteItem(item.id)} 
            tooltip="Delete"
            variant="destructive"
          />
          
          {import.meta.env.VITE_DEBUG === 'TRUE' && (
            <>
              <ActionButton 
                icon={<Info className="h-3.5 w-3.5" />} 
                onClick={() => setShowDebugInfo(true)}
                tooltip="Debug info" 
              />
              <DebugInfoPopup
                isOpen={showDebugInfo}
                onClose={() => setShowDebugInfo(false)}
                item={item}
                onSave={handleUpdatePosition}
              />
            </>
          )}
        </>
      )}
    </div>
  );
};
