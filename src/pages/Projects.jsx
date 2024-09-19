import React, { useState, useEffect, useCallback } from 'react';
import { Accordion } from "@/components/ui/accordion";
import { PanelGroup, Panel, PanelResizeHandle } from 'react-resizable-panels';
import { PlusCircle } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { toast } from 'sonner';
import { useSupabase } from '../hooks/useSupabase';
import { useSettings } from '../hooks/useSettings';
import { useOpenAIModels } from '../hooks/useOpenAIModels';
import useTreeData from '../hooks/useTreeData';
import TreeView from '../components/TreeView';
import ProjectDetails from '../components/ProjectDetails';
import SettingsAccordion from '../components/SettingsAccordion';

const Projects = () => {
  const [expandedItems, setExpandedItems] = useState([]);
  const [activeItem, setActiveItem] = useState(null);
  const supabase = useSupabase();
  const { treeData, addItem, updateItemName, deleteItem, isLoading, refreshTreeData } = useTreeData(supabase);
  const [editingItem, setEditingItem] = useState(null);
  const [selectedItemData, setSelectedItemData] = useState(null);
  const { settings, updateSetting } = useSettings(supabase);
  const { models } = useOpenAIModels();
  const [localSettings, setLocalSettings] = useState({});
  const [expandedSettings, setExpandedSettings] = useState(['settings']);

  useEffect(() => {
    if (settings) {
      setLocalSettings(settings);
    }
  }, [settings]);

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
              <TreeView
                treeData={treeData}
                expandedItems={expandedItems}
                setExpandedItems={setExpandedItems}
                activeItem={activeItem}
                setActiveItem={setActiveItem}
                editingItem={editingItem}
                setEditingItem={setEditingItem}
                handleAddItem={handleAddItem}
                updateItemName={updateItemName}
                deleteItem={deleteItem}
                isLoading={isLoading}
                refreshTreeData={refreshTreeData}
              />
            </div>
          </div>
        </Panel>
        <PanelResizeHandle className="w-2 bg-gray-200 hover:bg-gray-300 transition-colors" />
        <Panel>
          <ProjectDetails
            activeItem={activeItem}
            selectedItemData={selectedItemData}
            handleUpdateField={handleUpdateField}
          />
        </Panel>
      </PanelGroup>
      <SettingsAccordion
        expandedSettings={expandedSettings}
        setExpandedSettings={setExpandedSettings}
        localSettings={localSettings}
        handleSettingChange={(key, value) => setLocalSettings(prev => ({ ...prev, [key]: value }))}
        handleSettingSave={updateSetting}
        handleSettingReset={(key) => setLocalSettings(prev => ({ ...prev, [key]: settings[key] }))}
      />
    </div>
  );
};

export default Projects;
