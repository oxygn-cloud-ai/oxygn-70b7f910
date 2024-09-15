import { useState } from 'react';
import { supabase } from '../lib/supabase';
import { toast } from 'sonner';

export const useFetchLatestData = () => {
  const [isLoading, setIsLoading] = useState(false);

  const fetchData = async (projectId) => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('projects')
        .select('*')
        .eq('project_id', projectId)
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error fetching data:', error);
      toast.error(`Failed to fetch project data: ${error.message}`);
      return null;
    } finally {
      setIsLoading(false);
    }
  };

  return { fetchLatestData: fetchData, isLoading };
};
