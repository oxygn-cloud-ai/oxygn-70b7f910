import { useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSupabase } from './useSupabase';
import { toast } from '@/components/ui/sonner';
import { trackEvent } from '@/lib/posthog';

const TOOL_DEFAULTS_QUERY_KEY = ['conversationToolDefaults'];

export interface ToolDefaultsRow {
  row_id: string;
  code_interpreter_enabled?: boolean | null;
  file_search_enabled?: boolean | null;
  function_calling_enabled?: boolean | null;
  confluence_browser_enabled?: boolean | null;
  [key: string]: unknown;
}

export type ToolDefaultsUpdate = Partial<Omit<ToolDefaultsRow, 'row_id'>>;

interface UseConversationToolDefaultsReturn {
  defaults: ToolDefaultsRow | null;
  isLoading: boolean;
  updateDefaults: (updates: ToolDefaultsUpdate) => Promise<boolean>;
  refetch: () => void;
}

export const useConversationToolDefaults = (): UseConversationToolDefaultsReturn => {
  const supabase = useSupabase();
  const queryClient = useQueryClient();

  const fetchDefaults = useCallback(async (): Promise<ToolDefaultsRow | null> => {
    if (!supabase) return null;

    const { data, error } = await supabase
      .from(import.meta.env.VITE_ASSISTANT_TOOL_DEFAULTS_TBL)
      .select('*')
      .limit(1)
      .maybeSingle();

    if (error) throw error;
    return data as ToolDefaultsRow | null;
  }, [supabase]);

  const {
    data: defaults,
    isLoading,
    refetch,
  } = useQuery({
    queryKey: TOOL_DEFAULTS_QUERY_KEY,
    queryFn: fetchDefaults,
    enabled: !!supabase,
  });

  const mutation = useMutation({
    mutationFn: async (updates: ToolDefaultsUpdate): Promise<boolean> => {
      if (!supabase) throw new Error('No backend client');
      if (!defaults?.row_id) throw new Error('No defaults row found');

      const { error } = await supabase
        .from(import.meta.env.VITE_ASSISTANT_TOOL_DEFAULTS_TBL)
        .update(updates)
        .eq('row_id', defaults.row_id);

      if (error) throw error;
      return true;
    },
    onSuccess: async (_, updates) => {
      await queryClient.invalidateQueries({ queryKey: TOOL_DEFAULTS_QUERY_KEY });
      toast.success('Tool defaults updated');
      trackEvent('tool_defaults_updated', { updated_fields: Object.keys(updates) });
    },
    onError: (error) => {
      console.error('Error updating tool defaults:', error);
      toast.error('Failed to update defaults');
    },
  });

  const updateDefaults = useCallback(async (updates: ToolDefaultsUpdate): Promise<boolean> => {
    try {
      const result = await mutation.mutateAsync(updates);
      return !!result;
    } catch {
      return false;
    }
  }, [mutation]);

  return {
    defaults: defaults ?? null,
    isLoading,
    updateDefaults,
    refetch: () => refetch(),
  };
};
