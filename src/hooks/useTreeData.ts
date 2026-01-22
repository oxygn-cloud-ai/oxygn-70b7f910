import { useState, useEffect, useCallback, useRef } from 'react';
import { fetchPrompts } from '../services/promptService';
import { toast } from '@/components/ui/sonner';
import { useAuth } from '@/contexts/AuthContext';

const useTreeData = (supabase) => {
  const [treeData, setTreeData] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const { user } = useAuth();
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => { isMountedRef.current = false; };
  }, []);

  const refreshTreeData = useCallback(async () => {
    if (!supabase) {
      if (isMountedRef.current) setTreeData([]);
      return;
    }
    
    try {
      const data = await fetchPrompts(supabase, user?.id);
      if (isMountedRef.current) setTreeData(data || []);
    } catch (error) {
      console.error('Error refreshing tree data:', error);
      if (isMountedRef.current) {
        toast.error('Failed to refresh tree data', {
          source: 'useTreeData.refreshTreeData',
          errorCode: error?.code || 'TREE_REFRESH_ERROR',
          details: JSON.stringify({ userId: user?.id, error: error?.message, stack: error?.stack }, null, 2),
        });
        setTreeData([]);
      }
    }
  }, [supabase, user?.id]);

  useEffect(() => {
    const loadTreeData = async () => {
      if (isMountedRef.current) setIsLoading(true);
      await refreshTreeData();
      if (isMountedRef.current) setIsLoading(false);
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