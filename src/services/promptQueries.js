import { handleSupabaseError } from './errorHandling';

export const fetchPromptChildren = async (supabase, parentId) => {
  try {
    const children = await fetchPrompts(supabase, parentId);
    return children.map(child => ({
      ...child,
      id: child.row_id,
      name: child.prompt_name
    }));
  } catch (error) {
    handleSupabaseError(error, 'fetching prompt children');
  }
};