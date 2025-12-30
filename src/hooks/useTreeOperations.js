import { useCallback, useRef } from 'react';
import { toast } from '@/components/ui/sonner';
import { addPrompt, duplicatePrompt } from '../services/promptMutations';
import { deletePrompt, restorePrompt } from '../services/promptDeletion';
import { useAuth } from '@/contexts/AuthContext';
import { useUndo } from '@/contexts/UndoContext';
import { v4 as uuidv4 } from 'uuid';
import { trackEvent } from '@/lib/posthog';

export const useTreeOperations = (supabase, refreshTreeData) => {
  const { user } = useAuth();
  const { pushUndo, clearUndo } = useUndo();
  const isAddingRef = useRef(false);
  
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
  // insertAfterPromptId: if provided, insert as sibling after this prompt
  const handleAddItem = useCallback(async (parentId, { skipRefresh = false, insertAfterPromptId = null } = {}) => {
    if (!supabase) return null;
    
    // Guard against multiple rapid insertions
    if (isAddingRef.current) {
      console.log('Add already in progress, skipping...');
      return null;
    }
    isAddingRef.current = true;
    
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
      
      const newItemId = await addPrompt(supabase, parentId, defaultAdminPrompt, user?.id, defaultConversationInstructions, insertAfterPromptId);
      if (!skipRefresh) {
        await refreshTreeData();
      }
      toast.success('Prompt created');
      
      // Track prompt creation
      trackEvent('prompt_created', {
        prompt_id: newItemId?.[0]?.row_id,
        parent_id: parentId,
        has_default_content: !!defaultAdminPrompt,
      });
      
      return newItemId;
    } catch (error) {
      console.error('Error adding new prompt:', error);
      toast.error('Failed to add new prompt');
      return null;
    } finally {
      isAddingRef.current = false;
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
      
      toast.success(`"${name}" deleted`, {
        action: {
          label: 'Undo',
          onClick: () => handleRestoreDeleted(actionId, itemId, name)
        },
        duration: 8000
      });
      
      // Track prompt deletion
      trackEvent('prompt_deleted', {
        prompt_id: itemId,
        prompt_name: name,
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
        
        // Track prompt duplication
        trackEvent('prompt_duplicated', {
          source_prompt_id: itemId,
          new_prompt_id: newItemId?.row_id,
        });
        
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

  // ============ BATCH OPERATIONS ============
  
  const handleBatchDelete = useCallback(async (itemIds) => {
    if (!supabase || !itemIds?.length) return false;
    try {
      // Delete all items at once
      const { error } = await supabase
        .from(import.meta.env.VITE_PROMPTS_TBL)
        .update({ is_deleted: true })
        .in('row_id', itemIds);

      if (error) throw error;
      await refreshTreeData();
      toast.success(`${itemIds.length} prompt(s) deleted`);
      return true;
    } catch (error) {
      console.error('Error batch deleting prompts:', error);
      toast.error('Failed to delete prompts');
      return false;
    }
  }, [supabase, refreshTreeData]);

  const handleBatchDuplicate = useCallback(async (itemIds) => {
    if (!supabase || !itemIds?.length) return false;
    try {
      let successCount = 0;
      for (const itemId of itemIds) {
        const newItemId = await duplicatePrompt(supabase, itemId);
        if (newItemId) successCount++;
      }
      await refreshTreeData();
      toast.success(`${successCount} prompt(s) duplicated`);
      return true;
    } catch (error) {
      console.error('Error batch duplicating prompts:', error);
      toast.error('Failed to duplicate prompts');
      return false;
    }
  }, [supabase, refreshTreeData]);

  const handleBatchStar = useCallback(async (itemIds, starred = true) => {
    if (!supabase || !itemIds?.length) return false;
    try {
      const { error } = await supabase
        .from(import.meta.env.VITE_PROMPTS_TBL)
        .update({ starred })
        .in('row_id', itemIds);

      if (error) throw error;
      await refreshTreeData();
      toast.success(`${itemIds.length} prompt(s) ${starred ? 'starred' : 'unstarred'}`);
      return true;
    } catch (error) {
      console.error('Error batch starring prompts:', error);
      toast.error('Failed to update prompts');
      return false;
    }
  }, [supabase, refreshTreeData]);

  const handleBatchToggleExcludeCascade = useCallback(async (itemIds, exclude = true) => {
    if (!supabase || !itemIds?.length) return false;
    try {
      const { error } = await supabase
        .from(import.meta.env.VITE_PROMPTS_TBL)
        .update({ exclude_from_cascade: exclude })
        .in('row_id', itemIds);

      if (error) throw error;
      await refreshTreeData();
      toast.success(`${itemIds.length} prompt(s) ${exclude ? 'excluded from' : 'included in'} cascade`);
      return true;
    } catch (error) {
      console.error('Error batch toggling cascade exclusion:', error);
      toast.error('Failed to update prompts');
      return false;
    }
  }, [supabase, refreshTreeData]);

  const handleBatchToggleExcludeExport = useCallback(async (itemIds, exclude = true) => {
    if (!supabase || !itemIds?.length) return false;
    try {
      const { error } = await supabase
        .from(import.meta.env.VITE_PROMPTS_TBL)
        .update({ exclude_from_export: exclude })
        .in('row_id', itemIds);

      if (error) throw error;
      await refreshTreeData();
      toast.success(`${itemIds.length} prompt(s) ${exclude ? 'excluded from' : 'included in'} export`);
      return true;
    } catch (error) {
      console.error('Error batch toggling export exclusion:', error);
      toast.error('Failed to update prompts');
      return false;
    }
  }, [supabase, refreshTreeData]);

  return {
    handleAddItem,
    handleDeleteItem,
    handleDuplicateItem,
    handleMoveItem,
    handleRestoreDeleted,
    handleRestoreMove,
    // Batch operations
    handleBatchDelete,
    handleBatchDuplicate,
    handleBatchStar,
    handleBatchToggleExcludeCascade,
    handleBatchToggleExcludeExport
  };
};
