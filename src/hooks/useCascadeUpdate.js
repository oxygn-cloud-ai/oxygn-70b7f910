import { useCallback } from 'react';
import { toast } from 'sonner';
import { useSupabase } from './useSupabase';

export const useCascadeUpdate = (isPopup, parentData, cascadeField) => {
  const supabase = useSupabase();

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

        console.log('Cascade Update Details:', {
          isPopup,
          parentDataRowId: parentData.row_id,
          cascadeField,
          fieldName,
          updateData
        });

        console.log('Supabase API Call:', {
          table: 'prompts',
          method: 'UPDATE',
          data: { [`src_${cascadeField}`]: updateData },
          condition: { row_id: parentData.row_id }
        });

        const { data, error } = await supabase
          .from('prompts')
          .update({ [`src_${cascadeField}`]: updateData })
          .eq('row_id', parentData.row_id)
          .select();

        console.log('Supabase API Response:', {
          data: data,
          error: error
        });

        if (error) throw error;
        
        toast.success('Cascade information updated successfully');
      } catch (error) {
        console.error('Error updating cascade information:', error);
        toast.error(`Failed to update cascade information: ${error.message}`);
      }
    }
  }, [isPopup, parentData, cascadeField, supabase]);

  return { handleCascade };
};
