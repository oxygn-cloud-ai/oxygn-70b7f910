import { useState, useEffect, useCallback } from 'react';
import { fetchPrompts } from '../services/promptService';
import { toast } from '@/components/ui/sonner';
import { useAuth } from '@/contexts/AuthContext';

const useTreeData = (supabase) => {
  const [treeData, setTreeData] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const { user } = useAuth();

  const refreshTreeData = useCallback(async () => {
    if (!supabase) {
      setTreeData([]);
      return;
    }
    
    try {
      const data = await fetchPrompts(supabase, user?.id);
      setTreeData(data || []);
    } catch (error) {
      console.error('Error refreshing tree data:', error);
      toast.error('Failed to refresh tree data');
      setTreeData([]);
    }
  }, [supabase, user?.id]);

  useEffect(() => {
    const loadTreeData = async () => {
      setIsLoading(true);
      await refreshTreeData();
      setIsLoading(false);
    };

    if (supabase) {
      loadTreeData();
    }
  }, [refreshTreeData, supabase]);

  return { 
    treeData, 
    isLoading, 
    refreshTreeData 
  };
};

export default useTreeData;