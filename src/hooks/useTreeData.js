import { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import { fetchPrompts } from '../services/promptService';

const useTreeData = (supabase) => {
  const [treeData, setTreeData] = useState([]);
  const [defaultAdminPrompt, setDefaultAdminPrompt] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  const fetchTreeData = useCallback(async () => {
    if (!supabase) return;

    try {
      const data = await fetchPrompts(supabase);
      setTreeData(data);

      const { data: settingsData, error: settingsError } = await supabase
        .from(import.meta.env.VITE_SETTINGS_TBL)
        .select('def_admin_prompt')
        .single();

      if (settingsError) throw settingsError;
      setDefaultAdminPrompt(settingsData?.def_admin_prompt || '');
    } catch (error) {
      console.error('Error fetching tree data:', error);
      toast.error('Failed to fetch prompts');
    }
  }, [supabase]);

  useEffect(() => {
    fetchTreeData();
  }, [fetchTreeData]);

  return { treeData, defaultAdminPrompt, isLoading, refreshTreeData: fetchTreeData };
};

export default useTreeData;
