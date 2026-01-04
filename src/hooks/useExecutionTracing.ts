import { useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

/**
 * useExecutionTracing - Hook for managing execution traces and spans
 * 
 * Provides functions to:
 * - Start/complete traces for cascade and single prompt executions
 * - Create/complete/fail spans for individual prompt runs
 * - Track context snapshots for variable resolution
 */
export const useExecutionTracing = () => {
  /**
   * Start a new execution trace
   */
  const startTrace = useCallback(async (params: {
    entry_prompt_row_id: string;
    execution_type: 'single' | 'cascade_top' | 'cascade_child';
    thread_row_id?: string;
  }) => {
    try {
      const { data, error } = await supabase.functions.invoke('execution-manager', {
        body: {
          action: 'start_trace',
          ...params,
        },
      });

      if (error) {
        console.error('Failed to start trace:', error);
        // Check for concurrent execution error
        if (error.message?.includes('already running')) {
          return { 
            success: false, 
            error: 'Another execution is already running for this prompt',
            code: 'CONCURRENT_EXECUTION',
          };
        }
        return { success: false, error: error.message };
      }

      return {
        success: true,
        trace_id: data.trace_id,
        context_snapshot: data.context_snapshot,
        family_version: data.family_version,
        previous_trace_id: data.previous_trace_id,
      };
    } catch (err) {
      console.error('Exception starting trace:', err);
      return { success: false, error: err instanceof Error ? err.message : String(err) };
    }
  }, []);

  /**
   * Create a span for a prompt execution
   */
  const createSpan = useCallback(async (params: {
    trace_id: string;
    prompt_row_id?: string;
    span_type: 'generation' | 'retry' | 'tool_call' | 'action' | 'error';
    attempt_number?: number;
    previous_attempt_span_id?: string;
  }) => {
    try {
      const { data, error } = await supabase.functions.invoke('execution-manager', {
        body: {
          action: 'create_span',
          ...params,
        },
      });

      if (error) {
        console.error('Failed to create span:', error);
        return { success: false, error: error.message };
      }

      return {
        success: true,
        span_id: data.span_id,
        sequence_order: data.sequence_order,
      };
    } catch (err) {
      console.error('Exception creating span:', err);
      return { success: false, error: err instanceof Error ? err.message : String(err) };
    }
  }, []);

  /**
   * Complete a span with results
   */
  const completeSpan = useCallback(async (params: {
    span_id: string;
    status: 'success' | 'failed' | 'skipped';
    openai_response_id?: string;
    output?: string;
    latency_ms?: number;
    usage_tokens?: { input: number; output: number; total: number };
  }) => {
    try {
      const { data, error } = await supabase.functions.invoke('execution-manager', {
        body: {
          action: 'complete_span',
          ...params,
        },
      });

      if (error) {
        console.error('Failed to complete span:', error);
        return { success: false, error: error.message };
      }

      return { success: true };
    } catch (err) {
      console.error('Exception completing span:', err);
      return { success: false, error: err instanceof Error ? err.message : String(err) };
    }
  }, []);

  /**
   * Fail a span with immutable error evidence
   */
  const failSpan = useCallback(async (params: {
    span_id: string;
    error_evidence: {
      error_type: string;
      error_message: string;
      error_code?: string;
      stack_trace?: string;
      retry_recommended: boolean;
    };
  }) => {
    try {
      const { data, error } = await supabase.functions.invoke('execution-manager', {
        body: {
          action: 'fail_span',
          ...params,
        },
      });

      if (error) {
        console.error('Failed to fail span:', error);
        return { success: false, error: error.message };
      }

      return { success: true };
    } catch (err) {
      console.error('Exception failing span:', err);
      return { success: false, error: err instanceof Error ? err.message : String(err) };
    }
  }, []);

  /**
   * Complete a trace
   */
  const completeTrace = useCallback(async (params: {
    trace_id: string;
    status: 'completed' | 'failed' | 'cancelled';
    error_summary?: string;
  }) => {
    try {
      const { data, error } = await supabase.functions.invoke('execution-manager', {
        body: {
          action: 'complete_trace',
          ...params,
        },
      });

      if (error) {
        console.error('Failed to complete trace:', error);
        return { success: false, error: error.message };
      }

      return { success: true };
    } catch (err) {
      console.error('Exception completing trace:', err);
      return { success: false, error: err instanceof Error ? err.message : String(err) };
    }
  }, []);

  /**
   * Cleanup orphaned traces that have been running for too long
   */
  const cleanupOrphanedTraces = useCallback(async () => {
    try {
      const { data, error } = await supabase.functions.invoke('execution-manager', {
        body: {
          action: 'cleanup_orphaned',
        },
      });

      if (error) {
        console.error('Failed to cleanup orphaned traces:', error);
        return { success: false, error: error.message };
      }

      return {
        success: true,
        cleaned_up: data.cleaned_up,
      };
    } catch (err) {
      console.error('Exception cleaning up traces:', err);
      return { success: false, error: err instanceof Error ? err.message : String(err) };
    }
  }, []);

  return {
    startTrace,
    createSpan,
    completeSpan,
    failSpan,
    completeTrace,
    cleanupOrphanedTraces,
  };
};

export default useExecutionTracing;
