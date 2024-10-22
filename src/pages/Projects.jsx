import React, { useState, useEffect, useCallback } from 'react';
import { PanelGroup, Panel, PanelResizeHandle } from 'react-resizable-panels';
import { toast } from 'sonner';
import { useSupabase } from '../hooks/useSupabase';
import { useOpenAIModels } from '../hooks/useOpenAIModels';
import useTreeData from '../hooks/useTreeData';
import ParentPromptPopup from '../components/ParentPromptPopup';
import { DndProvider } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';
import { useBeforeUnload } from '../hooks/useBeforeUnload';
import ProjectTree from '../components/ProjectTree';
import ProjectDetails from '../components/ProjectDetails';
import { useNavigate, useLocation } from 'react-router-dom';

const Projects = () => {
  const [activeItem, setActiveItem] = useState(null);
  const supabase = useSupabase();
  const { treeData, addItem, updateItemName, deleteItem, duplicateItem, moveItem, isLoading, refreshTreeData } = useTreeData(supabase);
  const [selectedItemData, setSelectedItemData] = useState(null);
  const { models } = useOpenAIModels();
  const [showParentPromptPopup, setShowParentPromptPopup] = useState(false);
  const [cascadeInfo, setCascadeInfo] = useState({ itemName: '', fieldName: '' });
  const [unsavedFields, setUnsavedFields] = useState({});
  const navigate = useNavigate();
  const location = useLocation();

  const handleUnsavedChanges = useCallback((unsavedFieldsArray) => {
    const updatedUnsavedFields = {};
    unsavedFieldsArray.forEach(field => {
      updatedUnsavedFields[field] = true;
    });
    setUnsavedFields(updatedUnsavedFields);
  }, []);

  const unsavedFieldsMessage = useCallback(() => {
    const fields = Object.keys(unsavedFields).filter(field => unsavedFields[field]);
    if (fields.length === 0) return null;
    return `You have unsaved changes in the following fields: ${fields.join(', ')}. Are you sure you want to leave?`;
  }, [unsavedFields]);

  useBeforeUnload(unsavedFieldsMessage());

  useEffect(() => {
    const handleBeforeNavigate = (event) => {
      const message = unsavedFieldsMessage();
      if (message && !window.confirm(message)) {
        event.preventDefault();
      }
    };

    window.addEventListener('popstate', handleBeforeNavigate);
    return () => {
      window.removeEventListener('popstate', handleBeforeNavigate);
    };
  }, [unsavedFieldsMessage]);

  const handleNavigation = useCallback((to) => {
    const message = unsavedFieldsMessage();
    if (!message || window.confirm(message)) {
      navigate(to);
    }
  }, [navigate, unsavedFieldsMessage]);

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
    const itemName = selectedItemData?.prompt_name || 'Unknown';
    setCascadeInfo({ itemName, fieldName });
    setShowParentPromptPopup(true);
  }, [selectedItemData]);

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
              setActiveItem={setActiveItem}
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
