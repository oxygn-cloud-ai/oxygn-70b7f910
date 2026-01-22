import { useEffect, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSupabase } from './useSupabase';
import { toast } from '@/components/ui/sonner';
import { trackEvent } from '@/lib/posthog';

const TOOL_DEFAULTS_QUERY_KEY = ['conversationToolDefaults'];

export const useConversationToolDefaults = () => {
  const supabase = useSupabase();
  const queryClient = useQueryClient();

  const fetchDefaults = useCallback(async () => {
    if (!supabase) return null;

    const { data, error } = await supabase
      .from(import.meta.env.VITE_ASSISTANT_TOOL_DEFAULTS_TBL)
      .select('*')
      .limit(1)
      .maybeSingle();

    if (error) throw error;
    return data;
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
    mutationFn: async (updates) => {
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

  const updateDefaults = useCallback(async (updates) => {
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
    refetch,
  };
};
