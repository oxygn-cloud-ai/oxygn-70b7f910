import { useState, useEffect } from 'react';
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

  const handleChange = (fieldName, value) => {
    setLocalData(prevData => ({ ...prevData, [fieldName]: value }));
    setUnsavedChanges(prev => ({ ...prev, [fieldName]: true }));
  };

  const handleSave = async (fieldName) => {
    if (!supabase || !projectRowId) return;

    try {
      const { error } = await supabase
        .from(import.meta.env.VITE_PROMPTS_TBL)
        .update({ [fieldName]: localData[fieldName] })
        .eq('row_id', projectRowId);

      if (error) throw error;

      setUnsavedChanges(prev => ({ ...prev, [fieldName]: false }));
      toast.success(`${fieldName} saved successfully`);
    } catch (error) {
      console.error(`Error saving ${fieldName}:`, error);
      toast.error(`Failed to save ${fieldName}: ${error.message}`);
    }
  };

  const handleReset = (fieldName) => {
    setLocalData(prevData => ({ ...prevData, [fieldName]: initialData[fieldName] }));
    setUnsavedChanges(prev => ({ ...prev, [fieldName]: false }));
  };

  const hasUnsavedChanges = (fieldName) => unsavedChanges[fieldName] || false;

  return {
    localData,
    handleChange,
    handleSave,
    handleReset,
    hasUnsavedChanges
  };
};