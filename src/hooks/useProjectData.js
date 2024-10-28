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

  const handleSave = async (fieldName, sourceInfo = null) => {
    if (!supabase || !projectRowId) return;

    try {
      const updateData = {
        [fieldName]: localData[fieldName]
      };

      // If sourceInfo is provided, update the source_info field
      if (sourceInfo) {
        const currentSourceInfo = localData.source_info || {};
        updateData.source_info = {
          ...currentSourceInfo,
          ...sourceInfo,
          last_updated: new Date().toISOString()
        };
        
        // Also update local state with the new source_info
        setLocalData(prevData => ({
          ...prevData,
          source_info: updateData.source_info
        }));
      }

      // Log the API call details
      console.log('Supabase API Call:', {
        table: import.meta.env.VITE_PROMPTS_TBL,
        method: 'UPDATE',
        filters: { row_id: projectRowId },
        data: updateData
      });

      const { data, error } = await supabase
        .from(import.meta.env.VITE_PROMPTS_TBL)
        .update(updateData)
        .eq('row_id', projectRowId);

      // Log the API response
      console.log('Supabase API Response:', {
        success: !error,
        data: data,
        error: error,
        timestamp: new Date().toISOString()
      });

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