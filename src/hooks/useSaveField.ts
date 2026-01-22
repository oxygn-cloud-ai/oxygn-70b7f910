import { useState, useCallback } from 'react';
import { useSupabase } from './useSupabase';
import { trackEvent, trackException } from '@/lib/posthog';

interface UseSaveFieldReturn {
  saveField: (fieldName: string, value: unknown) => Promise<void>;
  isSaving: boolean;
}

export const useSaveField = (projectRowId: string | null): UseSaveFieldReturn => {
  const supabase = useSupabase();
  const [isSaving, setIsSaving] = useState(false);

  const saveField = useCallback(async (fieldName: string, value: unknown): Promise<void> => {
    if (!projectRowId) return;
    
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
      trackException(error as Error, { context: 'useSaveField', field_name: fieldName });
    } finally {
      setIsSaving(false);
    }
  }, [supabase, projectRowId]);

  return { saveField, isSaving };
};
