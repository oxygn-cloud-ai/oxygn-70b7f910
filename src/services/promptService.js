import { buildTree } from '../utils/positionUtils';

export const fetchPrompts = async (supabase) => {
  try {
    const { data, error } = await supabase
      .from(import.meta.env.VITE_PROMPTS_TBL)
      .select('*')
      .eq('is_deleted', false)
      .order('position');

    if (error) throw error;

    return buildTree(data || []);
  } catch (error) {
    console.error('Error fetching prompts:', error);
    throw error;
  }
};

export const addPrompt = async (supabase, parentId = null, defaultAdminPrompt = '') => {
  try {
    const { data, error } = await supabase
      .from(import.meta.env.VITE_PROMPTS_TBL)
      .insert([{
        parent_row_id: parentId,
        input_admin_prompt: defaultAdminPrompt,
        is_deleted: false
      }])
      .select()
      .single();

    if (error) throw error;
    return data.row_id;
  } catch (error) {
    console.error('Error adding prompt:', error);
    throw error;
  }
};

export const deletePrompt = async (supabase, itemId) => {
  try {
    const { error } = await supabase
      .from(import.meta.env.VITE_PROMPTS_TBL)
      .update({ is_deleted: true })
      .eq('row_id', itemId);

    if (error) throw error;
    return true;
  } catch (error) {
    console.error('Error deleting prompt:', error);
    throw error;
  }
};