// @ts-nocheck
import { handleSupabaseError } from './errorHandling';

export const fetchPrompts = async (supabase, parentId) => {
  try {
    const { data, error } = await supabase
      .from(import.meta.env.VITE_PROMPTS_TBL)
      .select('*')
      .eq('parent_row_id', parentId)
      .eq('is_deleted', false)
      .order('position_lex');

    if (error) throw error;
    return data || [];
  } catch (error) {
    handleSupabaseError(error, 'fetching prompts');
    return [];
  }
};