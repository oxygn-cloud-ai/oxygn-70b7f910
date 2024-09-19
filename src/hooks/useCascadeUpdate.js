import { useCallback } from 'react';
import { toast } from 'sonner';
import { useSupabase } from './useSupabase';

export const useCascadeUpdate = (isPopup, parentData, cascadeField) => {
  const supabase = useSupabase();

  const handleCascade = useCallback(async (fieldName, selectedItemData) => {
    if (isPopup && parentData && cascadeField) {
      try {
        const fieldContent = selectedItemData?.[fieldName] || '';
        let updateColumn;

        switch (fieldName) {
          case 'admin_prompt_result':
            updateColumn = 'src_admin_prompt_result';
            break;
          case 'user_prompt_result':
            updateColumn = 'src_user_prompt_result';
            break;
          case 'input_admin_prompt':
            updateColumn = 'src_input_admin_prompt';
            break;
          case 'input_user_prompt':
            updateColumn = 'src_input_user_prompt';
            break;
          default:
            updateColumn = cascadeField;
        }

        const updateData = {
          [updateColumn]: fieldContent
        };

        // Log the values before making the Supabase API call
        console.log('Cascade Update Details:', {
          isPopup,
          parentDataRowId: parentData.row_id,
          cascadeField,
          fieldName,
          fieldContent,
          updateData,
          updateColumn
        });

        console.log('Supabase API Call:', {
          table: 'prompts',
          method: 'UPDATE',
          data: updateData,
          condition: { row_id: parentData.row_id },
          columnToUpdate: updateColumn
        });

        // Ensure the data is properly formatted as a string
        const formattedUpdateData = {
          [updateColumn]: JSON.stringify(fieldContent)
        };

        const { data, error } = await supabase
          .from('prompts')
          .update(formattedUpdateData)
          .eq('row_id', parentData.row_id);

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
