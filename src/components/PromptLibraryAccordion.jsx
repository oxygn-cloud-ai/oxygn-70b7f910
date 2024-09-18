import React from 'react';
import { Accordion } from "@/components/ui/accordion";
import TreeItem from './TreeItem';

const PromptLibraryAccordion = ({ treeData, expandedItems, toggleItem, addItem, startRenaming, editingItem, setEditingItem, finishRenaming, cancelRenaming, activeItem, setActiveItem, deleteItem }) => {
  const renderTreeItems = (items, level = 1) => {
    return items.map((item) => (
      <TreeItem
        key={item.id}
        item={item}
        level={level}
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
    ));
  };

  return (
    <div className="pr-4 border-r h-full overflow-auto">
      <Accordion
        type="multiple"
        value={expandedItems}
        className="w-full min-w-max"
      >
        {treeData.length > 0 ? renderTreeItems(treeData) : <div className="text-gray-500 p-2">No prompts available</div>}
      </Accordion>
    </div>
  );
};

export default PromptLibraryAccordion;