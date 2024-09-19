import { useCallback } from 'react';
import { toast } from 'sonner';
import { useSupabase } from './useSupabase';

export const useCascadeUpdate = (isPopup, parentData, cascadeField) => {
  const supabase = useSupabase();

  const handleCascade = useCallback(async (fieldName, selectedItemData) => {
    if (isPopup && parentData && cascadeField) {
      try {
        const fieldContent = selectedItemData?.[fieldName] || '';
        const updateData = {
          [cascadeField]: fieldContent
        };

        console.log('Supabase API Call:', {
          table: 'prompts',
          method: 'UPDATE',
          data: updateData,
          condition: { row_id: parentData.row_id },
          columnToUpdate: cascadeField
        });

        const { data, error } = await supabase
          .from('prompts')
          .update(updateData)
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
