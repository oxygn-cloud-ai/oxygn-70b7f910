import { useState, useEffect, useCallback, useRef } from 'react';
import { fetchPrompts } from '../services/promptService';
import { toast } from '@/components/ui/sonner';
import { useAuth } from '@/contexts/AuthContext';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/integrations/supabase/types';

export interface TreeNode {
  row_id: string;
  prompt_name: string;
  parent_row_id: string | null;
  position?: string | null;
  node_type?: string | null;
  is_starred?: boolean | null;
  icon?: string | null;
  children?: TreeNode[];
  [key: string]: unknown;
}

interface UseTreeDataReturn {
  treeData: TreeNode[];
  isLoading: boolean;
  refreshTreeData: () => Promise<void>;
}

const useTreeData = (supabase: SupabaseClient<Database> | null): UseTreeDataReturn => {
  const [treeData, setTreeData] = useState<TreeNode[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { user } = useAuth();
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => { isMountedRef.current = false; };
  }, []);

  const refreshTreeData = useCallback(async (): Promise<void> => {
    if (!supabase) {
      if (isMountedRef.current) setTreeData([]);
      return;
    }
    
    try {
      const data = await fetchPrompts(supabase, user?.id);
      if (isMountedRef.current) setTreeData((data as TreeNode[]) || []);
    } catch (error) {
      console.error('Error refreshing tree data:', error);
      if (isMountedRef.current) {
        toast.error('Failed to refresh tree data', {
          source: 'useTreeData.refreshTreeData',
          errorCode: (error as { code?: string })?.code || 'TREE_REFRESH_ERROR',
          details: JSON.stringify({ 
            userId: user?.id, 
            error: (error as Error)?.message, 
            stack: (error as Error)?.stack 
          }, null, 2),
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
