import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { RealtimeChannel } from '@supabase/supabase-js';

interface PendingResponse {
  row_id: string;
  response_id: string;
  status: string;
  output_text: string | null;
  error: string | null;
  error_code: string | null;
  created_at: string;
  completed_at: string | null;
}

interface UsePendingResponseSubscriptionResult {
  pendingResponse: PendingResponse | null;
  error: Error | null;
  isComplete: boolean;
  isFailed: boolean;
  isPending: boolean;
  outputText: string | null;
  errorMessage: string | null;
  clearPendingResponse: () => void;
}

export function usePendingResponseSubscription(
  responseId: string | null
): UsePendingResponseSubscriptionResult {
  const [pendingResponse, setPendingResponse] = useState<PendingResponse | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [timedOut, setTimedOut] = useState(false);
  const channelRef = useRef<RealtimeChannel | null>(null);

  const clearPendingResponse = useCallback(() => {
    setPendingResponse(null);
    setTimedOut(false);
  }, []);

  useEffect(() => {
    if (!responseId) {
      setPendingResponse(null);
      return;
    }

    // Initial fetch
    const fetchPending = async (): Promise<void> => {
      const { data, error: fetchError } = await supabase
        .from('q_pending_responses')
        .select('*')
        .eq('response_id', responseId)
        .maybeSingle();
      
      if (fetchError) {
        console.error('[usePendingResponseSubscription] Error:', fetchError);
        setError(fetchError);
      } else if (data) {
        setPendingResponse(data as PendingResponse);
      }
    };
    
    fetchPending();

    // Realtime subscription - listen for both INSERT and UPDATE
    const channel = supabase
      .channel(`pending-response-${responseId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'q_pending_responses',
          filter: `response_id=eq.${responseId}`
        },
        (payload) => {
          console.log('[usePendingResponseSubscription] Event:', payload.eventType);
          if (payload.new) {
            setPendingResponse(payload.new as PendingResponse);
          }
        }
      )
      .subscribe();

    channelRef.current = channel;

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [responseId]);

  // Timeout: if pending for 3 minutes with no webhook update, surface an error
  useEffect(() => {
    if (!responseId || pendingResponse?.status !== 'pending') {
      setTimedOut(false);
      return;
    }
    const timer = setTimeout(() => {
      console.warn('[usePendingResponseSubscription] Timed out waiting for webhook response');
      setTimedOut(true);
    }, 180_000); // 3 minutes
    return () => clearTimeout(timer);
  }, [responseId, pendingResponse?.status]);

  return {
    pendingResponse,
    error,
    isComplete: pendingResponse?.status === 'completed',
    isFailed: timedOut || ['failed', 'cancelled', 'incomplete'].includes(pendingResponse?.status || ''),
    isPending: pendingResponse?.status === 'pending' && !timedOut,
    outputText: pendingResponse?.output_text || null,
    errorMessage: timedOut
      ? 'Background request timed out. The response may still arrive — try refreshing.'
      : (pendingResponse?.error || null),
    clearPendingResponse,
  };
}
