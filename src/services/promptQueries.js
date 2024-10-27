export const fetchPrompts = async (supabase, parentRowId = null) => {
  try {
    let query = supabase
      .from(import.meta.env.VITE_PROMPTS_TBL)
      .select('row_id, parent_row_id, prompt_name, note, created, position')
      .eq('is_deleted', false)
      .order('position', { ascending: true })
      .order('created', { ascending: true });

    if (parentRowId) {
      query = query.eq('parent_row_id', parentRowId);
    } else {
      query = query.is('parent_row_id', null);
    }

    const { data, error } = await query;
    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Error fetching prompts:', error);
    throw error;
  }
};

export const fetchPromptChildren = async (supabase, parentId) => {
  const children = await fetchPrompts(supabase, parentId);
  return children.map(child => ({
    ...child,
    id: child.row_id,
    name: child.prompt_name
  }));
};