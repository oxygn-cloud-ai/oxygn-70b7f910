import React, { useState, useRef, useEffect } from 'react';
import { Accordion } from "@/components/ui/accordion";
import { TooltipProvider } from "@/components/ui/tooltip";
import TreeItem from '../components/TreeItem';
import { Textarea } from "@/components/ui/textarea";
import { useTreeData } from '../hooks/useTreeData';
import { PanelGroup, Panel, PanelResizeHandle } from 'react-resizable-panels';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

const Projects = () => {
  const [expandedItems, setExpandedItems] = useState([]);
  const { treeData, addItem, deleteItem, updateTreeData } = useTreeData();
  const [editingItem, setEditingItem] = useState(null);
  const accordionRef = useRef(null);
  const [deleteConfirmation, setDeleteConfirmation] = useState({ isOpen: false, itemId: null, confirmCount: 0 });

  const toggleItem = (itemId) => {
    setExpandedItems((prevExpanded) =>
      prevExpanded.includes(itemId)
        ? prevExpanded.filter((id) => id !== itemId)
        : [...prevExpanded, itemId]
    );
  };

  const startRenaming = (id) => {
    const item = findItemById(treeData, id);
    if (item) {
      setEditingItem({ id, name: item.name });
    }
  };

  const finishRenaming = () => {
    if (editingItem) {
      updateTreeData(editingItem.id, (item) => ({
        ...item,
        name: editingItem.name
      }));
      setEditingItem(null);
    }
  };

  const findItemById = (items, id) => {
    if (!items) return null;
    for (let item of items) {
      if (item.id === id) return item;
      if (item.children) {
        const found = findItemById(item.children, id);
        if (found) return found;
      }
    }
    return null;
  };

  const handleAddItem = async (parentId, type) => {
    const newItemId = await addItem(parentId, type);
    if (newItemId) {
      if (parentId) {
        setExpandedItems((prevExpanded) => {
          if (!prevExpanded.includes(parentId)) {
            return [...prevExpanded, parentId];
          }
          return prevExpanded;
        });
      }
      return newItemId;
    }
  };

  const handleDeleteItem = (id) => {
    const isLevel0 = treeData.some(item => item.id === id);
    if (isLevel0) {
      setDeleteConfirmation({ isOpen: true, itemId: id, confirmCount: 0 });
    } else {
      deleteItem(id);
    }
  };

  const handleDeleteConfirm = async () => {
    if (deleteConfirmation.confirmCount === 0) {
      setDeleteConfirmation(prev => ({ ...prev, confirmCount: 1 }));
    } else {
      const success = await deleteItem(deleteConfirmation.itemId);
      if (success) {
        setDeleteConfirmation({ isOpen: false, itemId: null, confirmCount: 0 });
      } else {
        // Handle error (e.g., show an error message)
        console.error("Failed to delete item");
      }
    }
  };

  useEffect(() => {
    const handleScroll = () => {
      if (accordionRef.current) {
        const accordionBox = accordionRef.current;
        const activeElement = document.activeElement;
        
        if (activeElement && accordionBox.contains(activeElement)) {
          const rect = activeElement.getBoundingClientRect();
          const containerRect = accordionBox.getBoundingClientRect();
          
          if (rect.right > containerRect.right) {
            accordionBox.scrollLeft += rect.right - containerRect.right + 20; // 20px buffer
          } else if (rect.left < containerRect.left) {
            accordionBox.scrollLeft -= containerRect.left - rect.left + 20; // 20px buffer
          }
        }
      }
    };

    document.addEventListener('keydown', handleScroll);
    return () => {
      document.removeEventListener('keydown', handleScroll);
    };
  }, []);

  const renderTreeItems = () => {
    if (!treeData || treeData.length === 0) {
      return <div>No items to display</div>;
    }
    return (
      <TooltipProvider>
        <div ref={accordionRef} className="overflow-x-scroll whitespace-nowrap" style={{ width: '100%' }}>
          <Accordion
            type="multiple"
            value={expandedItems}
            onValueChange={setExpandedItems}
            className="w-full min-w-max"
          >
            {treeData.map((item) => (
              <TreeItem
                key={item.id}
                item={item}
                level={0}
                expandedItems={expandedItems}
                toggleItem={toggleItem}
                addItem={handleAddItem}
                deleteItem={handleDeleteItem}
                startRenaming={startRenaming}
                editingItem={editingItem}
                setEditingItem={setEditingItem}
                finishRenaming={finishRenaming}
              />
            ))}
          </Accordion>
        </div>
      </TooltipProvider>
    );
  };

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">Projects</h1>
      <PanelGroup direction="horizontal">
        <Panel defaultSize={20} minSize={15}>
          <div className="border rounded-lg p-4 overflow-x-scroll overflow-y-auto h-[calc(100vh-8rem)]">
            {renderTreeItems()}
          </div>
        </Panel>
        <PanelResizeHandle className="w-2 bg-gray-200 hover:bg-gray-300 transition-colors" />
        <Panel>
          <div className="flex flex-col gap-4 h-[calc(100vh-8rem)] overflow-auto">
            <Textarea placeholder="Admin Prompt" className="w-full p-2 border rounded" />
            <Textarea placeholder="User Prompt" className="w-full p-2 border rounded" />
            <div className="grid grid-cols-2 gap-4">
              <Textarea placeholder="Input Admin Prompt" className="w-full p-2 border rounded" />
              <Textarea placeholder="Input User Prompt" className="w-full p-2 border rounded" />
              <Textarea placeholder="Prompt Settings" className="w-full p-2 border rounded" />
              <Textarea placeholder="Half Width Box 4" className="w-full p-2 border rounded" />
            </div>
          </div>
        </Panel>
      </PanelGroup>
      <AlertDialog open={deleteConfirmation.isOpen} onOpenChange={(isOpen) => setDeleteConfirmation(prev => ({ ...prev, isOpen }))}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteConfirmation.confirmCount === 0
                ? "This action will delete the project and all its contents. This action cannot be undone."
                : "Please confirm once more that you want to delete this project and all its contents."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteConfirm}>
              {deleteConfirmation.confirmCount === 0 ? "Confirm" : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default Projects;
