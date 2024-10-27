import { useCallback } from 'react';
import { toast } from 'sonner';

export const usePromptData = (supabase) => {
  const updateField = useCallback(async (rowId, fieldName, value) => {
    if (!supabase || !rowId) return;

    try {
      const { error } = await supabase
        .from(import.meta.env.VITE_PROMPTS_TBL)
        .update({ [fieldName]: value })
        .eq('row_id', rowId);

      if (error) throw error;
      
      toast.success(`${fieldName} saved successfully`);
      return true;
    } catch (error) {
      console.error('Error updating field:', error);
      toast.error(`Failed to update ${fieldName}: ${error.message}`);
      return false;
    }
  }, [supabase]);

  const fetchItemData = useCallback(async (rowId) => {
    if (!supabase || !rowId) return null;

    try {
      const { data, error } = await supabase
        .from(import.meta.env.VITE_PROMPTS_TBL)
        .select('*')
        .eq('row_id', rowId)
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error fetching item data:', error);
      toast.error(`Failed to fetch prompt data: ${error.message}`);
      return null;
    }
  }, [supabase]);

  return { updateField, fetchItemData };
};