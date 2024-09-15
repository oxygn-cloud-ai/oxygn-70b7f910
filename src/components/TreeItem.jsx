import React, { useRef, useEffect, useState } from 'react';
import {
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { FileIcon, PlusIcon, TrashIcon, EditIcon } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const TreeItem = ({
  item,
  level,
  expandedItems,
  toggleItem,
  addItem,
  deleteItem,
  startRenaming,
  editingItem,
  setEditingItem,
  finishRenaming,
  cancelRenaming,
  activeItem,
  setActiveItem,
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
      <ActionButton icon={<TrashIcon className="h-3 w-3" />} onClick={() => deleteItem(item.id)} tooltip="Delete" />
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

  const paddingClasses = level === 1 ? 'pt-6 pb-3' : 'pt-3 pb-3';

  return (
    <AccordionItem 
      value={item.id} 
      className={`border-none ${paddingClasses}`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <AccordionTrigger
        onClick={() => {
          toggleItem(item.id);
          setActiveItem(item.id);
        }}
        className={`hover:no-underline py-0 flex items-center ${isActive ? 'text-blue-600 font-bold' : 'text-gray-600 font-normal'}`}
        style={{ paddingLeft: `${level * 16}px` }}
      >
        <div className="flex items-center space-x-1 flex-grow">
          <FileIcon className="h-4 w-4" />
          {editingItem && editingItem.id === item.id ? (
            <Input
              ref={inputRef}
              value={editingItem.name}
              onChange={(e) => setEditingItem({ ...editingItem, name: e.target.value })}
              onKeyDown={handleKeyDown}
              onBlur={handleBlur}
              onClick={(e) => e.stopPropagation()}
              className="h-6 py-0 px-1"
            />
          ) : (
            <span 
              className={`ml-1 cursor-pointer ${isActive ? 'hover:text-blue-800' : 'hover:text-gray-800'}`}
              onDoubleClick={handleDoubleClick}
            >
              {displayName}
            </span>
          )}
          {isHovered && renderActionButtons()}
        </div>
      </AccordionTrigger>
      {item.children && item.children.length > 0 && (
        <AccordionContent className="pt-0 pb-0">
          {item.children.map((child) => (
            <TreeItem
              key={child.id}
              item={child}
              level={level + 1}
              expandedItems={expandedItems}
              toggleItem={toggleItem}
              addItem={addItem}
              deleteItem={deleteItem}
              startRenaming={startRenaming}
              editingItem={editingItem}
              setEditingItem={setEditingItem}
              finishRenaming={finishRenaming}
              cancelRenaming={cancelRenaming}
              activeItem={activeItem}
              setActiveItem={setActiveItem}
            />
          ))}
        </AccordionContent>
      )}
    </AccordionItem>
  );
};

const ActionButton = ({ icon, onClick, tooltip }) => (
  <Button
    variant="ghost"
    size="sm"
    className="h-5 w-5 p-0"
    onClick={(e) => {
      e.stopPropagation();
      onClick(e);
    }}
  >
    {icon}
  </Button>
);

export default TreeItem;
