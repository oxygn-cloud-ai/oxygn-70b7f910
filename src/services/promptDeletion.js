import { handleSupabaseError } from './errorHandling';

export const deletePrompt = async (supabase, id) => {
  try {
    // First, check if this is a top-level prompt with an assistant
    const { data: prompt, error: fetchError } = await supabase
      .from(import.meta.env.VITE_PROMPTS_TBL)
      .select('row_id, parent_row_id')
      .eq('row_id', id)
      .maybeSingle();

    // PGRST116 means no rows found
    if (fetchError && fetchError.code !== 'PGRST116') throw fetchError;
    if (!prompt) return; // Nothing to delete

    // If top-level, delete the assistant record (no OpenAI call needed for Responses API)
    if (!prompt.parent_row_id) {
      // Find and delete the assistant linked to this prompt
      const { data: assistant } = await supabase
        .from(import.meta.env.VITE_ASSISTANTS_TBL)
        .select('row_id')
        .eq('prompt_row_id', id)
        .maybeSingle();

      if (assistant?.row_id) {
        // Delete associated files first
        await supabase
          .from(import.meta.env.VITE_ASSISTANT_FILES_TBL || 'q_assistant_files')
          .delete()
          .eq('assistant_row_id', assistant.row_id);
        
        // Delete associated threads
        await supabase
          .from(import.meta.env.VITE_THREADS_TBL || 'q_threads')
          .delete()
          .eq('assistant_row_id', assistant.row_id);

        // Delete the assistant record
        await supabase
          .from(import.meta.env.VITE_ASSISTANTS_TBL)
          .delete()
          .eq('row_id', assistant.row_id);
          
        console.log('Deleted assistant record for prompt:', id);
      }
    }

    // Mark prompt and children as deleted
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
