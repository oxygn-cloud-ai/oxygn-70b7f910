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

    // If top-level, destroy the assistant in OpenAI first
    if (!prompt.parent_row_id) {
      // Find the assistant linked to this prompt
      const { data: assistant } = await supabase
        .from(import.meta.env.VITE_ASSISTANTS_TBL)
        .select('row_id, openai_assistant_id')
        .eq('prompt_row_id', id)
        .maybeSingle();

      if (assistant?.openai_assistant_id) {
        // Destroy in OpenAI
        try {
          await supabase.functions.invoke('assistant-manager', {
            body: {
              action: 'destroy',
              assistant_row_id: assistant.row_id,
            },
          });
          console.log('Destroyed assistant in OpenAI for prompt:', id);
        } catch (destroyError) {
          console.error('Failed to destroy assistant:', destroyError);
          // Continue with deletion even if destroy fails
        }
      }

      // Delete the assistant record
      if (assistant?.row_id) {
        await supabase
          .from(import.meta.env.VITE_ASSISTANTS_TBL)
          .delete()
          .eq('row_id', assistant.row_id);
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