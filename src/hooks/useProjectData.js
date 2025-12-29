import React, { useState, useEffect } from 'react';
import { useSupabase } from './useSupabase';
import { toast } from '@/components/ui/sonner';

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

  const handleSave = async (fieldName, valueOverride) => {
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