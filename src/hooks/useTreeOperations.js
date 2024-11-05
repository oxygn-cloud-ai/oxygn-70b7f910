import { useCallback } from 'react';
import { toast } from 'sonner';
import { addPrompt, duplicatePrompt } from '../services/promptMutations';
import { deletePrompt } from '../services/promptDeletion';

export const useTreeOperations = (supabase, refreshTreeData) => {
  const handleAddItem = useCallback(async (parentId) => {
    if (!supabase) return null;
    try {
      const newItemId = await addPrompt(supabase, parentId);
      await refreshTreeData();
      return newItemId;
    } catch (error) {
      console.error('Error adding new prompt:', error);
      toast.error('Failed to add new prompt');
      return null;
    }
  }, [supabase, refreshTreeData]);

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