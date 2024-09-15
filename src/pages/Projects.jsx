import React, { useState, useEffect, useCallback } from 'react';
import { Accordion } from "@/components/ui/accordion";
import { TooltipProvider } from "@/components/ui/tooltip";
import TreeItem from '../components/TreeItem';
import useTreeData from '../hooks/useTreeData';
import { PanelGroup, Panel, PanelResizeHandle } from 'react-resizable-panels';
import { PlusCircle } from 'lucide-react';
import { Button } from "@/components/ui/button";
import DeleteConfirmationDialog from '../components/DeleteConfirmationDialog';
import ProjectPanels from '../components/ProjectPanels';
import { toast } from 'sonner';
import { useSupabase } from '../hooks/useSupabase';

const Projects = () => {
  const [expandedItems, setExpandedItems] = useState([]);
  const [activeItem, setActiveItem] = useState(null);
  const supabase = useSupabase();
  const { treeData, addItem, deleteItem, updateItemName, isLoading, refreshTreeData } = useTreeData(supabase);
  const [editingItem, setEditingItem] = useState(null);
  const [deleteConfirmation, setDeleteConfirmation] = useState({ isOpen: false, itemId: null, confirmCount: 0 });
  const [selectedItemData, setSelectedItemData] = useState(null);

  const toggleItem = useCallback((itemId) => {
    setExpandedItems(prev => 
      prev.includes(itemId) ? prev.filter(id => id !== itemId) : [...prev, itemId]
    );
    setActiveItem(itemId);
  }, []);

  const handleAddItem = useCallback(async (parentId) => {
    const newItemId = await addItem(parentId);
    if (newItemId) {
      setActiveItem(newItemId);
      setExpandedItems(prev => [...prev, parentId].filter(Boolean));
      refreshTreeData();
    }
  }, [addItem, refreshTreeData]);

  const handleDeleteItem = useCallback((id) => {
    setDeleteConfirmation({ isOpen: true, itemId: id, confirmCount: 0 });
  }, []);

  const handleDeleteConfirm = useCallback(async () => {
    if (deleteConfirmation.confirmCount === 0) {
      setDeleteConfirmation(prev => ({ ...prev, confirmCount: 1 }));
    } else {
      const success = await deleteItem(deleteConfirmation.itemId);
      if (success) {
        setDeleteConfirmation({ isOpen: false, itemId: null, confirmCount: 0 });
        if (activeItem === deleteConfirmation.itemId) {
          setActiveItem(null);
          setSelectedItemData(null);
        }
        refreshTreeData();
      }
    }
  }, [deleteConfirmation, deleteItem, activeItem, refreshTreeData]);

  const handleUpdateField = useCallback(async (fieldName, value) => {
    if (activeItem && supabase) {
      try {
        const query = supabase
          .from('prompts')
          .update({ [fieldName]: value })
          .eq('row_id', activeItem);

        console.log('Supabase API Call:', {
          url: query.url.toString(),
          method: 'PATCH',
          headers: query.headers,
          body: JSON.stringify({ [fieldName]: value }),
        });

        const { error } = await query;

        console.log('Supabase API Response:', {
          status: error ? 500 : 200,
          data: null,
          error: error ? JSON.stringify(error) : null,
        });

        if (error) throw error;
        
        setSelectedItemData(prevData => ({
          ...prevData,
          [fieldName]: value
        }));

        if (fieldName === 'prompt_name') {
          updateItemName(activeItem, value);
        }
      } catch (error) {
        console.error('Error updating field:', error);
        toast.error(`Failed to update ${fieldName}: ${error.message}`);
      }
    }
  }, [activeItem, updateItemName, supabase]);

  const renderTreeItems = useCallback((items) => {
    return items.map((item) => (
      <TreeItem
        key={item.id}
        item={item}
        level={1}
        expandedItems={expandedItems}
        toggleItem={toggleItem}
        addItem={handleAddItem}
        deleteItem={handleDeleteItem}
        startRenaming={(id) => setEditingItem({ id, name: item.name })}
        editingItem={editingItem}
        setEditingItem={setEditingItem}
        finishRenaming={() => {
          if (editingItem) {
            updateItemName(editingItem.id, editingItem.name);
            setEditingItem(null);
          }
        }}
        activeItem={activeItem}
        setActiveItem={setActiveItem}
        projectId={item.id}
      />
    ));
  }, [expandedItems, toggleItem, handleAddItem, handleDeleteItem, updateItemName, editingItem, activeItem]);

  useEffect(() => {
    const intervalId = setInterval(refreshTreeData, 60000);
    return () => clearInterval(intervalId);
  }, [refreshTreeData]);

  useEffect(() => {
    if (activeItem && supabase) {
      const fetchItemData = async () => {
        try {
          const query = supabase
            .from('prompts')
            .select('*')
            .eq('row_id', activeItem)
            .single();

          console.log('Supabase API Call:', {
            url: query.url.toString(),
            method: 'GET',
            headers: query.headers,
            body: null,
          });

          const { data, error } = await query;

          console.log('Supabase API Response:', {
            status: data ? 200 : 500,
            data: JSON.stringify(data),
            error: error ? JSON.stringify(error) : null,
          });

          if (error) throw error;
          
          setSelectedItemData(data);
        } catch (error) {
          console.error('Error fetching item data:', error);
          toast.error(`Failed to fetch prompt data: ${error.message}`);
        }
      };

      fetchItemData();
    } else {
      setSelectedItemData(null);
    }
  }, [activeItem, supabase]);

  const renderAccordion = () => (
    <Accordion
      type="multiple"
      value={expandedItems}
      onValueChange={setExpandedItems}
      className="w-full min-w-max"
    >
      {treeData.length > 0 ? renderTreeItems(treeData) : <div className="text-gray-500 p-2">No prompts available</div>}
    </Accordion>
  );

  if (!supabase) {
    return <div>Loading Supabase client...</div>;
  }

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">Prompts</h1>
      <PanelGroup direction="horizontal">
        <Panel defaultSize={30} minSize={20}>
          <div className="border rounded-lg p-4 overflow-x-auto overflow-y-auto h-[calc(100vh-8rem)]">
            <TooltipProvider>
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
                {isLoading ? <div>Loading...</div> : renderAccordion()}
              </div>
            </TooltipProvider>
          </div>
        </Panel>
        <PanelResizeHandle className="w-2 bg-gray-200 hover:bg-gray-300 transition-colors" />
        <Panel>
          {activeItem ? (
            selectedItemData ? (
              <ProjectPanels 
                selectedItemData={selectedItemData} 
                projectRowId={activeItem} 
                onUpdateField={handleUpdateField}
              />
            ) : (
              <div className="flex items-center justify-center h-full">
                <p className="text-gray-500">Loading prompt details...</p>
              </div>
            )
          ) : (
            <div className="flex items-center justify-center h-full">
              <p className="text-gray-500">Select a prompt to view details</p>
            </div>
          )}
        </Panel>
      </PanelGroup>
      <DeleteConfirmationDialog
        isOpen={deleteConfirmation.isOpen}
        onOpenChange={(isOpen) => setDeleteConfirmation(prev => ({ ...prev, isOpen }))}
        confirmCount={deleteConfirmation.confirmCount}
        onConfirm={handleDeleteConfirm}
      />
    </div>
  );
};

export default Projects;
