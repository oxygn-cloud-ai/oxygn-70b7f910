import React, { useRef, useEffect, useState } from 'react';
import { FileIcon, PlusIcon, EditIcon, Trash2Icon, ChevronRight, ChevronDown, Copy } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useDrag, useDrop } from 'react-dnd';
import { TreeItemActions } from './TreeItemActions';
import { TreeItemContent } from './TreeItemContent';

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
  duplicateItem,
  moveItem,
}) => {
  const [isHovered, setIsHovered] = useState(false);
  const isExpanded = expandedItems.includes(item.id);

  const [{ isDragging }, drag] = useDrag({
    type: 'TREE_ITEM',
    item: { id: item.id, parentId: item.parent_row_id },
    collect: (monitor) => ({
      isDragging: monitor.isDragging(),
    }),
  });

  const [{ isOver }, drop] = useDrop({
    accept: 'TREE_ITEM',
    drop: (draggedItem, monitor) => {
      if (!monitor.didDrop() && draggedItem.id !== item.id && draggedItem.parentId !== item.id) {
        moveItem(draggedItem.id, item.id);
      }
    },
    collect: (monitor) => ({
      isOver: monitor.isOver({ shallow: true }),
    }),
  });

  const ref = useRef(null);
  drag(drop(ref));

  return (
    <div 
      className={`border-none ${level === 1 ? 'pt-3' : 'pt-0'} pb-0.1 ${isDragging ? 'opacity-50' : ''} ${isOver ? 'bg-blue-100' : ''}`}
      ref={ref}
    >
      <TreeItemContent
        item={item}
        level={level}
        isExpanded={isExpanded}
        isActive={activeItem === item.id}
        toggleItem={toggleItem}
        setActiveItem={setActiveItem}
        editingItem={editingItem}
        setEditingItem={setEditingItem}
        finishRenaming={finishRenaming}
        cancelRenaming={cancelRenaming}
        startRenaming={startRenaming}
        isHovered={isHovered}
        setIsHovered={setIsHovered}
      />
      {isHovered && (
        <TreeItemActions
          item={item}
          addItem={addItem}
          deleteItem={deleteItem}
          duplicateItem={duplicateItem}
          startRenaming={startRenaming}
        />
      )}
      {isExpanded && item.children && item.children.length > 0 && (
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
              duplicateItem={duplicateItem}
              moveItem={moveItem}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default TreeItem;