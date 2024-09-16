import React from 'react';
import { DialogHeader } from "@/components/ui/dialog";
import { Accordion } from "@/components/ui/accordion";
import TreeItem from './TreeItem';

const TreeView = ({ treeData, expandedItems, setExpandedItems, selectedItem, setSelectedItem, parentData, selectedItemRef }) => {
  const toggleItem = (itemId) => {
    setExpandedItems(prev => 
      prev.includes(itemId) ? prev.filter(id => id !== itemId) : [...prev, itemId]
    );
  };

  const renderTreeItems = (items, level = 1) => {
    return items.map((item) => (
      <TreeItem
        key={item.id}
        item={item}
        level={level}
        expandedItems={expandedItems}
        toggleItem={toggleItem}
        activeItem={selectedItem?.id}
        setActiveItem={(id) => setSelectedItem(items.find(item => item.id === id))}
        selectedItem={parentData.row_id}
        ref={item.id === parentData.row_id ? selectedItemRef : null}
      />
    ));
  };

  return (
    <div className="w-1/3 border-r pr-4 overflow-y-auto">
      <DialogHeader>
        <div className="text-lg font-semibold">Select Prompt</div>
      </DialogHeader>
      <div className="border rounded-lg p-4 overflow-x-auto overflow-y-auto h-[calc(100vh-16rem)]">
        <Accordion
          type="multiple"
          value={expandedItems}
          onValueChange={setExpandedItems}
          className="w-full min-w-max"
        >
          {treeData.length > 0 ? renderTreeItems(treeData) : <div className="text-gray-500 p-2">No prompts available</div>}
        </Accordion>
      </div>
    </div>
  );
};

export default TreeView;
