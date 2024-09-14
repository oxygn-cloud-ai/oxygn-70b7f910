import React from 'react';
import {
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { FolderIcon, FileIcon, ChevronRightIcon, ChevronDownIcon, PlusIcon, TrashIcon, EditIcon } from 'lucide-react';
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
  finishRenaming
}) => {
  const renderIcon = () => (
    item.type === 'folder' ? <FolderIcon className="h-4 w-4" /> : <FileIcon className="h-4 w-4" />
  );

  const renderActionButtons = () => (
    <div className="flex items-center space-x-1 ml-2">
      <ActionButton icon={<PlusIcon className="h-3 w-3" />} onClick={() => addItem(item.id, 'file')} tooltip="Add File" />
      {item.type === 'folder' && (
        <ActionButton icon={<FolderIcon className="h-3 w-3" />} onClick={() => addItem(item.id, 'folder')} tooltip="Add Folder" />
      )}
      <ActionButton icon={<EditIcon className="h-3 w-3" />} onClick={() => startRenaming(item.id)} tooltip="Rename" />
      <ActionButton icon={<TrashIcon className="h-3 w-3" />} onClick={() => deleteItem(item.id)} tooltip="Delete" />
      <ActionButton
        icon={expandedItems.includes(item.id) ? <ChevronDownIcon className="h-3 w-3" /> : <ChevronRightIcon className="h-3 w-3" />}
        onClick={(e) => {
          e.stopPropagation();
          toggleItem(item.id);
        }}
        tooltip={expandedItems.includes(item.id) ? 'Collapse' : 'Expand'}
      />
    </div>
  );

  const displayName = `${item.name} {${level}}`;

  return (
    <AccordionItem value={item.id} className="border-none">
      <AccordionTrigger
        onClick={() => toggleItem(item.id)}
        className={`hover:no-underline py-1 flex items-center justify-between`}
        style={{ paddingLeft: `${level * 16}px` }}
      >
        <div className="flex items-center space-x-1">
          <Tooltip>
            <TooltipTrigger asChild>
              {renderIcon()}
            </TooltipTrigger>
            <TooltipContent>
              {item.type === 'folder' ? 'Folder' : 'File'}
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
            <span className="ml-1 text-blue-600 hover:text-blue-800 hover:underline cursor-pointer">{displayName}</span>
          )}
          {renderActionButtons()}
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
