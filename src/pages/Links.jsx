import React, { useState, useEffect, useCallback } from 'react';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import LinksTreeItem from '../components/LinksTreeItem';
import useTreeData from '../hooks/useTreeData';
import { PanelGroup, Panel, PanelResizeHandle } from 'react-resizable-panels';
import ProjectPanels from '../components/ProjectPanels';
import { toast } from 'sonner';
import { useSupabase } from '../hooks/useSupabase';
import { useOpenAIModels } from '../hooks/useOpenAIModels';
import { useLocation, useNavigate } from 'react-router-dom';

const Links = () => {
  const [expandedItems, setExpandedItems] = useState([]);
  const [activeItem, setActiveItem] = useState(null);
  const supabase = useSupabase();
  const { treeData, isLoading, refreshTreeData } = useTreeData(supabase);
  const [selectedItemData, setSelectedItemData] = useState(null);
  const { models } = useOpenAIModels();
  const location = useLocation();
  const navigate = useNavigate();
  const [sourceIconId, setSourceIconId] = useState(null);
  const [sourceField, setSourceField] = useState(null);

  useEffect(() => {
    if (location.state) {
      setSourceIconId(location.state.iconId);
      setSourceField(location.state.field);
    }
  }, [location]);

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

  const handleCascade = useCallback(async (fieldName, selectedText) => {
    if (!activeItem || !sourceIconId || !sourceField) {
      toast.error('Unable to cascade: missing information');
      console.error('Cascade info:', { activeItem, sourceIconId, sourceField });
      return;
    }

    const jsonText = JSON.stringify({
      prompt_id: activeItem,
      sourceField: fieldName,
      startChar: 0,
      endChar: selectedText.length
    });

    const sourceColumnMap = {
      input_admin_prompt: 'src_admin_prompt_result',
      input_user_prompt: 'src_user_prompt_result',
      admin_prompt_result: 'src_admin_prompt_result',
      user_prompt_result: 'src_user_prompt_result'
    };

    const sourceColumn = sourceColumnMap[sourceField];

    if (!sourceColumn) {
      toast.error('Invalid source field');
      return;
    }

    try {
      const { error } = await supabase
        .from('prompts')
        .update({ [sourceColumn]: jsonText })
        .eq('row_id', sourceIconId);

      if (error) throw error;

      toast.success('Cascade successful');
      navigate(-1);
    } catch (error) {
      console.error('Error cascading:', error);
      toast.error(`Failed to cascade: ${error.message}`);
    }
  }, [activeItem, sourceIconId, sourceField, supabase, navigate]);

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

  useEffect(() => {
    const handleEscapeKey = (event) => {
      if (event.key === 'Escape') {
        navigate(-1);
      }
    };

    window.addEventListener('keydown', handleEscapeKey);

    return () => {
      window.removeEventListener('keydown', handleEscapeKey);
    };
  }, [navigate]);

  if (!supabase) {
    return <div>Loading Supabase client...</div>;
  }

  return (
    <div className="container mx-auto p-4">
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
                onCascade={handleCascade}
                isLinksPage={true}
                isReadOnly={true}
                sourceIconId={sourceIconId}
                sourceField={sourceField}
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
