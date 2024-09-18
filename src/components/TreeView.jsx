import React from 'react';
import { DialogHeader } from "@/components/ui/dialog";
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from "@/components/ui/accordion";
import TreeItem from './TreeItem';

const TreeView = ({ treeData, expandedItems, setExpandedItems, selectedItem, setSelectedItem, parentData, selectedItemRef }) => {
  const toggleItem = (itemId) => {
    setExpandedItems((prev) => 
      prev.includes(itemId) ? prev.filter(id => id !== itemId) : [...prev, itemId]
    );
  };

  const handleItemSelect = (item) => {
    setSelectedItem(item);
  };

  const renderTreeItems = (items, level = 1) => {
    return items.map((item) => (
      <AccordionItem key={item.id} value={item.id}>
        <AccordionTrigger onClick={() => toggleItem(item.id)}>
          <TreeItem
            item={item}
            level={level}
            expandedItems={expandedItems}
            toggleItem={() => {}}
            activeItem={selectedItem?.id}
            setActiveItem={() => handleItemSelect(item)}
            selectedItem={parentData?.row_id}
            ref={item.id === parentData?.row_id ? selectedItemRef : null}
          />
        </AccordionTrigger>
        {item.children && item.children.length > 0 && (
          <AccordionContent>
            <Accordion
              type="multiple"
              value={expandedItems}
              onValueChange={setExpandedItems}
            >
              {renderTreeItems(item.children, level + 1)}
            </Accordion>
          </AccordionContent>
        )}
      </AccordionItem>
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
