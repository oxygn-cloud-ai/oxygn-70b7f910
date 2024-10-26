import React, { useState } from 'react';
import { PlusIcon, EditIcon, Trash2Icon, Copy, ArrowUpFromLine, ArrowDownFromLine } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { useTimer } from '../hooks/useTimer';

export const TreeItemActions = ({ item, addItem, deleteItem, duplicateItem, startRenaming }) => {
  const [isProcessing, setIsProcessing] = useState(false);
  const formattedTime = useTimer(isProcessing);

  const ActionButton = ({ icon, onClick, tooltip }) => {
    const handleClick = async (e) => {
      if (onClick) {
        e.stopPropagation();
        setIsProcessing(true);
        try {
          await onClick(e);
        } finally {
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
      >
        {icon}
        {isProcessing && <span className="ml-1 text-xs">{formattedTime}</span>}
      </Button>
    );
  };

  return (
    <div className="flex items-center space-x-1">
      <ActionButton 
        icon={<ArrowUpFromLine className="h-3 w-3" />} 
        tooltip="Move Up" 
      />
      <ActionButton 
        icon={<ArrowDownFromLine className="h-3 w-3" />} 
        tooltip="Move Down" 
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