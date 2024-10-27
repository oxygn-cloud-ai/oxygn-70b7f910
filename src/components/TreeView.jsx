import React, { useCallback } from 'react';
import { Accordion } from "@/components/ui/accordion";
import TreeItem from './TreeItem';

const TreeView = ({ 
  treeData, 
  expandedItems, 
  toggleItem, 
  editingItem, 
  setEditingItem, 
  handleUpdateField, 
  refreshTreeData, 
  activeItem, 
  setActiveItem, 
  handleAddItem, 
  handleDeleteItem, 
  handleDuplicateItem, 
  handleMoveItem 
}) => {
  const renderTreeItems = useCallback((items) => (
    items.map((item) => (
      <TreeItem
        key={item.id}
        item={item}
        level={1}
        expandedItems={expandedItems}
        toggleItem={toggleItem}
        addItem={handleAddItem}
        startRenaming={(id, name) => setEditingItem({ id, name })}
        editingItem={editingItem}
        setEditingItem={setEditingItem}
        finishRenaming={async () => {
          if (editingItem) {
            // Only update the prompt_name field
            await handleUpdateField('prompt_name', editingItem.name);
            setEditingItem(null);
            await refreshTreeData();
          }
        }}
        cancelRenaming={() => setEditingItem(null)}
        activeItem={activeItem}
        setActiveItem={setActiveItem}
        deleteItem={handleDeleteItem}
        duplicateItem={handleDuplicateItem}
        moveItem={handleMoveItem}
        siblings={items}
        onRefreshTreeData={refreshTreeData}
      />
    ))
  ), [expandedItems, toggleItem, handleAddItem, editingItem, activeItem, refreshTreeData, handleDeleteItem, handleDuplicateItem, handleMoveItem, handleUpdateField, setEditingItem, setActiveItem]);

  return (
    <Accordion
      type="multiple"
      value={expandedItems}
      onValueChange={toggleItem}
      className="w-full min-w-max"
    >
      {treeData.length > 0 ? renderTreeItems(treeData) : <div className="text-gray-500 p-2">No prompts available</div>}
    </Accordion>
  );
};

export default TreeView;