import React, { useRef, useEffect, useState } from 'react';
import { FileIcon, PlusIcon, EditIcon, Trash2Icon, ChevronRight } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const TreeItem = ({
  item,
  level,
  expandedItems,
  toggleItem,
  addItem,
  startRenaming,
  editingItem,
  setEditingItem,
  finishRenaming,
  cancelRenaming,
  activeItem,
  setActiveItem,
  deleteItem,
}) => {
  const inputRef = useRef(null);
  const [isHovered, setIsHovered] = useState(false);

  useEffect(() => {
    if (editingItem && editingItem.id === item.id && inputRef.current) {
      inputRef.current.focus();
    }
  }, [editingItem, item.id]);

  const renderActionButtons = () => (
    <div className="flex items-center space-x-1 ml-2">
      <ActionButton icon={<PlusIcon className="h-3 w-3" />} onClick={() => addItem(item.id)} tooltip="Add Prompt" />
      <ActionButton icon={<EditIcon className="h-3 w-3" />} onClick={() => startRenaming(item.id, item.prompt_name)} tooltip="Rename" />
      <ActionButton icon={<Trash2Icon className="h-3 w-3" />} onClick={() => deleteItem(item.id)} tooltip="Delete" />
    </div>
  );

  const displayName = item.prompt_name && item.prompt_name.trim() !== '' ? `${item.prompt_name} {${level}}` : `New Prompt {${level}}`;
  const isActive = activeItem === item.id;

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      finishRenaming();
    } else if (e.key === 'Escape') {
      cancelRenaming();
    }
  };

  const handleBlur = () => {
    cancelRenaming();
  };

  const handleDoubleClick = (e) => {
    e.stopPropagation();
    startRenaming(item.id, item.prompt_name);
  };

  return (
    <div className={`border-none ${level === 1 ? 'pt-3' : 'pt-0'} pb-0.1`}>
      <div
        className={`flex items-center hover:bg-gray-100 py-0 px-2 rounded ${isActive ? 'bg-blue-100' : ''}`}
        style={{ paddingLeft: `${level * 16}px` }}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        onClick={() => setActiveItem(item.id)}
      >
        <div className="flex items-center space-x-1 flex-grow">
          {item.children && item.children.length > 0 ? (
            <ChevronRight className="h-4 w-4 flex-shrink-0" />
          ) : (
            <div className="w-4 h-4 flex-shrink-0" /> // Placeholder for alignment
          )}
          <FileIcon className="h-4 w-4 flex-shrink-0" />
          {editingItem && editingItem.id === item.id ? (
            <Input
              ref={inputRef}
              value={editingItem.name}
              onChange={(e) => setEditingItem({ ...editingItem, name: e.target.value })}
              onKeyDown={handleKeyDown}
              onBlur={handleBlur}
              onClick={(e) => e.stopPropagation()}
              className="h-6 py-1 px-1"
            />
          ) : (
            <span 
              className={`ml-1 cursor-pointer ${isActive ? 'text-blue-600 font-bold' : 'text-gray-600 font-normal'}`}
              onDoubleClick={handleDoubleClick}
            >
              {displayName}
            </span>
          )}
          {isHovered && renderActionButtons()}
        </div>
      </div>
      {item.children && item.children.length > 0 && (
        <div>
          {item.children.map((child) => (
            <TreeItem
              key={child.id}
              item={child}
              level={level + 1}
              expandedItems={expandedItems}
              toggleItem={toggleItem}
              addItem={addItem}
              startRenaming={startRenaming}
              editingItem={editingItem}
              setEditingItem={setEditingItem}
              finishRenaming={finishRenaming}
              cancelRenaming={cancelRenaming}
              activeItem={activeItem}
              setActiveItem={setActiveItem}
              deleteItem={deleteItem}
            />
          ))}
        </div>
      )}
    </div>
  );
};

const ActionButton = ({ icon, onClick, tooltip }) => (
  <Button
    variant="ghost"
    size="sm"
    className="h-5 w-5 p-0"
    onClick={(e) => {
      e.stopPropagation();
      onClick && onClick(e);
    }}
  >
    {icon}
  </Button>
);

export default TreeItem;
