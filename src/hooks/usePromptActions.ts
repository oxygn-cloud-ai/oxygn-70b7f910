/**
 * usePromptActions Hook
 * 
 * Extracted from MainLayout - handles prompt-level actions like starring,
 * toggling exclusions, and other field updates that don't involve execution.
 */

import { useCallback } from 'react';
import { toast } from '@/components/ui/sonner';
import { findNodeById } from '@/utils/promptTreeHelpers';
import type { PromptTreeNode } from '@/types';

interface UsePromptActionsProps {
  treeData: PromptTreeNode[];
  updateField: (rowId: string, fieldName: string, value: unknown) => Promise<boolean>;
  refreshTreeData: () => Promise<void>;
}

interface UsePromptActionsReturn {
  handleToggleStar: (promptId: string) => Promise<void>;
  handleToggleExcludeCascade: (promptId: string) => Promise<void>;
  handleToggleExcludeExport: (promptId: string) => Promise<void>;
  handleToggleField: (promptId: string, fieldName: string, successMessage?: { on: string; off: string }) => Promise<void>;
}

export const usePromptActions = ({
  treeData,
  updateField,
  refreshTreeData,
}: UsePromptActionsProps): UsePromptActionsReturn => {
  
  /**
   * Generic toggle handler for boolean fields
   */
  const handleToggleField = useCallback(async (
    promptId: string,
    fieldName: string,
    successMessage?: { on: string; off: string }
  ): Promise<void> => {
    if (!promptId) return;
    
    const prompt = findNodeById(treeData, promptId);
    const currentValue = prompt?.[fieldName as keyof PromptTreeNode];
    const newValue = !currentValue;
    
    const success = await updateField(promptId, fieldName, newValue);
    if (success) {
      if (successMessage) {
        toast.success(newValue ? successMessage.on : successMessage.off);
      }
      await refreshTreeData();
    }
  }, [treeData, updateField, refreshTreeData]);

  /**
   * Toggle starred status
   */
  const handleToggleStar = useCallback(async (promptId: string): Promise<void> => {
    await handleToggleField(promptId, 'starred', {
      on: 'Starred',
      off: 'Unstarred',
    });
  }, [handleToggleField]);

  /**
   * Toggle exclude from cascade
   */
  const handleToggleExcludeCascade = useCallback(async (promptId: string): Promise<void> => {
    await handleToggleField(promptId, 'exclude_from_cascade', {
      on: 'Excluded from cascade',
      off: 'Included in cascade',
    });
  }, [handleToggleField]);

  /**
   * Toggle exclude from export
   */
  const handleToggleExcludeExport = useCallback(async (promptId: string): Promise<void> => {
    await handleToggleField(promptId, 'exclude_from_export', {
      on: 'Excluded from export',
      off: 'Included in export',
    });
  }, [handleToggleField]);

  return {
    handleToggleStar,
    handleToggleExcludeCascade,
    handleToggleExcludeExport,
    handleToggleField,
  };
};

export default usePromptActions;
