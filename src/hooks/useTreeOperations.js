import { useCallback } from 'react';
import { toast } from '@/components/ui/sonner';
import { addPrompt, duplicatePrompt } from '../services/promptMutations';
import { deletePrompt, restorePrompt } from '../services/promptDeletion';
import { useAuth } from '@/contexts/AuthContext';
import { useUndo } from '@/contexts/UndoContext';
import { v4 as uuidv4 } from 'uuid';

export const useTreeOperations = (supabase, refreshTreeData) => {
  const { user } = useAuth();
  const { pushUndo, clearUndo } = useUndo();
  
  // Restore a deleted prompt
  const handleRestoreDeleted = useCallback(async (actionId, itemId, itemName) => {
    if (!supabase) return false;
    try {
      await restorePrompt(supabase, itemId);
      await refreshTreeData();
      clearUndo(actionId);
      toast.success(`"${itemName}" restored`);
      return true;
    } catch (error) {
      console.error('Error restoring prompt:', error);
      toast.error('Failed to restore prompt');
      return false;
    }
  }, [supabase, refreshTreeData, clearUndo]);

  // Restore a moved prompt to its original parent
  const handleRestoreMove = useCallback(async (actionId, itemId, originalParentId, itemName) => {
    if (!supabase) return false;
    try {
      const { error } = await supabase
        .from(import.meta.env.VITE_PROMPTS_TBL)
        .update({ parent_row_id: originalParentId })
        .eq('row_id', itemId);

      if (error) throw error;
      await refreshTreeData();
      clearUndo(actionId);
      toast.success(`"${itemName}" moved back`);
      return true;
    } catch (error) {
      console.error('Error restoring move:', error);
      toast.error('Failed to undo move');
      return false;
    }
  }, [supabase, refreshTreeData, clearUndo]);
  
  // skipRefresh: when true, don't refresh tree (useful for bulk operations)
  const handleAddItem = useCallback(async (parentId, { skipRefresh = false } = {}) => {
    if (!supabase) return null;
    try {
      // Fetch default admin prompt and conversation instructions from settings
      const { data: settingsData } = await supabase
        .from(import.meta.env.VITE_SETTINGS_TBL)
        .select('setting_key, setting_value')
        .in('setting_key', ['def_admin_prompt', 'def_assistant_instructions']);
      
      const settingsMap = {};
      settingsData?.forEach(row => {
        settingsMap[row.setting_key] = row.setting_value || '';
      });
      
      const defaultAdminPrompt = settingsMap['def_admin_prompt'] || '';
      const defaultConversationInstructions = settingsMap['def_assistant_instructions'] || '';
      
      const newItemId = await addPrompt(supabase, parentId, defaultAdminPrompt, user?.id, defaultConversationInstructions);
      if (!skipRefresh) {
        await refreshTreeData();
      }
      toast.success('Prompt created');
      return newItemId;
    } catch (error) {
      console.error('Error adding new prompt:', error);
      toast.error('Failed to add new prompt');
      return null;
    }
  }, [supabase, refreshTreeData, user?.id]);

  const handleDeleteItem = useCallback(async (itemId, itemName = 'Prompt') => {
    if (!supabase) return false;
    try {
      // Get the prompt data before deleting for undo
      const { data: promptData } = await supabase
        .from(import.meta.env.VITE_PROMPTS_TBL)
        .select('row_id, prompt_name, parent_row_id')
        .eq('row_id', itemId)
        .maybeSingle();

      const name = promptData?.prompt_name || itemName || 'Prompt';
      
      await deletePrompt(supabase, itemId);
      await refreshTreeData();
      
      // Create undo action
      const actionId = uuidv4();
      pushUndo({
        id: actionId,
        type: 'delete',
        itemId,
        itemName: name,
        parentId: promptData?.parent_row_id
      });
      
      // Show toast with undo button
      toast.success(`"${name}" deleted`, {
        action: {
          label: 'Undo',
          onClick: () => handleRestoreDeleted(actionId, itemId, name)
        },
        duration: 8000
      });
      
      return true;
    } catch (error) {
      console.error('Error deleting prompt:', error);
      toast.error('Failed to delete prompt');
      return false;
    }
  }, [supabase, refreshTreeData, pushUndo, handleRestoreDeleted]);

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
      // Get original parent before moving for undo
      const { data: promptData } = await supabase
        .from(import.meta.env.VITE_PROMPTS_TBL)
        .select('row_id, prompt_name, parent_row_id')
        .eq('row_id', itemId)
        .maybeSingle();

      const originalParentId = promptData?.parent_row_id;
      const name = promptData?.prompt_name || 'Prompt';
      
      const { error } = await supabase
        .from(import.meta.env.VITE_PROMPTS_TBL)
        .update({ parent_row_id: targetParentId })
        .eq('row_id', itemId);

      if (error) throw error;
      await refreshTreeData();
      
      // Create undo action
      const actionId = uuidv4();
      pushUndo({
        id: actionId,
        type: 'move',
        itemId,
        itemName: name,
        originalParentId,
        newParentId: targetParentId
      });
      
      // Show toast with undo button
      toast.success(`"${name}" moved`, {
        action: {
          label: 'Undo',
          onClick: () => handleRestoreMove(actionId, itemId, originalParentId, name)
        },
        duration: 8000
      });
      
      return true;
    } catch (error) {
      console.error('Error moving item:', error);
      toast.error('Failed to move item');
      return false;
    }
  }, [supabase, refreshTreeData, pushUndo, handleRestoreMove]);

  return {
    handleAddItem,
    handleDeleteItem,
    handleDuplicateItem,
    handleMoveItem,
    handleRestoreDeleted,
    handleRestoreMove
  };
};
