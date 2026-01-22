import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/components/ui/sonner';

interface ProjectData {
  project_id: string;
  [key: string]: unknown;
}

interface UseFetchLatestDataReturn {
  fetchLatestData: (projectId: string) => Promise<ProjectData | null>;
  isLoading: boolean;
}

export const useFetchLatestData = (): UseFetchLatestDataReturn => {
  const [isLoading, setIsLoading] = useState(false);

  const fetchData = useCallback(async (projectId: string): Promise<ProjectData | null> => {
    setIsLoading(true);
    try {
      const query = supabase
        .from(import.meta.env.VITE_PROJECTS_TBL || 'projects')
        .select('*')
        .eq('project_id', projectId)
        .maybeSingle();

      if (import.meta.env.DEV) {
        console.log('Supabase API Call:', {
          method: 'GET',
        });
      }

      const { data, error } = await query;

      if (import.meta.env.DEV) {
        console.log('Supabase API Response:', {
          status: data ? 200 : 500,
          data: data,
          error: error,
        });
      }

      // PGRST116 means no rows found - treat as normal (no project yet)
      if (error && error.code !== 'PGRST116') throw error;
      return (data as ProjectData) ?? null;
    } catch (error) {
      console.error('Error fetching data:', error);
      toast.error(`Failed to fetch project data: ${(error as Error).message}`);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, []);

  return { fetchLatestData: fetchData, isLoading };
};
