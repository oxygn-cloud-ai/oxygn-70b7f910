import { useState, useEffect, useCallback } from 'react';
import { fetchPrompts } from '../services/promptService';
import { toast } from 'sonner';

const useTreeData = (supabase) => {
  const [treeData, setTreeData] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  const refreshTreeData = useCallback(async () => {
    if (!supabase) return;
    
    try {
      const data = await fetchPrompts(supabase);
      setTreeData(data || []);
    } catch (error) {
      console.error('Error refreshing tree data:', error);
      toast.error('Failed to refresh tree data');
    }
  }, [supabase]);

  useEffect(() => {
    const loadTreeData = async () => {
      setIsLoading(true);
      await refreshTreeData();
      setIsLoading(false);
    };

    loadTreeData();
  }, [refreshTreeData]);

  return { treeData, isLoading, refreshTreeData };
};

export default useTreeData;