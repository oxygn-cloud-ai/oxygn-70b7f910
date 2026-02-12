// @ts-nocheck
import { useState, useCallback, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

const VERSIONS_KEY = 'prompt-versions';

export const usePromptVersions = (promptRowId) => {
  const queryClient = useQueryClient();
  const [currentDiff, setCurrentDiff] = useState(null);
  const [previewData, setPreviewData] = useState(null);

  // Fetch version history
  const {
    data: historyData,
    isLoading: isLoadingHistory,
    error: historyError,
    refetch: refetchHistory
  } = useQuery({
    queryKey: [VERSIONS_KEY, 'history', promptRowId],
    queryFn: async () => {
      if (!promptRowId) return { versions: [], total: 0 };
      
      const { data, error } = await supabase.functions.invoke('prompt-versions', {
        body: { action: 'history', prompt_row_id: promptRowId, limit: 50 }
      });
      
      if (error) throw new Error(error.message || 'Failed to fetch history');
      return data;
    },
    enabled: !!promptRowId,
    staleTime: 30000,
    retry: 2
  });

  // Fetch prompt version state
  const {
    data: promptState,
    refetch: refetchState
  } = useQuery({
    queryKey: [VERSIONS_KEY, 'state', promptRowId],
    queryFn: async () => {
      if (!promptRowId) return null;
      
      const { data, error } = await supabase
        .from('q_prompts')
        .select('current_version, has_uncommitted_changes, last_committed_at')
        .eq('row_id', promptRowId)
        .single();
      
      if (error) throw error;
      return data;
    },
    enabled: !!promptRowId,
    staleTime: 5000
  });

  // Commit mutation
  const commitMutation = useMutation({
    mutationFn: async ({ message, tagName }) => {
      const { data, error } = await supabase.functions.invoke('prompt-versions', {
        body: {
          action: 'commit',
          prompt_row_id: promptRowId,
          commit_message: message,
          tag_name: tagName || undefined
        }
      });
      
      if (error) throw new Error(error.message || 'Commit failed');
      return data;
    },
    onSuccess: (data) => {
      toast.success(`Committed as v${data.version_number}`);
      queryClient.invalidateQueries({ queryKey: [VERSIONS_KEY] });
      queryClient.invalidateQueries({ queryKey: ['prompts'] });
    },
    onError: (error) => {
      toast.error(`Commit failed: ${error.message}`);
    }
  });

  // Rollback mutation
  const rollbackMutation = useMutation({
    mutationFn: async ({ versionId, createBackup = true }) => {
      const { data, error } = await supabase.functions.invoke('prompt-versions', {
        body: {
          action: 'rollback',
          prompt_row_id: promptRowId,
          version_id: versionId,
          create_backup: createBackup
        }
      });
      
      if (error) throw new Error(error.message || 'Rollback failed');
      return data;
    },
    onSuccess: (data) => {
      toast.success(`Rolled back to v${data.restored_version_number}`);
      queryClient.invalidateQueries({ queryKey: [VERSIONS_KEY] });
      queryClient.invalidateQueries({ queryKey: ['prompts'] });
    },
    onError: (error) => {
      toast.error(`Rollback failed: ${error.message}`);
    }
  });

  // Tag mutation
  const tagMutation = useMutation({
    mutationFn: async ({ versionId, tagName }) => {
      const { data, error } = await supabase.functions.invoke('prompt-versions', {
        body: { action: 'tag', version_id: versionId, tag_name: tagName }
      });
      if (error) throw new Error(error.message);
      return data;
    },
    onSuccess: () => {
      toast.success('Tag updated');
      queryClient.invalidateQueries({ queryKey: [VERSIONS_KEY, 'history', promptRowId] });
    },
    onError: (error) => {
      toast.error(`Failed to update tag: ${error.message}`);
    }
  });

  // Pin mutation
  const pinMutation = useMutation({
    mutationFn: async ({ versionId, isPinned }) => {
      const { data, error } = await supabase.functions.invoke('prompt-versions', {
        body: { action: 'pin', version_id: versionId, is_pinned: isPinned }
      });
      if (error) throw new Error(error.message);
      return data;
    },
    onSuccess: (_, variables) => {
      toast.success(variables.isPinned ? 'Version pinned' : 'Version unpinned');
      queryClient.invalidateQueries({ queryKey: [VERSIONS_KEY, 'history', promptRowId] });
    },
    onError: (error) => {
      toast.error(`Failed to update pin: ${error.message}`);
    }
  });

  // Get diff
  const getDiff = useCallback(async (versionA, versionB) => {
    try {
      const { data, error } = await supabase.functions.invoke('prompt-versions', {
        body: {
          action: 'diff',
          prompt_row_id: promptRowId,
          version_a: versionA,
          version_b: versionB
        }
      });
      
      if (error) throw new Error(error.message);
      setCurrentDiff(data.changes);
      return data.changes;
    } catch (error) {
      toast.error(`Diff failed: ${error.message}`);
      return null;
    }
  }, [promptRowId]);

  // Preview version
  const fetchPreview = useCallback(async (versionId) => {
    try {
      const { data, error } = await supabase.functions.invoke('prompt-versions', {
        body: { action: 'preview', version_id: versionId }
      });
      
      if (error) throw new Error(error.message);
      setPreviewData(data);
      return data;
    } catch (error) {
      toast.error(`Preview failed: ${error.message}`);
      return null;
    }
  }, []);

  const clearDiff = useCallback(() => setCurrentDiff(null), []);
  const clearPreview = useCallback(() => setPreviewData(null), []);

  // Invalidate version state when prompt changes (coordinate with save flow)
  const markDirty = useCallback(() => {
    queryClient.setQueryData([VERSIONS_KEY, 'state', promptRowId], (old) => 
      old ? { ...old, has_uncommitted_changes: true } : old
    );
  }, [queryClient, promptRowId]);

  return {
    // Data
    versions: useMemo(() => historyData?.versions || [], [historyData]),
    totalVersions: useMemo(() => historyData?.total || 0, [historyData]),
    currentVersion: promptState?.current_version || 0,
    hasUncommittedChanges: promptState?.has_uncommitted_changes || false,
    lastCommittedAt: promptState?.last_committed_at,
    currentDiff,
    previewData,
    
    // Loading
    isLoading: isLoadingHistory,
    isCommitting: commitMutation.isPending,
    isRollingBack: rollbackMutation.isPending,
    
    // Error
    error: historyError,
    
    // Actions
    commit: (message, tagName) => commitMutation.mutateAsync({ message, tagName }),
    rollback: (versionId, createBackup) => rollbackMutation.mutateAsync({ versionId, createBackup }),
    tagVersion: (versionId, tagName) => tagMutation.mutateAsync({ versionId, tagName }),
    togglePin: (versionId, isPinned) => pinMutation.mutateAsync({ versionId, isPinned }),
    getDiff,
    fetchPreview,
    clearDiff,
    clearPreview,
    markDirty,
    refetchHistory,
    refetchState
  };
};

export default usePromptVersions;
