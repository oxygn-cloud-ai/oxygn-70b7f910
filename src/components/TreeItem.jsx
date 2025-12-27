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
  onRefreshTreeData,
  searchQuery,
  deletingItems,
  onExportPrompt
}) => {
  const [isHovered, setIsHovered] = useState(false);
  const [isTreeHovered, setIsTreeHovered] = useState(false);
  const isExpanded = expandedItems.includes(item.id);
  const hasChildren = item.children && item.children.length > 0;

  const [{ isDragging }, drag] = useDrag({
    type: 'TREE_ITEM',
    item: () => {
      document.body.style.cursor = 'grabbing';
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
      className={`
        border-none 
        ${level === 1 ? 'pt-1.5' : 'pt-0.5'} 
        pb-0.5 
        transition-all duration-150
        ${isDragging ? 'opacity-40 scale-[0.98]' : ''} 
        ${isOver ? 'bg-primary/10 rounded-md ring-1 ring-primary/30' : ''}
      `}
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
        searchQuery={searchQuery}
        isDeleting={deletingItems?.has(item.id)}
        onExportPrompt={onExportPrompt}
      />
      {isExpanded && hasChildren && (
        <div className="relative ml-2">
          {/* Vertical connection line */}
          <div 
            className={`
              absolute left-3 top-0 w-px bg-border 
              transition-opacity duration-200 
              ${isTreeHovered ? 'opacity-100' : 'opacity-40'}
            `}
            style={{ 
              height: 'calc(100% - 8px)',
              marginLeft: `${(level - 1) * 16}px`
            }}
          />
          {item.children.map((child, index) => (
            <div key={child.id} className="relative">
              {/* Horizontal connection line */}
              <div 
                className={`
                  absolute top-3 h-px bg-border 
                  transition-opacity duration-200 
                  ${isTreeHovered ? 'opacity-100' : 'opacity-40'}
                `}
                style={{ 
                  left: `${12 + (level - 1) * 16}px`,
                  width: '10px'
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
                searchQuery={searchQuery}
                deletingItems={deletingItems}
                onExportPrompt={onExportPrompt}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default TreeItem;
