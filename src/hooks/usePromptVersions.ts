import { useState, useCallback, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

const VERSIONS_KEY = 'prompt-versions';

export interface PromptVersion {
  version_id: string;
  prompt_row_id: string;
  version_number: number;
  commit_message: string | null;
  tag_name: string | null;
  is_pinned: boolean;
  committed_by: string | null;
  committed_at: string;
  snapshot: Record<string, unknown>;
}

export interface DiffChange {
  field: string;
  before: unknown;
  after: unknown;
  type: 'added' | 'removed' | 'modified';
}

export interface VersionPreview {
  version: PromptVersion;
  snapshot: Record<string, unknown>;
}

interface PromptState {
  current_version: number;
  has_uncommitted_changes: boolean;
  last_committed_at: string | null;
}

interface VersionHistoryResponse {
  versions: PromptVersion[];
  total: number;
}

interface UsePromptVersionsReturn {
  // Data
  versions: PromptVersion[];
  totalVersions: number;
  currentVersion: number;
  hasUncommittedChanges: boolean;
  lastCommittedAt: string | null | undefined;
  currentDiff: DiffChange[] | null;
  previewData: VersionPreview | null;
  
  // Loading
  isLoading: boolean;
  isCommitting: boolean;
  isRollingBack: boolean;
  
  // Error
  error: Error | null;
  
  // Actions
  commit: (message: string, tagName?: string) => Promise<{ version_number: number }>;
  rollback: (versionId: string, createBackup?: boolean) => Promise<{ restored_version_number: number }>;
  tagVersion: (versionId: string, tagName: string) => Promise<void>;
  togglePin: (versionId: string, isPinned: boolean) => Promise<void>;
  getDiff: (versionA: string, versionB: string) => Promise<DiffChange[] | null>;
  fetchPreview: (versionId: string) => Promise<VersionPreview | null>;
  clearDiff: () => void;
  clearPreview: () => void;
  markDirty: () => void;
  refetchHistory: () => void;
  refetchState: () => void;
}

export const usePromptVersions = (promptRowId: string | null): UsePromptVersionsReturn => {
  const queryClient = useQueryClient();
  const [currentDiff, setCurrentDiff] = useState<DiffChange[] | null>(null);
  const [previewData, setPreviewData] = useState<VersionPreview | null>(null);

  // Fetch version history
  const {
    data: historyData,
    isLoading: isLoadingHistory,
    error: historyError,
    refetch: refetchHistory
  } = useQuery({
    queryKey: [VERSIONS_KEY, 'history', promptRowId],
    queryFn: async (): Promise<VersionHistoryResponse> => {
      if (!promptRowId) return { versions: [], total: 0 };
      
      const { data, error } = await supabase.functions.invoke('prompt-versions', {
        body: { action: 'history', prompt_row_id: promptRowId, limit: 50 }
      });
      
      if (error) throw new Error(error.message || 'Failed to fetch history');
      return data as VersionHistoryResponse;
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
    queryFn: async (): Promise<PromptState | null> => {
      if (!promptRowId) return null;
      
      const { data, error } = await supabase
        .from('q_prompts')
        .select('current_version, has_uncommitted_changes, last_committed_at')
        .eq('row_id', promptRowId)
        .single();
      
      if (error) throw error;
      return data as PromptState;
    },
    enabled: !!promptRowId,
    staleTime: 5000
  });

  // Commit mutation
  const commitMutation = useMutation({
    mutationFn: async ({ message, tagName }: { message: string; tagName?: string }) => {
      const { data, error } = await supabase.functions.invoke('prompt-versions', {
        body: {
          action: 'commit',
          prompt_row_id: promptRowId,
          commit_message: message,
          tag_name: tagName || undefined
        }
      });
      
      if (error) throw new Error(error.message || 'Commit failed');
      return data as { version_number: number };
    },
    onSuccess: (data) => {
      toast.success(`Committed as v${data.version_number}`);
      queryClient.invalidateQueries({ queryKey: [VERSIONS_KEY] });
      queryClient.invalidateQueries({ queryKey: ['prompts'] });
    },
    onError: (error: Error) => {
      toast.error(`Commit failed: ${error.message}`);
    }
  });

  // Rollback mutation
  const rollbackMutation = useMutation({
    mutationFn: async ({ versionId, createBackup = true }: { versionId: string; createBackup?: boolean }) => {
      const { data, error } = await supabase.functions.invoke('prompt-versions', {
        body: {
          action: 'rollback',
          prompt_row_id: promptRowId,
          version_id: versionId,
          create_backup: createBackup
        }
      });
      
      if (error) throw new Error(error.message || 'Rollback failed');
      return data as { restored_version_number: number };
    },
    onSuccess: (data) => {
      toast.success(`Rolled back to v${data.restored_version_number}`);
      queryClient.invalidateQueries({ queryKey: [VERSIONS_KEY] });
      queryClient.invalidateQueries({ queryKey: ['prompts'] });
    },
    onError: (error: Error) => {
      toast.error(`Rollback failed: ${error.message}`);
    }
  });

  // Tag mutation
  const tagMutation = useMutation({
    mutationFn: async ({ versionId, tagName }: { versionId: string; tagName: string }) => {
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
    onError: (error: Error) => {
      toast.error(`Failed to update tag: ${error.message}`);
    }
  });

  // Pin mutation
  const pinMutation = useMutation({
    mutationFn: async ({ versionId, isPinned }: { versionId: string; isPinned: boolean }) => {
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
    onError: (error: Error) => {
      toast.error(`Failed to update pin: ${error.message}`);
    }
  });

  // Get diff
  const getDiff = useCallback(async (versionA: string, versionB: string): Promise<DiffChange[] | null> => {
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
      const changes = (data as { changes: DiffChange[] }).changes;
      setCurrentDiff(changes);
      return changes;
    } catch (error) {
      toast.error(`Diff failed: ${(error as Error).message}`);
      return null;
    }
  }, [promptRowId]);

  // Preview version
  const fetchPreview = useCallback(async (versionId: string): Promise<VersionPreview | null> => {
    try {
      const { data, error } = await supabase.functions.invoke('prompt-versions', {
        body: { action: 'preview', version_id: versionId }
      });
      
      if (error) throw new Error(error.message);
      const preview = data as VersionPreview;
      setPreviewData(preview);
      return preview;
    } catch (error) {
      toast.error(`Preview failed: ${(error as Error).message}`);
      return null;
    }
  }, []);

  const clearDiff = useCallback(() => setCurrentDiff(null), []);
  const clearPreview = useCallback(() => setPreviewData(null), []);

  // Invalidate version state when prompt changes (coordinate with save flow)
  const markDirty = useCallback(() => {
    queryClient.setQueryData([VERSIONS_KEY, 'state', promptRowId], (old: PromptState | undefined) => 
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
    error: historyError as Error | null,
    
    // Actions
    commit: (message: string, tagName?: string) => commitMutation.mutateAsync({ message, tagName }),
    rollback: (versionId: string, createBackup?: boolean) => rollbackMutation.mutateAsync({ versionId, createBackup }),
    tagVersion: (versionId: string, tagName: string) => tagMutation.mutateAsync({ versionId, tagName }).then(() => {}),
    togglePin: (versionId: string, isPinned: boolean) => pinMutation.mutateAsync({ versionId, isPinned }).then(() => {}),
    getDiff,
    fetchPreview,
    clearDiff,
    clearPreview,
    markDirty,
    refetchHistory: () => { refetchHistory(); },
    refetchState: () => { refetchState(); }
  };
};

export default usePromptVersions;
