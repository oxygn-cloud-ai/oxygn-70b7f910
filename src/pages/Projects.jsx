import React, { useState, useEffect, useCallback } from 'react';
import { PanelGroup, Panel, PanelResizeHandle } from 'react-resizable-panels';
import { toast } from 'sonner';
import { useSupabase } from '../hooks/useSupabase';
import { useOpenAIModels } from '../hooks/useOpenAIModels';
import useTreeData from '../hooks/useTreeData';
import ParentPromptPopup from '../components/ParentPromptPopup';
import { DndProvider } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';
import ProjectTree from '../components/ProjectTree';
import ProjectDetails from '../components/ProjectDetails';
import { useNavigate, useLocation } from 'react-router-dom';

const Projects = ({ setUnsavedChanges }) => {
  const [activeItem, setActiveItem] = useState(null);
  const supabase = useSupabase();
  const { treeData, addItem, updateItemName, deleteItem, duplicateItem, moveItem, isLoading, refreshTreeData } = useTreeData(supabase);
  const [selectedItemData, setSelectedItemData] = useState(null);
  const { models } = useOpenAIModels();
  const [showParentPromptPopup, setShowParentPromptPopup] = useState(false);
  const [cascadeInfo, setCascadeInfo] = useState({ itemName: '', fieldName: '' });
  const navigate = useNavigate();
  const location = useLocation();

  const handleUnsavedChanges = useCallback((unsavedFieldsArray) => {
    const updatedUnsavedFields = {};
    unsavedFieldsArray.forEach(field => {
      updatedUnsavedFields[field] = true;
    });
    setUnsavedChanges(updatedUnsavedFields);
  }, [setUnsavedChanges]);

  const handleNavigation = useCallback((to) => {
    navigate(to);
  }, [navigate]);

  const fetchItemData = useCallback(async (itemId) => {
    if (supabase && itemId) {
      try {
        const { data, error } = await supabase
          .from('prompts')
          .select('*')
          .eq('row_id', itemId)
          .single();

        if (error) throw error;
        
        setSelectedItemData(data);
      } catch (error) {
        console.error('Error fetching item data:', error);
        toast.error(`Failed to fetch prompt data: ${error.message}`);
      }
    }
  }, [supabase]);

  useEffect(() => {
    if (activeItem) {
      fetchItemData(activeItem);
    } else {
      setSelectedItemData(null);
    }
  }, [activeItem, fetchItemData]);

  const handleCascade = useCallback((fieldName) => {
    const itemName = selectedItemData?.prompt_name || 'Unknown';
    setCascadeInfo({ itemName, fieldName });
    setShowParentPromptPopup(true);
  }, [selectedItemData]);

  const handleToggleItem = useCallback((itemId) => {
    setActiveItem(itemId);
    fetchItemData(itemId);
  }, [fetchItemData]);

  if (!supabase) {
    return <div>Loading Supabase client...</div>;
  }

  return (
    <DndProvider backend={HTML5Backend}>
      <div className="container mx-auto p-4">
        <PanelGroup direction="horizontal">
          <Panel defaultSize={30} minSize={20}>
            <ProjectTree
              treeData={treeData}
              isLoading={isLoading}
              addItem={addItem}
              updateItemName={updateItemName}
              deleteItem={deleteItem}
              duplicateItem={duplicateItem}
              moveItem={moveItem}
              activeItem={activeItem}
              setActiveItem={handleToggleItem}
              refreshTreeData={refreshTreeData}
              handleNavigation={handleNavigation}
            />
          </Panel>
          <PanelResizeHandle className="w-2 bg-gray-200 hover:bg-gray-300 transition-colors" />
          <Panel>
            <ProjectDetails
              activeItem={activeItem}
              selectedItemData={selectedItemData}
              models={models}
              handleCascade={handleCascade}
              onUnsavedChanges={handleUnsavedChanges}
            />
          </Panel>
        </PanelGroup>
        <ParentPromptPopup
          isOpen={showParentPromptPopup}
          onClose={() => setShowParentPromptPopup(false)}
          parentData={selectedItemData}
          cascadeField={cascadeInfo.fieldName}
        />
      </div>
    </DndProvider>
  );
};

export default Projects;