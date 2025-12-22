import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/components/ui/sonner';

export const useWorkbenchThreads = () => {
  const [threads, setThreads] = useState([]);
  const [activeThread, setActiveThread] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchThreads = useCallback(async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('q_workbench_threads')
        .select('*')
        .eq('is_active', true)
        .order('updated_at', { ascending: false });

      if (error) throw error;

      setThreads(data || []);
      
      // Set active thread if none selected or current is deleted
      if (data && data.length > 0) {
        setActiveThread(prev => {
          if (!prev || !data.find(t => t.row_id === prev.row_id)) {
            return data[0];
          }
          return prev;
        });
      } else {
        setActiveThread(null);
      }
    } catch (error) {
      console.error('Error fetching workbench threads:', error);
      toast.error('Failed to load threads');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchThreads();
  }, [fetchThreads]);

  const createThread = useCallback(async (title = 'New Thread') => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { data, error } = await supabase
        .from('q_workbench_threads')
        .insert({
          title,
          owner_id: user.id,
          user_id: user.id,
          is_active: true
        })
        .select()
        .single();

      if (error) throw error;

      setThreads(prev => [data, ...prev]);
      setActiveThread(data);
      toast.success('Thread created');
      return data;
    } catch (error) {
      console.error('Error creating thread:', error);
      toast.error('Failed to create thread');
      return null;
    }
  }, []);

  const updateThread = useCallback(async (rowId, updates) => {
    try {
      const { data, error } = await supabase
        .from('q_workbench_threads')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('row_id', rowId)
        .select()
        .single();

      if (error) throw error;

      setThreads(prev => prev.map(t => t.row_id === rowId ? data : t));
      setActiveThread(prev => prev?.row_id === rowId ? data : prev);
      return data;
    } catch (error) {
      console.error('Error updating thread:', error);
      toast.error('Failed to update thread');
      return null;
    }
  }, []);

  const deleteThread = useCallback(async (rowId) => {
    try {
      // Soft delete by setting is_active to false
      const { error } = await supabase
        .from('q_workbench_threads')
        .update({ is_active: false })
        .eq('row_id', rowId);

      if (error) throw error;

      const remaining = threads.filter(t => t.row_id !== rowId);
      setThreads(remaining);
      
      setActiveThread(prev => {
        if (prev?.row_id === rowId) {
          return remaining.length > 0 ? remaining[0] : null;
        }
        return prev;
      });
      
      toast.success('Thread deleted');
      return true;
    } catch (error) {
      console.error('Error deleting thread:', error);
      toast.error('Failed to delete thread');
      return false;
    }
  }, [threads]);

  return {
    threads,
    activeThread,
    setActiveThread,
    isLoading,
    createThread,
    updateThread,
    deleteThread,
    refetch: fetchThreads
  };
};
