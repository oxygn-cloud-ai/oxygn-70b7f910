import React from 'react';
import { Accordion } from "@/components/ui/accordion";
import TreeItem from './TreeItem';

const TreeView = ({
  treeData,
  expandedItems,
  setExpandedItems,
  activeItem,
  setActiveItem,
  editingItem,
  setEditingItem,
  handleAddItem,
  updateItemName,
  deleteItem,
  isLoading,
  refreshTreeData
}) => {
  const toggleItem = (itemId) => {
    setExpandedItems(prev => 
      prev.includes(itemId) ? prev.filter(id => id !== itemId) : [...prev, itemId]
    );
    setActiveItem(itemId);
  };

  const renderTreeItems = (items, level = 1) => (
    items.map((item) => (
      <TreeItem
        key={item.id}
        item={item}
        level={level}
        expandedItems={expandedItems}
        toggleItem={toggleItem}
        addItem={handleAddItem}
        startRenaming={(id, name) => setEditingItem({ id, name })}
        editingItem={editingItem}
        setEditingItem={setEditingItem}
        finishRenaming={async () => {
          if (editingItem) {
            await updateItemName(editingItem.id, editingItem.name);
            setEditingItem(null);
            await refreshTreeData();
          }
        }}
        cancelRenaming={() => setEditingItem(null)}
        activeItem={activeItem}
        setActiveItem={setActiveItem}
        deleteItem={deleteItem}
      />
    ))
  );

  return (
    <>
      {isLoading ? <div>Loading...</div> : (
        <Accordion
          type="multiple"
          value={expandedItems}
          onValueChange={setExpandedItems}
          className="w-full min-w-max"
        >
          {treeData.length > 0 ? renderTreeItems(treeData) : <div className="text-gray-500 p-2">No prompts available</div>}
        </Accordion>
      )}
    </>
  );
};

export default TreeView;
