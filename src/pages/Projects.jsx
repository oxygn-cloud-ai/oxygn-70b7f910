import React, { useState, useEffect, useCallback } from 'react';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import TreeItem from '../components/TreeItem';
import useTreeData from '../hooks/useTreeData';
import { PanelGroup, Panel, PanelResizeHandle } from 'react-resizable-panels';
import { PlusCircle } from 'lucide-react';
import { Button } from "@/components/ui/button";
import ProjectPanels from '../components/ProjectPanels';
import { toast } from 'sonner';
import { useSupabase } from '../hooks/useSupabase';
import { useOpenAIModels } from '../hooks/useOpenAIModels';
import { useNavigate } from 'react-router-dom';
import CascadePopup from '../components/CascadePopup';

const Projects = () => {
  const [expandedItems, setExpandedItems] = useState([]);
  const [activeItem, setActiveItem] = useState(null);
  const supabase = useSupabase();
  const { treeData, addItem, updateItemName, deleteItem, isLoading, refreshTreeData } = useTreeData(supabase);
  const [editingItem, setEditingItem] = useState(null);
  const [selectedItemData, setSelectedItemData] = useState(null);
  const { models } = useOpenAIModels();
  const navigate = useNavigate();
  const [showCascadePopup, setShowCascadePopup] = useState(false);
  const [cascadeInfo, setCascadeInfo] = useState({ itemName: '', fieldName: '' });

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

  const handleUpdateField = useCallback(async (fieldName, value) => {
    if (activeItem && supabase) {
      try {
        const { error } = await supabase
          .from('prompts')
          .update({ [fieldName]: value })
          .eq('row_id', activeItem);

        if (error) throw error;
        
        setSelectedItemData(prevData => ({
          ...prevData,
          [fieldName]: value
        }));

        if (fieldName === 'prompt_name') {
          await updateItemName(activeItem, value);
          await refreshTreeData();
        }
      } catch (error) {
        console.error('Error updating field:', error);
        toast.error(`Failed to update ${fieldName}: ${error.message}`);
      }
    }
  }, [activeItem, updateItemName, supabase, refreshTreeData]);

  const handleDeleteItem = useCallback(async (itemId) => {
    if (await deleteItem(itemId)) {
      setActiveItem(null);
      setSelectedItemData(null);
      await refreshTreeData();
    }
  }, [deleteItem, refreshTreeData]);

  const renderTreeItems = useCallback((items) => (
    items.map((item) => (
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
    ))
  ), [expandedItems, toggleItem, handleAddItem, updateItemName, editingItem, activeItem, refreshTreeData, handleDeleteItem]);

  useEffect(() => {
    if (activeItem && supabase) {
      const fetchItemData = async () => {
        try {
          const { data, error } = await supabase
            .from('prompts')
            .select('*')
            .eq('row_id', activeItem)
            .single();

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

  const handleCascade = useCallback((fieldName) => {
    setCascadeInfo({
      itemName: selectedItemData?.prompt_name || 'Unknown',
      fieldName: fieldName
    });
    setShowCascadePopup(true);
  }, [selectedItemData]);

  if (!supabase) {
    return <div>Loading Supabase client...</div>;
  }

  return (
    <div className="container mx-auto p-4">
      <PanelGroup direction="horizontal">
        <Panel defaultSize={30} minSize={20}>
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
        </Panel>
        <PanelResizeHandle className="w-2 bg-gray-200 hover:bg-gray-300 transition-colors" />
        <Panel>
          {activeItem ? (
            selectedItemData ? (
              <ProjectPanels 
                selectedItemData={selectedItemData} 
                projectRowId={activeItem} 
                onUpdateField={handleUpdateField}
                onCascade={handleCascade}
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
      <CascadePopup
        isOpen={showCascadePopup}
        onClose={() => setShowCascadePopup(false)}
        itemName={cascadeInfo.itemName}
        fieldName={cascadeInfo.fieldName}
      />
    </div>
  );
};

export default Projects;
