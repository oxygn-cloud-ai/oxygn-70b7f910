import React from 'react';
import { Rnd } from 'react-rnd';
import { X } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Accordion } from "@/components/ui/accordion";
import TreeItem from './TreeItem';

const PromptLibraryPopup = ({ isOpen, onClose, treeData, expandedItems, toggleItem, addItem, startRenaming, editingItem, setEditingItem, finishRenaming, cancelRenaming, activeItem, setActiveItem, deleteItem, parentId }) => {
  if (!isOpen) return null;

  const renderTreeItems = (items) => {
    return items.map((item) => (
      <TreeItem
        key={item.id}
        item={item}
        level={1}
        expandedItems={expandedItems}
        toggleItem={toggleItem}
        addItem={addItem}
        startRenaming={startRenaming}
        editingItem={editingItem}
        setEditingItem={setEditingItem}
        finishRenaming={finishRenaming}
        cancelRenaming={cancelRenaming}
        activeItem={parentId}  // Changed this line to use parentId instead of activeItem
        setActiveItem={setActiveItem}
        deleteItem={deleteItem}
      />
    ));
  };

  const renderAccordion = () => (
    <Accordion
      type="multiple"
      value={expandedItems}
      className="w-full min-w-max"
    >
      {treeData.length > 0 ? renderTreeItems(treeData) : <div className="text-gray-500 p-2">No prompts available</div>}
    </Accordion>
  );

  return (
    <Rnd
      default={{
        x: 50,
        y: 50,
        width: 600,
        height: 400,
      }}
      minWidth={300}
      minHeight={300}
      bounds="window"
    >
      <div className="bg-white border rounded-lg shadow-lg p-4 w-full h-full flex flex-col">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold">Prompt Library</h2>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>
        <div className="flex-grow overflow-auto">
          <div className="w-full h-full">
            {renderAccordion()}
          </div>
        </div>
      </div>
    </Rnd>
  );
};

export default PromptLibraryPopup;
