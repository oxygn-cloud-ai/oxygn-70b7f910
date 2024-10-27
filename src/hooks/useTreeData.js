import { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import { fetchPrompts } from '../services/promptService';
import { retry } from '../utils/retryUtils';

const useTreeData = (supabase) => {
  const [treeData, setTreeData] = useState([]);
  const [defaultAdminPrompt, setDefaultAdminPrompt] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  const fetchTreeData = useCallback(async () => {
    if (!supabase) return;

    try {
      // Use retry utility for fetching prompts
      const data = await retry(() => fetchPrompts(supabase), {
        retries: 3,
        delay: 1000
      });
      
      setTreeData(data);

      // Use retry utility for fetching settings
      const { data: settingsData, error: settingsError } = await retry(() => 
        supabase
          .from(import.meta.env.VITE_SETTINGS_TBL)
          .select('def_admin_prompt')
          .single()
      , {
        retries: 3,
        delay: 1000
      });

      if (settingsError) throw settingsError;
      setDefaultAdminPrompt(settingsData?.def_admin_prompt || '');
    } catch (error) {
      console.error('Error fetching tree data:', error);
      toast.error('Network error: Please check your connection and try again');
      setTreeData([]);
    } finally {
      setIsLoading(false);
    }
  }, [supabase]);

  useEffect(() => {
    fetchTreeData();
  }, [fetchTreeData]);

  return { treeData, defaultAdminPrompt, isLoading, refreshTreeData: fetchTreeData };
};

export default useTreeData;