import { handleSupabaseError } from './errorHandling';

export const deletePrompt = async (supabase, id) => {
  try {
    const markAsDeleted = async (itemId) => {
      const { error } = await supabase
        .from(import.meta.env.VITE_PROMPTS_TBL)
        .update({ is_deleted: true })
        .eq('row_id', itemId);
      
      if (error) throw error;

      const { data: children, error: childrenError } = await supabase
        .from(import.meta.env.VITE_PROMPTS_TBL)
        .select('row_id')
        .eq('parent_row_id', itemId);
      
      if (childrenError) throw childrenError;

      for (const child of children) {
        await markAsDeleted(child.row_id);
      }
    };

    await markAsDeleted(id);
  } catch (error) {
    handleSupabaseError(error, 'deleting prompt');
  }
};