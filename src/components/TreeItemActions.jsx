import React, { useState } from 'react';
import { PlusIcon, EditIcon, Trash2Icon, Copy, ArrowUp, ArrowDown } from 'lucide-react';
import { Button } from "@/components/ui/button";

export const TreeItemActions = ({ item, addItem, deleteItem, duplicateItem, startRenaming, onMoveUp, onMoveDown }) => {
  const [isMovingUp, setIsMovingUp] = useState(false);
  const [isMovingDown, setIsMovingDown] = useState(false);

  const handleMoveUp = async () => {
    setIsMovingUp(true);
    try {
      await onMoveUp(item);
    } finally {
      setIsMovingUp(false);
    }
  };

  const handleMoveDown = async () => {
    setIsMovingDown(true);
    try {
      await onMoveDown(item);
    } finally {
      setIsMovingDown(false);
    }
  };

  const ActionButton = ({ icon, onClick, tooltip, loading }) => (
    <Button
      variant="ghost"
      size="sm"
      className={`h-5 w-5 p-0 ${loading ? 'cursor-wait' : ''}`}
      onClick={(e) => {
        e.stopPropagation();
        if (!loading) {
          onClick && onClick(e);
        }
      }}
      title={tooltip}
      disabled={loading}
    >
      {icon}
    </Button>
  );

  return (
    <div className="flex items-center space-x-1">
      <ActionButton 
        icon={<ArrowUp className="h-3 w-3" />} 
        onClick={handleMoveUp}
        tooltip="Move Up"
        loading={isMovingUp}
      />
      <ActionButton 
        icon={<ArrowDown className="h-3 w-3" />} 
        onClick={handleMoveDown}
        tooltip="Move Down"
        loading={isMovingDown}
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