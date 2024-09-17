import React from 'react';
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from "@/components/ui/accordion";
import TreeItem from './TreeItem';
import { Button } from "@/components/ui/button";
import { PlusCircle } from 'lucide-react';

const ProjectTree = ({
  treeData,
  expandedItems,
  setExpandedItems,
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
  const renderTreeItems = (items, level = 0) => {
    return items.map((item) => (
      <AccordionItem key={item.id} value={item.id}>
        <AccordionTrigger onClick={(e) => {
          e.stopPropagation();
          toggleItem(item.id);
        }}>
          <TreeItem
            item={item}
            level={level + 1}
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
