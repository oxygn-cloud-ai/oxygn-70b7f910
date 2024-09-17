import React from 'react';
import { Accordion } from "@/components/ui/accordion";
import TreeItem from './TreeItem';
import { Button } from "@/components/ui/button";
import { PlusCircle } from 'lucide-react';

const ProjectTree = ({
  treeData,
  expandedItems,
  toggleItem,
  handleAddItem,
  updateItemName,
  editingItem,
  setEditingItem,
  activeItem,
  setActiveItem,
  handleDeleteItem,
  isLoading,
  refreshTreeData
}) => {
  const renderTreeItems = (items) => {
    return items.map((item) => (
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
            await updateItemName(editingItem.id, editingItem.name);
            setEditingItem(null);
            await refreshTreeData();
          }
        }}
        cancelRenaming={() => setEditingItem(null)}
        activeItem={activeItem}
        setActiveItem={setActiveItem}
        deleteItem={handleDeleteItem}
      />
    ));
  };

  return (
    <div className="border rounded-lg p-4 overflow-x-auto overflow-y-auto h-[calc(100vh-8rem)]">
      <div className="overflow-x-auto whitespace-nowrap w-full">
        <div className="mb-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => handleAddItem(null)}
          >
            <PlusCircle className="h-5 w-5" />
          </Button>
        </div>
        {isLoading ? (
          <div>Loading...</div>
        ) : (
          <Accordion
            type="multiple"
            value={expandedItems}
            onValueChange={setExpandedItems}
            className="w-full min-w-max"
          >
            {treeData.length > 0 ? renderTreeItems(treeData) : <div className="text-gray-500 p-2">No prompts available</div>}
          </Accordion>
        )}
      </div>
    </div>
  );
};

export default ProjectTree;