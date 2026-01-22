import { useState, useEffect } from 'react';
import { useSupabase } from './useSupabase';
import { toast } from '@/components/ui/sonner';
import { trackEvent, trackException } from '@/lib/posthog';

export interface ProjectDataRow {
  row_id?: string;
  [key: string]: unknown;
}

interface UseProjectDataReturn {
  localData: ProjectDataRow;
  handleChange: (fieldName: string, value: unknown) => void;
  handleSave: (fieldName: string, valueOverride?: unknown) => Promise<void>;
  handleReset: (fieldName: string) => void;
  hasUnsavedChanges: (fieldName: string) => boolean;
}

export const useProjectData = (
  initialData: ProjectDataRow,
  projectRowId: string | null
): UseProjectDataReturn => {
  const [localData, setLocalData] = useState<ProjectDataRow>(initialData);
  const [unsavedChanges, setUnsavedChanges] = useState<Record<string, boolean>>({});
  const supabase = useSupabase();

  useEffect(() => {
    setLocalData(initialData);
    setUnsavedChanges({});
  }, [initialData]);

  const handleChange = (fieldName: string, value: unknown): void => {
    setLocalData(prevData => ({ ...prevData, [fieldName]: value }));
    setUnsavedChanges(prev => ({ ...prev, [fieldName]: true }));
  };

  const handleSave = async (fieldName: string, valueOverride?: unknown): Promise<void> => {
    if (!supabase || !projectRowId) return;

    // Use provided value if given, otherwise fall back to localData
    const valueToSave = valueOverride !== undefined ? valueOverride : localData[fieldName];

    try {
      const { error } = await supabase
        .from(import.meta.env.VITE_PROMPTS_TBL)
        .update({ [fieldName]: valueToSave })
        .eq('row_id', projectRowId);

      if (error) throw error;

      // Also update localData to stay in sync when using override
      if (valueOverride !== undefined) {
        setLocalData(prev => ({ ...prev, [fieldName]: valueOverride }));
      }

      setUnsavedChanges(prev => ({ ...prev, [fieldName]: false }));
      trackEvent('prompt_field_saved', { field_name: fieldName });
    } catch (error) {
      console.error(`Error saving ${fieldName}:`, error);
      toast.error(`Failed to save ${fieldName}: ${(error as Error).message}`);
      trackException(error as Error, { context: 'useProjectData.handleSave', field_name: fieldName });
    }
  };

  const handleReset = (fieldName: string): void => {
    setLocalData(prevData => ({ ...prevData, [fieldName]: initialData[fieldName] }));
    setUnsavedChanges(prev => ({ ...prev, [fieldName]: false }));
  };

  const hasUnsavedChanges = (fieldName: string): boolean => unsavedChanges[fieldName] || false;

  return {
    localData,
    handleChange,
    handleSave,
    handleReset,
    hasUnsavedChanges
  };
};
