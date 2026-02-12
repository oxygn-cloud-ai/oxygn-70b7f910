// @ts-nocheck
import { useState } from 'react';
import { useSupabase } from './useSupabase';
import { trackEvent, trackException } from '@/lib/posthog';

export const useSaveField = (projectRowId) => {
  const supabase = useSupabase();
  const [isSaving, setIsSaving] = useState(false);

  const saveField = async (fieldName, value) => {
    setIsSaving(true);
    try {
      const { error } = await supabase
        .from(import.meta.env.VITE_PROJECTS_TBL || 'projects')
        .update({ [fieldName]: value })
        .eq('project_row_id', projectRowId);

      if (error) throw error;
      
      trackEvent('project_field_saved', { field_name: fieldName });
    } catch (error) {
      console.error('Error saving field:', error);
      trackException(error, { context: 'useSaveField', field_name: fieldName });
    } finally {
      setIsSaving(false);
    }
  };

  return { saveField, isSaving };
};