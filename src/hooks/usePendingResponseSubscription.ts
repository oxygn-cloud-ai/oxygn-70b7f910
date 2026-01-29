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
  const channelRef = useRef<RealtimeChannel | null>(null);

  const clearPendingResponse = useCallback(() => {
    setPendingResponse(null);
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

    // Realtime subscription
    const channel = supabase
      .channel(`pending-response-${responseId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'q_pending_responses',
          filter: `response_id=eq.${responseId}`
        },
        (payload) => {
          console.log('[usePendingResponseSubscription] Update:', payload.eventType);
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

  return {
    pendingResponse,
    error,
    isComplete: pendingResponse?.status === 'completed',
    isFailed: ['failed', 'cancelled', 'incomplete'].includes(pendingResponse?.status || ''),
    isPending: pendingResponse?.status === 'pending',
    outputText: pendingResponse?.output_text || null,
    errorMessage: pendingResponse?.error || null,
    clearPendingResponse,
  };
}
