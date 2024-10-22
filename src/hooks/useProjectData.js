import { useState, useEffect, useCallback } from 'react';
import { useSupabase } from './useSupabase';
import { toast } from 'sonner';

export const useProjectData = (initialData, projectRowId) => {
  const [localData, setLocalData] = useState(initialData);
  const [unsavedChanges, setUnsavedChanges] = useState({});
  const supabase = useSupabase();

  useEffect(() => {
    setLocalData(initialData);
    setUnsavedChanges({});
  }, [initialData]);

  const handleChange = useCallback((fieldName, value) => {
    setLocalData(prevData => ({ ...prevData, [fieldName]: value }));
    setUnsavedChanges(prev => ({ ...prev, [fieldName]: true }));
  }, []);

  const handleSave = useCallback(async (fieldName) => {
    if (!supabase || !projectRowId) return;

    try {
      const { error } = await supabase
        .from('prompts')
        .update({ [fieldName]: localData[fieldName] })
        .eq('row_id', projectRowId);

      if (error) throw error;

      setUnsavedChanges(prev => ({ ...prev, [fieldName]: false }));
      toast.success(`${fieldName} saved successfully`);
    } catch (error) {
      console.error(`Error saving ${fieldName}:`, error);
      toast.error(`Failed to save ${fieldName}: ${error.message}`);
    }
  }, [supabase, projectRowId, localData]);

  const handleReset = useCallback((fieldName) => {
    setLocalData(prevData => ({ ...prevData, [fieldName]: initialData[fieldName] }));
    setUnsavedChanges(prev => ({ ...prev, [fieldName]: false }));
  }, [initialData]);

  const hasUnsavedChanges = useCallback((fieldName) => unsavedChanges[fieldName] || false, [unsavedChanges]);

  const getAllUnsavedFields = useCallback(() => {
    return Object.keys(unsavedChanges).filter(field => unsavedChanges[field]);
  }, [unsavedChanges]);

  return {
    localData,
    handleChange,
    handleSave,
    handleReset,
    hasUnsavedChanges,
    getAllUnsavedFields
  };
};