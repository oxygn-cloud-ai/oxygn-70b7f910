import React, { useRef, useState } from 'react';
import { useDrag, useDrop } from 'react-dnd';
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
  siblings,
  onRefreshTreeData
}) => {
  const [isHovered, setIsHovered] = useState(false);
  const [isTreeHovered, setIsTreeHovered] = useState(false);
  const isExpanded = expandedItems.includes(item.id);
  const hasChildren = item.children && item.children.length > 0;

  const [{ isDragging }, drag] = useDrag({
    type: 'TREE_ITEM',
    item: () => {
      document.body.style.cursor = 'wait';
      return { 
        id: item.id, 
        parentId: item.parent_row_id 
      };
    },
    end: () => {
      document.body.style.cursor = 'default';
    },
    collect: (monitor) => ({
      isDragging: monitor.isDragging(),
    }),
  });

  const [{ isOver }, drop] = useDrop({
    accept: 'TREE_ITEM',
    drop: async (draggedItem, monitor) => {
      if (!monitor.didDrop() && draggedItem.id !== item.id && draggedItem.parentId !== item.id) {
        document.body.style.cursor = 'wait';
        await moveItem(draggedItem.id, item.id);
        document.body.style.cursor = 'default';
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
      onMouseEnter={() => setIsTreeHovered(true)}
      onMouseLeave={() => setIsTreeHovered(false)}
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
        addItem={addItem}
        deleteItem={deleteItem}
        duplicateItem={duplicateItem}
        siblings={siblings}
        onRefreshTreeData={onRefreshTreeData}
      />
      {isExpanded && hasChildren && (
        <div className="relative">
          {/* Vertical line from parent */}
          <div 
            className={`absolute left-3 top-0 w-px bg-gray-300 transition-opacity duration-200 ${isTreeHovered ? 'opacity-100' : 'opacity-0'}`}
            style={{ 
              height: 'calc(100% - 12px)',
              marginLeft: `${(level - 1) * 16}px`
            }}
          />
          {item.children.map((child, index) => (
            <div key={child.id} className="relative">
              {/* Horizontal line to child */}
              <div 
                className={`absolute top-3 h-px bg-gray-300 transition-opacity duration-200 ${isTreeHovered ? 'opacity-100' : 'opacity-0'}`}
                style={{ 
                  left: `${12 + (level - 1) * 16}px`,
                  width: '12px'
                }}
              />
              <TreeItem
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
                siblings={item.children}
                onRefreshTreeData={onRefreshTreeData}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default TreeItem;