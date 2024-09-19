import React, { useState } from 'react';
import { Accordion } from "@/components/ui/accordion";
import TreeItem from './TreeItem';
import { PlusCircle } from 'lucide-react';
import { Button } from "@/components/ui/button";

const TreeView = ({ 
  treeData, 
  activeItem, 
  onItemSelect, 
  onAddItem, 
  onUpdateItemName, 
  onDeleteItem, 
  isLoading, 
  refreshTreeData 
}) => {
  const [expandedItems, setExpandedItems] = useState([]);
  const [editingItem, setEditingItem] = useState(null);

  const handleAddItem = async (parentId) => {
    const newItemId = await onAddItem(parentId);
    if (newItemId) {
      onItemSelect(newItemId);
      setExpandedItems(prev => [...prev, parentId].filter(Boolean));
      refreshTreeData();
    }
  };

  const renderTreeItems = (items) => (
    items.map((item) => (
      <TreeItem
        key={item.id}
        item={item}
        level={1}
        expandedItems={expandedItems}
        toggleItem={(itemId) => {
          setExpandedItems(prev => 
            prev.includes(itemId) ? prev.filter(id => id !== itemId) : [...prev, itemId]
          );
          onItemSelect(itemId);
        }}
        addItem={handleAddItem}
        startRenaming={(id, name) => setEditingItem({ id, name })}
        editingItem={editingItem}
        setEditingItem={setEditingItem}
        finishRenaming={async () => {
          if (editingItem) {
            await onUpdateItemName(editingItem.id, editingItem.name);
            setEditingItem(null);
            await refreshTreeData();
          }
        }}
        cancelRenaming={() => setEditingItem(null)}
        activeItem={activeItem}
        setActiveItem={onItemSelect}
        deleteItem={onDeleteItem}
      />
    ))
  );

  return (
    <div className="border rounded-lg p-4 overflow-x-auto overflow-y-auto h-[calc(100vh-8rem)]">
      <div className="overflow-x-auto whitespace-nowrap w-full">
        <div className="mb-2 flex space-x-2">
          <Button variant="ghost" size="icon" onClick={() => handleAddItem(null)}>
            <PlusCircle className="h-5 w-5" />
          </Button>
        </div>
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
      </div>
    </div>
  );
};

export default TreeView;
