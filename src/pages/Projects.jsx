import React, { useState, useEffect, useCallback } from 'react';
import { Accordion } from "@/components/ui/accordion";
import TreeItem from '../components/TreeItem';
import useTreeData from '../hooks/useTreeData';
import { PanelGroup, Panel, PanelResizeHandle } from 'react-resizable-panels';
import { PlusCircle } from 'lucide-react';
import { Button } from "@/components/ui/button";
import ProjectPanels from '../components/ProjectPanels';
import { toast } from 'sonner';
import { useSupabase } from '../hooks/useSupabase';
import ProjectTree from '../components/ProjectTree';
import ProjectDetails from '../components/ProjectDetails';

const Projects = () => {
  const [expandedItems, setExpandedItems] = useState([]);
  const [activeItem, setActiveItem] = useState(null);
  const supabase = useSupabase();
  const { treeData, addItem, updateItemName, deleteItem, isLoading, refreshTreeData } = useTreeData(supabase);
  const [editingItem, setEditingItem] = useState(null);
  const [selectedItemData, setSelectedItemData] = useState(null);

  const toggleItem = useCallback((itemId, expandAll = false) => {
    console.log('Toggling item:', itemId, 'Expand all:', expandAll);
    if (expandAll) {
      const expandAllDescendants = (item) => {
        let descendants = [item.id];
        if (item.children && item.children.length > 0) {
          item.children.forEach(child => {
            descendants = [...descendants, ...expandAllDescendants(child)];
          });
        }
        return descendants;
      };

      const itemToExpand = treeData.find(item => item.id === itemId);
      if (itemToExpand) {
        const allDescendants = expandAllDescendants(itemToExpand);
        setExpandedItems(prev => {
          const newExpanded = [...new Set([...prev, ...allDescendants])];
          console.log('New expanded items:', newExpanded);
          return newExpanded;
        });
      }
    } else {
      setExpandedItems(prev => {
        const newExpanded = prev.includes(itemId)
          ? prev.filter(id => id !== itemId)
          : [...prev, itemId];
        console.log('New expanded items:', newExpanded);
        return newExpanded;
      });
    }
    setActiveItem(itemId);
  }, [treeData]);

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
      <h1 className="text-2xl font-bold mb-4">Prompts</h1>
      <PanelGroup direction="horizontal">
        <Panel defaultSize={30} minSize={20}>
          <ProjectTree
            treeData={treeData}
            expandedItems={expandedItems}
            setExpandedItems={setExpandedItems}
            toggleItem={toggleItem}
            handleAddItem={handleAddItem}
            updateItemName={updateItemName}
            editingItem={editingItem}
            setEditingItem={setEditingItem}
            activeItem={activeItem}
            setActiveItem={setActiveItem}
            handleDeleteItem={handleDeleteItem}
            isLoading={isLoading}
            refreshTreeData={refreshTreeData}
          />
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
    </div>
  );
};

export default Projects;
