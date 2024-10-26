import React, { useState } from 'react';
import { PlusIcon, EditIcon, Trash2Icon, Copy, ArrowUpFromLine, ArrowDownFromLine } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { useSupabase } from '../hooks/useSupabase';
import { movePromptPosition } from '../services/promptMutations';
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

  const handleMove = async (direction) => {
    if (!siblings || !Array.isArray(siblings)) {
      toast.error('Cannot determine item position');
      return;
    }

    const currentIndex = siblings.findIndex(sibling => sibling.id === item.id);
    if (currentIndex === -1) {
      toast.error('Item not found in current level');
      return;
    }

    try {
      setIsProcessing(true);
      const success = await movePromptPosition(supabase, item.id, siblings, currentIndex, direction);
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

  const isFirstSibling = siblings && siblings[0]?.id === item.id;
  const isLastSibling = siblings && siblings[siblings.length - 1]?.id === item.id;

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
    </div>
  );
};