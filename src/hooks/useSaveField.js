import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

export const useSaveField = (projectRowId) => {
  const [isSaving, setIsSaving] = useState(false);

  const saveField = async (fieldName, value) => {
    setIsSaving(true);
    try {
      const { error } = await supabase
        .from(import.meta.env.VITE_PROJECTS_TBL || 'projects')
        .update({ [fieldName]: value })
        .eq('project_row_id', projectRowId);

      if (error) throw error;
    } catch (error) {
      console.error('Error saving field:', error);
    } finally {
      setIsSaving(false);
    }
  };

  return { saveField, isSaving };
};