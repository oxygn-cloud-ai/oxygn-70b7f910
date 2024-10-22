import React from 'react';
import { FileIcon, ChevronRight, ChevronDown } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { TreeItemActions } from './TreeItemActions';

export const TreeItemContent = ({
  item,
  level,
  isExpanded,
  isActive,
  toggleItem,
  setActiveItem,
  editingItem,
  setEditingItem,
  finishRenaming,
  cancelRenaming,
  startRenaming,
  isHovered,
  setIsHovered,
  addItem,
  deleteItem,
  duplicateItem,
}) => {
  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      finishRenaming();
    } else if (e.key === 'Escape') {
      cancelRenaming();
    }
  };

  const handleToggle = (e) => {
    e.stopPropagation();
    toggleItem(item.id);
  };

  const displayName = item.prompt_name && item.prompt_name.trim() !== '' ? `${item.prompt_name} {${level}}` : `New Prompt {${level}}`;

  return (
    <div
      className={`flex items-center justify-between hover:bg-gray-100 py-0 px-2 rounded ${isActive ? 'bg-blue-100' : ''} group`}
      style={{ paddingLeft: `${level * 16}px` }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={() => setActiveItem(item.id)}
    >
      <div className="flex items-center space-x-1 flex-grow">
        {item.children && item.children.length > 0 ? (
          <Button
            variant="ghost"
            size="sm"
            className="p-0 h-4 w-4"
            onClick={handleToggle}
          >
            {isExpanded ? (
              <ChevronDown className="h-4 w-4 flex-shrink-0" />
            ) : (
              <ChevronRight className="h-4 w-4 flex-shrink-0" />
            )}
          </Button>
        ) : (
          <div className="w-4 h-4 flex-shrink-0" />
        )}
        <FileIcon className="h-4 w-4 flex-shrink-0" />
        {editingItem && editingItem.id === item.id ? (
          <Input
            value={editingItem.name}
            onChange={(e) => setEditingItem({ ...editingItem, name: e.target.value })}
            onKeyDown={handleKeyDown}
            onBlur={cancelRenaming}
            onClick={(e) => e.stopPropagation()}
            className="h-6 py-1 px-1 text-sm"
          />
        ) : (
          <span 
            className={`ml-1 cursor-pointer text-sm ${isActive ? 'text-blue-600 font-bold' : 'text-gray-600 font-normal'}`}
            onDoubleClick={() => startRenaming(item.id, item.prompt_name)}
          >
            {displayName}
          </span>
        )}
      </div>
      <div className="opacity-0 group-hover:opacity-100 transition-opacity">
        <TreeItemActions
          item={item}
          addItem={addItem}
          deleteItem={deleteItem}
          duplicateItem={duplicateItem}
          startRenaming={startRenaming}
        />
      </div>
    </div>
  );
};