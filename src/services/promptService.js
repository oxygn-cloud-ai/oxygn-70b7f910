import { calculatePosition, getInitialPosition } from '../utils/positionUtils';
import { toast } from 'sonner';
import { handleSupabaseError } from './errorHandling';
import { fetchPromptChildren } from './promptQueries';
import { addPrompt } from './promptMutations';
import { deletePrompt } from './promptDeletion';

export { 
  fetchPrompts,
  fetchPromptChildren,
  addPrompt,
  deletePrompt
};

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

    const promptsWithChildren = await Promise.all(data.map(async (prompt) => {
      const children = await fetchPrompts(supabase, prompt.row_id);
      return {
        ...prompt,
        id: prompt.row_id,
        name: prompt.prompt_name,
        children: children.length > 0 ? children : undefined
      };
    }));

    return promptsWithChildren;
  } catch (error) {
    handleSupabaseError(error, 'fetching prompts');
  }
};