import { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import { fetchPrompts, addPrompt, updatePrompt, deletePrompt, duplicatePrompt, movePrompt } from '../services/promptService';

const useTreeData = (supabase) => {
  const [treeData, setTreeData] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [defaultAdminPrompt, setDefaultAdminPrompt] = useState('');

  const fetchTreeData = useCallback(async () => {
    if (!supabase) return;
    setIsLoading(true);
    try {
      const data = await fetchPrompts(supabase);
      setTreeData(data);

      const { data: settingsData, error: settingsError } = await supabase
        .from(import.meta.env.VITE_SETTINGS_TBL)
        .select('def_admin_prompt')
        .single();

      if (settingsError) throw settingsError;
      setDefaultAdminPrompt(settingsData?.def_admin_prompt || '');
    } catch (error) {
      console.error('Error fetching tree data:', error);
      toast.error(`Failed to fetch prompts: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  }, [supabase]);

  useEffect(() => {
    if (supabase) {
      fetchTreeData();
    }
  }, [fetchTreeData, supabase]);

  const addItem = useCallback(async (parentId) => {
    if (!supabase) return null;
    try {
      const newItemId = await addPrompt(supabase, parentId, defaultAdminPrompt);
      await fetchTreeData();
      toast.success('New prompt added successfully');
      return newItemId;
    } catch (error) {
      console.error('Error adding new item:', error);
      toast.error(`Failed to add new item: ${error.message}`);
      return null;
    }
  }, [supabase, fetchTreeData, defaultAdminPrompt]);

  const updateItemName = useCallback(async (id, newName) => {
    if (!supabase) return false;
    try {
      await updatePrompt(supabase, id, { prompt_name: newName });
      await fetchTreeData();
      return true;
    } catch (error) {
      console.error('Error updating item name:', error);
      toast.error(`Failed to update item name: ${error.message}`);
      return false;
    }
  }, [supabase, fetchTreeData]);

  const deleteItem = useCallback(async (id) => {
    if (!supabase) return false;
    try {
      await deletePrompt(supabase, id);
      await fetchTreeData();
      toast.success('Item deleted successfully');
      return true;
    } catch (error) {
      console.error('Error deleting item:', error);
      toast.error(`Failed to delete item: ${error.message}`);
      return false;
    }
  }, [supabase, fetchTreeData]);

  const duplicateItem = useCallback(async (itemId) => {
    if (!supabase) return;
    try {
      await duplicatePrompt(supabase, itemId);
      await fetchTreeData();
      toast.success('Item duplicated successfully');
    } catch (error) {
      console.error('Error duplicating item:', error);
      toast.error(`Failed to duplicate item: ${error.message}`);
    }
  }, [supabase, fetchTreeData]);

  const moveItem = useCallback(async (itemId, newParentId) => {
    if (!supabase) return;
    try {
      await movePrompt(supabase, itemId, newParentId);
      await fetchTreeData();
      toast.success('Item moved successfully');
    } catch (error) {
      console.error('Error moving item:', error);
      toast.error(`Failed to move item: ${error.message}`);
    }
  }, [supabase, fetchTreeData]);

  return { 
    treeData, 
    addItem, 
    updateItemName,
    deleteItem,
    duplicateItem,
    moveItem,
    isLoading,
    refreshTreeData: fetchTreeData,
    defaultAdminPrompt
  };
};

export default useTreeData;