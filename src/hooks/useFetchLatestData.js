import { useState } from 'react';
import { supabase } from '../lib/supabase';

export const useFetchLatestData = (projectRowId) => {
  const [isLoading, setIsLoading] = useState(false);

  const fetchLatestData = async (fieldName) => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('projects')
        .select(fieldName)
        .eq('project_row_id', projectRowId)
        .single();

      if (error) throw error;

      return data[fieldName];
    } catch (error) {
      console.error('Error fetching latest data:', error);
      return null;
    } finally {
      setIsLoading(false);
    }
  };

  return { fetchLatestData, isLoading };
};