import React, { useState } from 'react';
import { PlusIcon, EditIcon, Trash2Icon, Copy, ArrowUpFromLine, ArrowDownFromLine } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { useSupabase } from '../hooks/useSupabase';
import { updatePromptPosition } from '../services/promptService';
import { toast } from 'sonner';

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
  const supabase = useSupabase();

  const findSiblingPositions = (direction) => {
    if (!siblings || !Array.isArray(siblings)) return null;
    
    const currentIndex = siblings.findIndex(sibling => sibling.id === item.id);
    if (currentIndex === -1) return null;

    if (direction === 'up' && currentIndex > 0) {
      return {
        prevId: currentIndex > 1 ? siblings[currentIndex - 2].id : null,
        nextId: siblings[currentIndex - 1].id
      };
    } else if (direction === 'down' && currentIndex < siblings.length - 1) {
      return {
        prevId: siblings[currentIndex + 1].id,
        nextId: currentIndex < siblings.length - 2 ? siblings[currentIndex + 2].id : null
      };
    }
    return null;
  };

  const handleMove = async (direction) => {
    const positions = findSiblingPositions(direction);
    if (!positions) {
      toast.error(`Cannot move ${direction} any further`);
      return;
    }

    try {
      setIsProcessing(true);
      await updatePromptPosition(supabase, item.id, positions.prevId, positions.nextId);
      if (onRefreshTreeData) {
        await onRefreshTreeData();
      }
      toast.success(`Item moved ${direction} successfully`);
    } catch (error) {
      console.error(`Error moving item ${direction}:`, error);
      toast.error(`Failed to move item ${direction}`);
    } finally {
      setIsProcessing(false);
    }
  };

  const ActionButton = ({ icon, onClick, tooltip, disabled }) => {
    const handleClick = async (e) => {
      if (onClick && !disabled) {
        e.stopPropagation();
        document.body.style.cursor = 'wait';
        setIsProcessing(true);
        try {
          await onClick(e);
        } finally {
          document.body.style.cursor = 'default';
          setIsProcessing(false);
        }
      }
    };

    return (
      <Button
        variant="ghost"
        size="sm"
        className="h-5 w-5 p-0"
        onClick={handleClick}
        title={tooltip}
        disabled={disabled || isProcessing}
      >
        {icon}
      </Button>
    );
  };

  const isFirstSibling = siblings && siblings[0]?.id === item.id;
  const isLastSibling = siblings && siblings[siblings.length - 1]?.id === item.id;

  return (
    <div className="flex items-center space-x-1">
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
        icon={<PlusIcon className="h-3 w-3" />} 
        onClick={() => addItem && addItem(item.id)} 
        tooltip="Add Prompt" 
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
    </div>
  );
};