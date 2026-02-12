// @ts-nocheck
import { useState, useEffect, useRef } from 'react';
import { useSupabase } from './useSupabase';

/**
 * Hook to subscribe to Manus task updates via Realtime
 * @param {string} taskId - The Manus task ID to subscribe to
 * @returns {Object} Task state and status helpers
 */
export function useManusTaskSubscription(taskId) {
  const [task, setTask] = useState(null);
  const [error, setError] = useState(null);
  const supabase = useSupabase();
  const channelRef = useRef(null);

  useEffect(() => {
    if (!taskId || !supabase) return;

    // Initial fetch
    const fetchTask = async () => {
      const { data, error: fetchError } = await supabase
        .from('q_manus_tasks')
        .select('*')
        .eq('task_id', taskId)
        .maybeSingle();
      
      if (fetchError) {
        console.error('[useManusTaskSubscription] Error fetching task:', fetchError);
        setError(fetchError);
      } else {
        setTask(data);
      }
    };
    
    fetchTask();

    // Realtime subscription with correct filter syntax (string concatenation)
    const channel = supabase
      .channel('manus-task-' + taskId)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'q_manus_tasks',
          filter: 'task_id=eq.' + taskId
        },
        (payload) => {
          console.log('[useManusTaskSubscription] Task update:', payload.eventType);
          if (payload.new) {
            setTask(payload.new);
          }
        }
      )
      .subscribe((status) => {
        console.log('[useManusTaskSubscription] Subscription status:', status);
      });

    channelRef.current = channel;

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
      }
    };
  }, [taskId, supabase]);

  const isComplete = task?.status === 'completed';
  const isFailed = task?.status === 'failed';
  const isCancelled = task?.status === 'cancelled';
  const isRunning = task?.status === 'running' || task?.status === 'created';
  const isPending = task?.status === 'pending';
  const requiresInput = task?.requires_input === true;

  return {
    task,
    error,
    isComplete,
    isFailed,
    isCancelled,
    isRunning,
    isPending,
    requiresInput,
    result: task?.result_message,
    taskUrl: task?.task_url,
    stopReason: task?.stop_reason,
    attachments: task?.attachments || [],
  };
}

export default useManusTaskSubscription;
