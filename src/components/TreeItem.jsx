import React from 'react';
import {
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { FileIcon, PlusIcon, TrashIcon, EditIcon } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

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
  activeItem,
  setActiveItem
}) => {
  const renderActionButtons = () => (
    <div className="flex items-center space-x-1 ml-2">
      <ActionButton icon={<PlusIcon className="h-3 w-3" />} onClick={() => addItem(item.id)} tooltip="Add File" />
      <ActionButton icon={<EditIcon className="h-3 w-3" />} onClick={() => startRenaming(item.id)} tooltip="Rename" />
      <ActionButton icon={<TrashIcon className="h-3 w-3" />} onClick={() => deleteItem(item.id)} tooltip="Delete" />
    </div>
  );

  const displayName = item.name && item.name.trim() !== '' ? `${item.name} {${level}}` : `Untitled {${level}}`;
  const isActive = activeItem === item.id;

  return (
    <AccordionItem value={item.id} className="border-none">
      <AccordionTrigger
        onClick={() => {
          toggleItem(item.id);
          setActiveItem(item.id);
        }}
        className={`hover:no-underline py-1 flex items-center justify-between ${isActive ? 'text-blue-600' : 'text-gray-400'}`}
        style={{ paddingLeft: `${level * 16}px` }}
      >
        <div className="flex items-center space-x-1">
          <Tooltip>
            <TooltipTrigger asChild>
              <FileIcon className="h-4 w-4" />
            </TooltipTrigger>
            <TooltipContent>
              File
            </TooltipContent>
          </Tooltip>
          {editingItem && editingItem.id === item.id ? (
            <Input
              value={editingItem.name}
              onChange={(e) => setEditingItem({ ...editingItem, name: e.target.value })}
              onBlur={finishRenaming}
              onKeyPress={(e) => e.key === 'Enter' && finishRenaming()}
              onClick={(e) => e.stopPropagation()}
              className="h-6 py-0 px-1"
            />
          ) : (
            <span className={`ml-1 ${isActive ? 'hover:text-blue-800 hover:underline cursor-pointer' : 'cursor-default'}`}>{displayName}</span>
          )}
          {isActive && renderActionButtons()}
        </div>
      </AccordionTrigger>
      {item.children && (
        <AccordionContent>
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
  <Tooltip>
    <TooltipTrigger asChild>
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
    </TooltipTrigger>
    <TooltipContent>{tooltip}</TooltipContent>
  </Tooltip>
);

export default TreeItem;
