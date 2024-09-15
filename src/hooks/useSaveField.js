import { useState } from 'react';
import { supabase } from '../lib/supabase';
import { toast } from 'sonner';

export const useSaveField = (projectRowId) => {
  const [isSaving, setIsSaving] = useState(false);

  const saveField = async (fieldName, value) => {
    setIsSaving(true);
    try {
      const { error } = await supabase
        .from('projects')
        .update({ [fieldName]: value })
        .eq('project_row_id', projectRowId);

      if (error) throw error;
      toast.success(`${fieldName} updated successfully`);
    } catch (error) {
      console.error('Error saving field:', error);
      toast.error(`Failed to save ${fieldName}: ${error.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  return { saveField, isSaving };
};
