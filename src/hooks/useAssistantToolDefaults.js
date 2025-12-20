import { useState, useEffect, useCallback } from 'react';
import { useSupabase } from './useSupabase';
import { toast } from '@/components/ui/sonner';

export const useAssistantToolDefaults = () => {
  const supabase = useSupabase();
  const [defaults, setDefaults] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchDefaults = useCallback(async () => {
    if (!supabase) return;

    try {
      const { data, error } = await supabase
        .from(import.meta.env.VITE_ASSISTANT_TOOL_DEFAULTS_TBL)
        .select('*')
        .limit(1)
        .maybeSingle();

      if (error) throw error;
      setDefaults(data);
    } catch (error) {
      console.error('Error fetching tool defaults:', error);
    } finally {
      setIsLoading(false);
    }
  }, [supabase]);

  useEffect(() => {
    fetchDefaults();
  }, [fetchDefaults]);

  const updateDefaults = useCallback(async (updates) => {
    if (!supabase || !defaults?.row_id) return false;

    try {
      const { error } = await supabase
        .from(import.meta.env.VITE_ASSISTANT_TOOL_DEFAULTS_TBL)
        .update(updates)
        .eq('row_id', defaults.row_id);

      if (error) throw error;
      setDefaults(prev => ({ ...prev, ...updates }));
      toast.success('Tool defaults updated');
      return true;
    } catch (error) {
      console.error('Error updating tool defaults:', error);
      toast.error('Failed to update defaults');
      return false;
    }
  }, [supabase, defaults?.row_id]);

  return {
    defaults,
    isLoading,
    updateDefaults,
    refetch: fetchDefaults,
  };
};
