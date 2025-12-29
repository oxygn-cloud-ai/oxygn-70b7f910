import React, { useCallback } from 'react';
import { toast } from '@/components/ui/sonner';

export const useCascadeUpdate = (isPopup, parentData, cascadeField, refreshSelectedItemData) => {
  const handleCascade = useCallback(async (fieldName, selectedItemData) => {
    if (isPopup && parentData && cascadeField) {
      try {
        const fieldContent = selectedItemData?.[fieldName] || '';
        let sourceField;

        switch (fieldName) {
          case 'admin_prompt_result':
            sourceField = 'admin_prompt_result';
            break;
          case 'user_prompt_result':
            sourceField = 'user_prompt_result';
            break;
          case 'input_admin_prompt':
            sourceField = 'input_admin_prompt';
            break;
          case 'input_user_prompt':
            sourceField = 'input_user_prompt';
            break;
          default:
            sourceField = cascadeField;
        }

        const updateData = {
          prompt_id: selectedItemData.row_id,
          sourceField: sourceField,
          startChar: 0,
          endChar: fieldContent.length
        };

        const { data, error } = await supabase
          .from(import.meta.env.VITE_PROMPTS_TBL)
          .update({ [`src_${cascadeField}`]: updateData })
          .eq('row_id', parentData.row_id)
          .select();

        if (error) throw error;
        
        const { error: contentUpdateError } = await supabase
          .from(import.meta.env.VITE_PROMPTS_TBL)
          .update({ [cascadeField]: fieldContent })
          .eq('row_id', parentData.row_id);

        if (contentUpdateError) throw contentUpdateError;

        toast.success('Cascade information and content updated successfully');

        if (refreshSelectedItemData) {
          await refreshSelectedItemData(parentData.row_id);
        }
      } catch (error) {
        console.error('Error updating cascade information:', error);
        toast.error(`Failed to update cascade information: ${error.message}`);
      }
    }
  }, [isPopup, parentData, cascadeField, refreshSelectedItemData]);

  return { handleCascade };
};