import { useState, useEffect, useRef } from 'react';
import { useSupabase } from './useSupabase';
import type { RealtimeChannel } from '@supabase/supabase-js';

export interface ManusTask {
  task_id: string;
  status: 'created' | 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  requires_input?: boolean;
  result_message?: string;
  task_url?: string;
  stop_reason?: string;
  attachments?: unknown[];
  [key: string]: unknown;
}

interface UseManusTaskSubscriptionReturn {
  task: ManusTask | null;
  error: Error | null;
  isComplete: boolean;
  isFailed: boolean;
  isCancelled: boolean;
  isRunning: boolean;
  isPending: boolean;
  requiresInput: boolean;
  result: string | undefined;
  taskUrl: string | undefined;
  stopReason: string | undefined;
  attachments: unknown[];
}

/**
 * Hook to subscribe to Manus task updates via Realtime
 */
export function useManusTaskSubscription(taskId: string | null): UseManusTaskSubscriptionReturn {
  const [task, setTask] = useState<ManusTask | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const supabase = useSupabase();
  const channelRef = useRef<RealtimeChannel | null>(null);

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
        setTask(data as ManusTask | null);
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
            setTask(payload.new as ManusTask);
          }
        }
      )
      .subscribe((status) => {
        console.log('[useManusTaskSubscription] Subscription status:', status);
      });

    channelRef.current = channel;

    return () => {
      if (channelRef.current && supabase) {
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
