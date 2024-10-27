import React, { useState } from 'react';
import { PlusIcon, EditIcon, Trash2Icon, Copy, ArrowUpFromLine, ArrowDownFromLine, Info } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { useSupabase } from '../hooks/useSupabase';
import { movePromptPosition } from '../services/promptMutations';
import { toast } from 'sonner';
import DebugInfoPopup from './DebugInfoPopup';

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
  const supabase = useSupabase();

  const handleMove = async (direction) => {
    // Get siblings array, ensuring it's valid
    const siblingsArray = Array.isArray(siblings) ? siblings : [];
    
    // If no siblings array was provided, fetch top-level items
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
              toast.success(`Item moved ${direction} successfully`);
            }
          } finally {
            setIsProcessing(false);
          }
          return;
        }
      } catch (error) {
        console.error('Error fetching top-level items:', error);
        toast.error('Failed to fetch items for movement');
        return;
      }
    }

    // Handle non-top-level items
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
        toast.success(`Item moved ${direction} successfully`);
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

  const ActionButton = ({ icon, onClick, tooltip, disabled }) => (
    <Button
      variant="ghost"
      size="sm"
      className="h-5 w-5 p-0"
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
      title={tooltip}
      disabled={disabled || isProcessing}
    >
      {icon}
    </Button>
  );

  // Calculate sibling positions
  const siblingsArray = Array.isArray(siblings) ? siblings : [];
  const isFirstSibling = siblingsArray.length > 0 && siblingsArray[0]?.id === item.id;
  const isLastSibling = siblingsArray.length > 0 && siblingsArray[siblingsArray.length - 1]?.id === item.id;

  return (
    <div className="flex items-center space-x-1">
      <ActionButton 
        icon={<PlusIcon className="h-3 w-3" />} 
        onClick={() => addItem && addItem(item.id)} 
        tooltip="Add Prompt" 
      />
      <ActionButton 
        icon={<ArrowUpFromLine className="h-3 w-3" />} 
        onClick={() => handleMove('up')}
        tooltip="Move Up"
        disabled={isFirstSibling}
      />
      <ActionButton 
        icon={<ArrowDownFromLine className="h-3 w-3" />} 
        onClick={() => handleMove('down')}
        tooltip="Move Down"
        disabled={isLastSibling}
      />
      <ActionButton 
        icon={<EditIcon className="h-3 w-3" />} 
        onClick={() => startRenaming(item.id, item.prompt_name)} 
        tooltip="Rename" 
      />
      <ActionButton 
        icon={<Trash2Icon className="h-3 w-3" />} 
        onClick={() => deleteItem(item.id)} 
        tooltip="Delete" 
      />
      <ActionButton 
        icon={<Copy className="h-3 w-3" />} 
        onClick={() => duplicateItem(item.id)} 
        tooltip="Duplicate" 
      />
      {import.meta.env.VITE_DEBUG === 'TRUE' && (
        <>
          <ActionButton 
            icon={<Info className="h-3 w-3" />} 
            onClick={() => setShowDebugInfo(true)}
            tooltip="Debug Info" 
          />
          <DebugInfoPopup
            isOpen={showDebugInfo}
            onClose={() => setShowDebugInfo(false)}
            item={item}
            onSave={handleUpdatePosition}
          />
        </>
      )}
    </div>
  );
};
