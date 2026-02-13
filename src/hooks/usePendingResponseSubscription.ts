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

interface PollResult {
  status: string;
  reasoning_text: string | null;
  output_text: string | null;
}

interface UsePendingResponseSubscriptionResult {
  pendingResponse: PendingResponse | null;
  error: Error | null;
  isComplete: boolean;
  isFailed: boolean;
  isPending: boolean;
  outputText: string | null;
  errorMessage: string | null;
  reasoningText: string | null;
  clearPendingResponse: () => void;
}

const POLL_INTERVAL_MS = 30_000; // 30 seconds
const TIMEOUT_MS = 600_000; // 10 minutes

export function usePendingResponseSubscription(
  responseId: string | null
): UsePendingResponseSubscriptionResult {
  const [pendingResponse, setPendingResponse] = useState<PendingResponse | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [timedOut, setTimedOut] = useState(false);
  const [reasoningText, setReasoningText] = useState<string | null>(null);
  const channelRef = useRef<RealtimeChannel | null>(null);
  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | undefined>(undefined);

  const clearPendingResponse = useCallback(() => {
    setPendingResponse(null);
    setTimedOut(false);
    setReasoningText(null);
  }, []);

  // --- Realtime subscription + initial fetch ---
  useEffect(() => {
    if (!responseId) {
      setPendingResponse(null);
      setReasoningText(null);
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

  // --- Polling for reasoning content ---
  useEffect(() => {
    if (!responseId) {
      setReasoningText(null);
      return;
    }

    const isPending = pendingResponse?.status === 'pending' || pendingResponse === null;
    if (!isPending || timedOut) {
      // Stop polling when no longer pending
      if (pollIntervalRef.current !== undefined) {
        clearInterval(pollIntervalRef.current);
        pollIntervalRef.current = undefined;
      }
      return;
    }

    const doPoll = async (): Promise<void> => {
      try {
        const { data, error: invokeError } = await supabase.functions.invoke<PollResult>(
          'poll-openai-response',
          { body: { response_id: responseId } }
        );

        if (invokeError) {
          console.warn('[usePendingResponseSubscription] Poll error:', invokeError);
          return;
        }

        if (!data) return;

        // Update reasoning text from poll response
        if (data.reasoning_text) {
          setReasoningText(data.reasoning_text);
        }

        // If poll detected terminal status, update local state immediately
        const terminalStatuses = ['completed', 'failed', 'cancelled', 'incomplete'];
        if (terminalStatuses.includes(data.status)) {
          console.log('[usePendingResponseSubscription] Poll detected terminal:', data.status);
          setPendingResponse((prev) => {
            if (!prev) return prev;
            return {
              ...prev,
              status: data.status,
              output_text: data.output_text ?? prev.output_text,
              completed_at: new Date().toISOString(),
            };
          });
        }
      } catch (pollErr) {
        console.warn('[usePendingResponseSubscription] Poll exception:', pollErr);
      }
    };

    // Initial poll after a short delay (give webhook a chance first)
    const initialTimeout = setTimeout(() => {
      doPoll();
      // Then poll every POLL_INTERVAL_MS
      pollIntervalRef.current = setInterval(doPoll, POLL_INTERVAL_MS);
    }, 5_000); // 5s initial delay

    return () => {
      clearTimeout(initialTimeout);
      if (pollIntervalRef.current !== undefined) {
        clearInterval(pollIntervalRef.current);
        pollIntervalRef.current = undefined;
      }
    };
  }, [responseId, pendingResponse?.status, timedOut]);

  // --- Timeout: 10 minutes ---
  useEffect(() => {
    if (!responseId || pendingResponse?.status !== 'pending') {
      setTimedOut(false);
      return;
    }
    const timer = setTimeout(() => {
      console.warn('[usePendingResponseSubscription] Timed out waiting for webhook response');
      setTimedOut(true);
    }, TIMEOUT_MS);
    return () => clearTimeout(timer);
  }, [responseId, pendingResponse?.status]);

  return {
    pendingResponse,
    error,
    isComplete: pendingResponse?.status === 'completed',
    isFailed: timedOut || ['failed', 'cancelled', 'incomplete'].includes(pendingResponse?.status ?? ''),
    isPending: pendingResponse?.status === 'pending' && !timedOut,
    outputText: pendingResponse?.output_text ?? null,
    errorMessage: timedOut
      ? 'Background request timed out. The response may still arrive — try refreshing.'
      : (pendingResponse?.error ?? null),
    reasoningText,
    clearPendingResponse,
  };
}
