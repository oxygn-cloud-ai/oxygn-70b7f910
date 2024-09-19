import React, { useState, useEffect, useCallback } from 'react';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import LinksTreeItem from '../components/LinksTreeItem';
import useTreeData from '../hooks/useTreeData';
import { PanelGroup, Panel, PanelResizeHandle } from 'react-resizable-panels';
import ProjectPanels from '../components/ProjectPanels';
import { toast } from 'sonner';
import { useSupabase } from '../hooks/useSupabase';
import { useOpenAIModels } from '../hooks/useOpenAIModels';
import { useCascadeUpdate } from '../hooks/useCascadeUpdate';

const Links = ({ isPopup = false, parentData = null, cascadeField = null, onUpdateParentData }) => {
  const [expandedItems, setExpandedItems] = useState([]);
  const [activeItem, setActiveItem] = useState(null);
  const supabase = useSupabase();
  const { treeData, isLoading, refreshTreeData } = useTreeData(supabase);
  const [selectedItemData, setSelectedItemData] = useState(null);
  const { models } = useOpenAIModels();

  const refreshSelectedItemData = useCallback(async (rowId) => {
    if (supabase) {
      try {
        const { data, error } = await supabase
          .from('prompts')
          .select('*')
          .eq('row_id', rowId)
          .single();

        if (error) throw error;
        
        setSelectedItemData(data);
        if (onUpdateParentData) {
          onUpdateParentData(data);
        }
      } catch (error) {
        console.error('Error refreshing item data:', error);
        toast.error(`Failed to refresh prompt data: ${error.message}`);
      }
    }
  }, [supabase, onUpdateParentData]);

  const { handleCascade } = useCascadeUpdate(isPopup, parentData, cascadeField, refreshSelectedItemData);

  const toggleItem = useCallback((itemId) => {
    setExpandedItems(prev => 
      prev.includes(itemId) ? prev.filter(id => id !== itemId) : [...prev, itemId]
    );
    setActiveItem(itemId);
  }, []);

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
          await refreshTreeData();
        }
      } catch (error) {
        console.error('Error updating field:', error);
        toast.error(`Failed to update ${fieldName}: ${error.message}`);
      }
    }
  }, [activeItem, supabase, refreshTreeData]);

  const renderTreeItems = useCallback((items) => (
    items.map((item) => (
      <LinksTreeItem
        key={item.id}
        item={item}
        level={1}
        expandedItems={expandedItems}
        toggleItem={toggleItem}
        activeItem={activeItem}
        setActiveItem={setActiveItem}
      />
    ))
  ), [expandedItems, toggleItem, activeItem]);

  useEffect(() => {
    if (activeItem && supabase) {
      refreshSelectedItemData(activeItem);
    } else {
      setSelectedItemData(null);
    }
  }, [activeItem, supabase, refreshSelectedItemData]);

  if (!supabase) {
    return <div>Loading Supabase client...</div>;
  }

  return (
    <div className={`container mx-auto ${isPopup ? 'p-0' : 'p-4'}`}>
      {isPopup && parentData && cascadeField && (
        <div className="mb-4 p-4 bg-blue-100 rounded-lg">
          <h2 className="text-lg font-semibold">Cascade Information</h2>
          <p><strong>Selected Item:</strong> {parentData.prompt_name}</p>
          <p><strong>Field:</strong> {cascadeField}</p>
        </div>
      )}
      <PanelGroup direction="horizontal">
        <Panel defaultSize={30} minSize={20}>
          <div className="border rounded-lg p-4 overflow-x-auto overflow-y-auto h-[calc(100vh-8rem)]">
            <div className="overflow-x-auto whitespace-nowrap w-full">
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
                isLinksPage={true}
                isReadOnly={true}
                onCascade={(fieldName) => handleCascade(fieldName, selectedItemData)}
                parentData={parentData}
                cascadeField={cascadeField}
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
    </div>
  );
};

export default Links;
