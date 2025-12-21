import { useCallback } from 'react';
import { toast } from '@/components/ui/sonner';
import { addPrompt, duplicatePrompt } from '../services/promptMutations';
import { deletePrompt } from '../services/promptDeletion';
import { useAuth } from '@/contexts/AuthContext';

export const useTreeOperations = (supabase, refreshTreeData) => {
  const { user } = useAuth();
  
  // skipRefresh: when true, don't refresh tree (useful for bulk operations)
  const handleAddItem = useCallback(async (parentId, { skipRefresh = false } = {}) => {
    if (!supabase) return null;
    try {
      // Fetch default admin prompt and assistant instructions from settings
      const { data: settingsData } = await supabase
        .from(import.meta.env.VITE_SETTINGS_TBL)
        .select('setting_key, setting_value')
        .in('setting_key', ['def_admin_prompt', 'def_assistant_instructions']);
      
      const settingsMap = {};
      settingsData?.forEach(row => {
        settingsMap[row.setting_key] = row.setting_value || '';
      });
      
      const defaultAdminPrompt = settingsMap['def_admin_prompt'] || '';
      const defaultAssistantInstructions = settingsMap['def_assistant_instructions'] || '';
      
      const newItemId = await addPrompt(supabase, parentId, defaultAdminPrompt, user?.id, defaultAssistantInstructions);
      if (!skipRefresh) {
        await refreshTreeData();
      }
      return newItemId;
    } catch (error) {
      console.error('Error adding new prompt:', error);
      toast.error('Failed to add new prompt');
      return null;
    }
  }, [supabase, refreshTreeData, user?.id]);

  const handleDeleteItem = useCallback(async (itemId) => {
    if (!supabase) return false;
    try {
      await deletePrompt(supabase, itemId);
      await refreshTreeData();
      return true;
    } catch (error) {
      console.error('Error deleting prompt:', error);
      toast.error('Failed to delete prompt');
      return false;
    }
  }, [supabase, refreshTreeData]);

  const handleDuplicateItem = useCallback(async (itemId) => {
    if (!supabase) return null;
    try {
      const newItemId = await duplicatePrompt(supabase, itemId);
      if (newItemId) {
        await refreshTreeData();
        toast.success('Prompt duplicated successfully');
        return newItemId;
      }
    } catch (error) {
      console.error('Error duplicating prompt:', error);
      toast.error('Failed to duplicate prompt');
      return null;
    }
  }, [supabase, refreshTreeData]);

  const handleMoveItem = useCallback(async (itemId, targetParentId) => {
    if (!supabase) return false;
    try {
      const { error } = await supabase
        .from(import.meta.env.VITE_PROMPTS_TBL)
        .update({ parent_row_id: targetParentId })
        .eq('row_id', itemId);

      if (error) throw error;
      await refreshTreeData();
      toast.success('Item moved successfully');
      return true;
    } catch (error) {
      console.error('Error moving item:', error);
      toast.error('Failed to move item');
      return false;
    }
  }, [supabase, refreshTreeData]);

  return {
    handleAddItem,
    handleDeleteItem,
    handleDuplicateItem,
    handleMoveItem
  };
};
