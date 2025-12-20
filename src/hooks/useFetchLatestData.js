import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/components/ui/sonner';

export const useFetchLatestData = () => {
  const [isLoading, setIsLoading] = useState(false);

  const fetchData = async (projectId) => {
    setIsLoading(true);
    try {
      const query = supabase
        .from('projects')
        .select('*')
        .eq('project_id', projectId)
        .maybeSingle();

      console.log('Supabase API Call:', {
        url: query.url.toString(),
        method: 'GET',
        headers: query.headers,
        body: null,
      });

      const { data, error } = await query;

      console.log('Supabase API Response:', {
        status: data ? 200 : 500,
        data: data,
        error: error,
      });

      // PGRST116 means no rows found - treat as normal (no project yet)
      if (error && error.code !== 'PGRST116') throw error;
      return data ?? null;
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
