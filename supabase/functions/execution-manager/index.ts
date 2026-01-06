import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { TABLES } from "../_shared/tables.ts";
import { validateExecutionManagerInput } from "../_shared/validation.ts";

/**
 * Execution Manager Edge Function
 * 
 * Manages trace and span lifecycle for the execution tracking system.
 * 
 * Actions:
 * - start_trace: Begin a new execution trace with mutex protection
 * - create_span: Create a span for a prompt execution
 * - complete_span: Mark a span as completed with results
 * - fail_span: Mark a span as failed with immutable error evidence
 * - complete_trace: Finalize a trace
 * - check_rate_limit: Check and increment rate limit
 */

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Rate limit configuration
const RATE_LIMIT_WINDOW_MS = 60000; // 1 minute
const MAX_REQUESTS_PER_WINDOW = 60;

interface TraceParams {
  entry_prompt_row_id: string;
  execution_type: 'single' | 'cascade_top' | 'cascade_child';
  thread_row_id?: string;
}

interface SpanParams {
  trace_id: string;
  prompt_row_id?: string;
  span_type: 'generation' | 'retry' | 'tool_call' | 'action' | 'error';
  attempt_number?: number;
  previous_attempt_span_id?: string;
}

interface CompleteSpanParams {
  span_id: string;
  status: 'success' | 'failed' | 'skipped';
  openai_response_id?: string;
  output?: string;
  latency_ms?: number;
  usage_tokens?: { input: number; output: number; total: number };
}

interface FailSpanParams {
  span_id: string;
  error_evidence: {
    error_type: string;
    error_message: string;
    error_code?: string;
    stack_trace?: string;
    retry_recommended: boolean;
  };
}

interface CompleteTraceParams {
  trace_id: string;
  status: 'completed' | 'failed' | 'cancelled';
  error_summary?: string;
}

async function validateUser(req: Request): Promise<{ valid: boolean; error?: string; user?: any; supabase?: any }> {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader) {
    return { valid: false, error: 'Missing authorization header' };
  }

  const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
  const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY');
  
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    return { valid: false, error: 'Server configuration error' };
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: authHeader } }
  });

  const { data: { user }, error } = await supabase.auth.getUser();
  
  if (error || !user) {
    return { valid: false, error: 'Invalid or expired token' };
  }

  return { valid: true, user, supabase };
}

async function checkRateLimit(supabase: any, userId: string, endpoint: string): Promise<{ allowed: boolean; remaining: number }> {
  const windowStart = new Date(Math.floor(Date.now() / RATE_LIMIT_WINDOW_MS) * RATE_LIMIT_WINDOW_MS).toISOString();
  
  // Atomic upsert with ON CONFLICT to safely increment counter
  // This handles race conditions by using the unique constraint
  const { data: upserted, error: upsertError } = await supabase
    .from('q_rate_limits')
    .upsert({
      user_id: userId,
      endpoint,
      window_start: windowStart,
      request_count: 1,
    }, {
      onConflict: 'user_id,endpoint,window_start',
      ignoreDuplicates: false,
    })
    .select('request_count')
    .single();
  
  if (upsertError) {
    // If upsert failed, try select + update as last resort
    const { data: existing } = await supabase
      .from('q_rate_limits')
      .select('request_count')
      .eq('user_id', userId)
      .eq('endpoint', endpoint)
      .eq('window_start', windowStart)
      .maybeSingle();
    
    if (existing) {
      if (existing.request_count >= MAX_REQUESTS_PER_WINDOW) {
        return { allowed: false, remaining: 0 };
      }
      
      await supabase
        .from('q_rate_limits')
        .update({ request_count: existing.request_count + 1 })
        .eq('user_id', userId)
        .eq('endpoint', endpoint)
        .eq('window_start', windowStart);
      
      return { allowed: true, remaining: MAX_REQUESTS_PER_WINDOW - existing.request_count - 1 };
    }
    
    // No existing record, must be first request
    return { allowed: true, remaining: MAX_REQUESTS_PER_WINDOW - 1 };
  }
  
  const count = upserted?.request_count || 1;
  if (count > MAX_REQUESTS_PER_WINDOW) {
    return { allowed: false, remaining: 0 };
  }
  return { allowed: true, remaining: MAX_REQUESTS_PER_WINDOW - count };
}

async function startTrace(supabase: any, userId: string, params: TraceParams) {
  const { entry_prompt_row_id, execution_type, thread_row_id } = params;
  
  // 1. Validate ownership and get prompt data
  const { data: prompt, error: promptError } = await supabase
    .from(TABLES.PROMPTS)
    .select('row_id, root_prompt_row_id, prompt_name, owner_id')
    .eq('row_id', entry_prompt_row_id)
    .eq('owner_id', userId)
    .eq('is_deleted', false)
    .maybeSingle();
  
  if (promptError || !prompt) {
    throw new Error('Prompt not found or access denied');
  }
  
  const rootPromptRowId = prompt.root_prompt_row_id || entry_prompt_row_id;
  
  // 2. Fetch family version from root
  const { data: rootPrompt } = await supabase
    .from(TABLES.PROMPTS)
    .select('family_version')
    .eq('row_id', rootPromptRowId)
    .maybeSingle();
  
  const familyVersion = rootPrompt?.family_version || 1;
  
  // 3. Clean up stale traces BEFORE attempting insert (traces running > 2 minutes are likely dead)
  const twoMinutesAgo = new Date(Date.now() - 2 * 60 * 1000).toISOString();
  const { data: staleTraces } = await supabase
    .from('q_execution_traces')
    .select('trace_id')
    .eq('entry_prompt_row_id', entry_prompt_row_id)
    .eq('owner_id', userId)
    .eq('status', 'running')
    .lt('started_at', twoMinutesAgo);
  
  if (staleTraces && staleTraces.length > 0) {
    const staleIds = staleTraces.map((t: any) => t.trace_id);
    console.log(`Cleaning up ${staleIds.length} stale traces for prompt ${entry_prompt_row_id}`);
    
    await supabase
      .from('q_execution_traces')
      .update({
        status: 'failed',
        error_summary: 'Stale trace - auto-cleaned before new execution',
        completed_at: new Date().toISOString(),
      })
      .in('trace_id', staleIds);
  }
  
  // 4. Fetch all family prompts for context snapshot (do this before insert)
  const { data: familyPrompts } = await supabase
    .from(TABLES.PROMPTS)
    .select('row_id, output_response')
    .eq('root_prompt_row_id', rootPromptRowId)
    .eq('is_deleted', false);
  
  const promptIdsAtStart = familyPrompts?.map((p: any) => p.row_id) || [];
  const contextSnapshot: Record<string, string> = {};
  familyPrompts?.forEach((p: any) => {
    if (p.output_response) {
      contextSnapshot[p.row_id] = p.output_response;
    }
  });
  
  // 5. Try to insert new trace - unique partial index enforces mutex at DB level
  // If another trace is running, the insert will fail with unique violation
  const { data: newTrace, error: createError } = await supabase
    .from('q_execution_traces')
    .insert({
      root_prompt_row_id: rootPromptRowId,
      entry_prompt_row_id,
      execution_type,
      owner_id: userId,
      thread_row_id,
      family_version_at_start: familyVersion,
      prompt_ids_at_start: promptIdsAtStart,
      context_snapshot: contextSnapshot,
      status: 'running',
    })
    .select('trace_id, context_snapshot, family_version_at_start')
    .maybeSingle();
  
  // Check if insert failed or no data returned
  if (createError) {
    if (createError.code === '23505' || createError.message?.includes('unique') || createError.message?.includes('duplicate')) {
      // One more attempt: force-clean any running trace for this prompt (edge case: very recent conflict)
      const { data: conflictTrace } = await supabase
        .from('q_execution_traces')
        .select('trace_id, started_at')
        .eq('entry_prompt_row_id', entry_prompt_row_id)
        .eq('owner_id', userId)
        .eq('status', 'running')
        .maybeSingle();
      
      if (conflictTrace) {
        const startedAt = new Date(conflictTrace.started_at).getTime();
        const now = Date.now();
        const ageSeconds = (now - startedAt) / 1000;
        
        // If the conflicting trace is older than 30 seconds, force clean it and retry once
        if (ageSeconds > 30) {
          console.log(`Force-cleaning stuck trace ${conflictTrace.trace_id} (age: ${ageSeconds.toFixed(0)}s)`);
          
          await supabase
            .from('q_execution_traces')
            .update({
              status: 'failed',
              error_summary: 'Force-cleaned due to conflict during new execution',
              completed_at: new Date().toISOString(),
            })
            .eq('trace_id', conflictTrace.trace_id);
          
          // Retry the insert once
          const { data: retryTrace, error: retryError } = await supabase
            .from('q_execution_traces')
            .insert({
              root_prompt_row_id: rootPromptRowId,
              entry_prompt_row_id,
              execution_type,
              owner_id: userId,
              thread_row_id,
              family_version_at_start: familyVersion,
              prompt_ids_at_start: promptIdsAtStart,
              context_snapshot: contextSnapshot,
              status: 'running',
            })
            .select('trace_id, context_snapshot, family_version_at_start')
            .maybeSingle();
          
          if (!retryError && retryTrace) {
            return finishStartTrace(supabase, retryTrace, entry_prompt_row_id, execution_type, userId, familyVersion);
          }
        }
      }
      
      throw new Error('Another execution is already running for this prompt');
    }
    throw createError;
  }
  
  return finishStartTrace(supabase, newTrace, entry_prompt_row_id, execution_type, userId, familyVersion);
}

async function finishStartTrace(
  supabase: any, 
  newTrace: any, 
  entry_prompt_row_id: string, 
  execution_type: string, 
  userId: string, 
  familyVersion: number
) {
  
  // 5. Find previous trace to mark as replaced (after successful insert)
  const { data: previousTrace } = await supabase
    .from('q_execution_traces')
    .select('trace_id')
    .eq('entry_prompt_row_id', entry_prompt_row_id)
    .eq('execution_type', execution_type)
    .eq('owner_id', userId)
    .neq('trace_id', newTrace.trace_id)
    .in('status', ['completed', 'failed'])
    .order('started_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  
  // 7. If there's a previous trace, mark it as replaced
  if (previousTrace) {
    await supabase
      .from('q_execution_traces')
      .update({ status: 'replaced' })
      .eq('trace_id', previousTrace.trace_id);
    
    // Background delete OpenAI responses (fire and forget)
    deletePreviousTraceResponses(previousTrace.trace_id, supabase).catch(err => {
      console.error('Failed to delete previous trace responses:', err);
    });
  }
  
  console.log(JSON.stringify({
    event: 'trace_started',
    trace_id: newTrace.trace_id,
    entry_prompt_row_id,
    execution_type,
    owner_id: userId,
    family_version: familyVersion,
    timestamp: new Date().toISOString(),
  }));
  
  return {
    trace_id: newTrace.trace_id,
    context_snapshot: newTrace.context_snapshot,
    family_version: newTrace.family_version_at_start,
    previous_trace_id: previousTrace?.trace_id || null,
  };
}

async function deletePreviousTraceResponses(traceId: string, supabase: any) {
  const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');
  if (!OPENAI_API_KEY) {
    console.warn('No OpenAI API key, skipping response deletion');
    return;
  }
  
  const { data: spans } = await supabase
    .from('q_execution_spans')
    .select('openai_response_id')
    .eq('trace_id', traceId)
    .not('openai_response_id', 'is', null);
  
  if (!spans || spans.length === 0) return;
  
  // Collect response IDs for clearing thread references
  const responseIds = spans.map((s: any) => s.openai_response_id).filter(Boolean);
  
  // Clear any thread references to these response IDs BEFORE deleting
  // This prevents "previous response not found" errors in future requests
  if (responseIds.length > 0) {
    try {
      const { error: clearError } = await supabase
        .from('q_threads')
        .update({ last_response_id: null })
        .in('last_response_id', responseIds);
      
      if (clearError) {
        console.warn('Failed to clear thread references to deleted responses:', clearError);
      } else {
        console.log(`Cleared thread references to ${responseIds.length} response IDs`);
      }
    } catch (err) {
      console.error('Error clearing thread references:', err);
    }
  }
  
  console.log(`Deleting ${spans.length} OpenAI responses for trace ${traceId}`);
  
  for (const span of spans) {
    try {
      const response = await fetch(
        `https://api.openai.com/v1/responses/${span.openai_response_id}`,
        {
          method: 'DELETE',
          headers: { 'Authorization': `Bearer ${OPENAI_API_KEY}` },
        }
      );
      
      if (!response.ok && response.status !== 404) {
        console.warn(`Failed to delete response ${span.openai_response_id}:`, response.status);
      }
    } catch (err) {
      console.error(`Error deleting response ${span.openai_response_id}:`, err);
    }
  }
}

async function createSpan(supabase: any, userId: string, params: SpanParams) {
  const { trace_id, prompt_row_id, span_type, attempt_number, previous_attempt_span_id } = params;
  
  // Verify trace ownership
  const { data: trace } = await supabase
    .from('q_execution_traces')
    .select('trace_id, status')
    .eq('trace_id', trace_id)
    .eq('owner_id', userId)
    .maybeSingle();
  
  if (!trace) throw new Error('Trace not found or access denied');
  if (trace.status !== 'running') throw new Error('Trace is not running');
  
  // Get next sequence order
  const { data: maxSeq } = await supabase
    .from('q_execution_spans')
    .select('sequence_order')
    .eq('trace_id', trace_id)
    .order('sequence_order', { ascending: false })
    .limit(1)
    .maybeSingle();
  
  const nextSequence = (maxSeq?.sequence_order || 0) + 1;
  
  const { data: span, error } = await supabase
    .from('q_execution_spans')
    .insert({
      trace_id,
      prompt_row_id,
      span_type,
      sequence_order: nextSequence,
      attempt_number: attempt_number || 1,
      previous_attempt_span_id,
      status: 'running',
    })
    .select('span_id')
    .maybeSingle();
  
  if (error) throw error;
  if (!span) throw new Error('Failed to create span - no data returned');
  
  console.log(JSON.stringify({
    event: 'span_created',
    span_id: span.span_id,
    trace_id,
    prompt_row_id,
    span_type,
    sequence_order: nextSequence,
    timestamp: new Date().toISOString(),
  }));
  
  return { span_id: span.span_id, sequence_order: nextSequence };
}

async function completeSpan(supabase: any, userId: string, params: CompleteSpanParams) {
  const { span_id, status, openai_response_id, output, latency_ms, usage_tokens } = params;
  
  // Verify span ownership via trace
  const { data: span } = await supabase
    .from('q_execution_spans')
    .select('span_id, trace_id, prompt_row_id')
    .eq('span_id', span_id)
    .maybeSingle();
  
  if (!span) throw new Error('Span not found');
  
  const { data: trace } = await supabase
    .from('q_execution_traces')
    .select('trace_id, context_snapshot')
    .eq('trace_id', span.trace_id)
    .eq('owner_id', userId)
    .maybeSingle();
  
  if (!trace) throw new Error('Access denied');
  
  // Prepare output storage
  let outputPreview = null;
  let outputArtefactId = null;
  
  if (output) {
    outputPreview = output.substring(0, 500);
    
    // Store large outputs as artefacts
    if (output.length > 500) {
      const encoder = new TextEncoder();
      const data = encoder.encode(output);
      const hashBuffer = await crypto.subtle.digest('SHA-256', data);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
      
      const { data: artefact } = await supabase
        .from('q_execution_artefacts')
        .insert({
          span_id,
          artefact_type: 'output',
          content_hash: hashHex,
          content: output,
        })
        .select('artefact_id')
        .maybeSingle();
      
      outputArtefactId = artefact?.artefact_id;
    }
  }
  
  // Update span
  await supabase
    .from('q_execution_spans')
    .update({
      status,
      openai_response_id,
      output_preview: outputPreview,
      output_artefact_id: outputArtefactId,
      latency_ms,
      usage_tokens,
      completed_at: new Date().toISOString(),
    })
    .eq('span_id', span_id);
  
  // Update context snapshot in trace if successful or skipped (skipped prompts may have placeholder outputs)
  if ((status === 'success' || status === 'skipped') && output && span.prompt_row_id) {
    const updatedSnapshot = { ...trace.context_snapshot };
    updatedSnapshot[span.prompt_row_id] = output;
    
    await supabase
      .from('q_execution_traces')
      .update({ context_snapshot: updatedSnapshot })
      .eq('trace_id', span.trace_id);
  }
  
  console.log(JSON.stringify({
    event: 'span_completed',
    span_id,
    status,
    latency_ms,
    timestamp: new Date().toISOString(),
  }));
  
  return { success: true };
}

async function failSpan(supabase: any, userId: string, params: FailSpanParams) {
  const { span_id, error_evidence } = params;
  
  // Verify span ownership via trace
  const { data: span } = await supabase
    .from('q_execution_spans')
    .select('span_id, trace_id')
    .eq('span_id', span_id)
    .maybeSingle();
  
  if (!span) throw new Error('Span not found');
  
  const { data: trace } = await supabase
    .from('q_execution_traces')
    .select('trace_id')
    .eq('trace_id', span.trace_id)
    .eq('owner_id', userId)
    .maybeSingle();
  
  if (!trace) throw new Error('Access denied');
  
  // Error evidence is IMMUTABLE - never overwritten
  await supabase
    .from('q_execution_spans')
    .update({
      status: 'failed',
      error_evidence,
      completed_at: new Date().toISOString(),
    })
    .eq('span_id', span_id);
  
  console.log(JSON.stringify({
    event: 'span_failed',
    span_id,
    error_type: error_evidence.error_type,
    retry_recommended: error_evidence.retry_recommended,
    timestamp: new Date().toISOString(),
  }));
  
  return { success: true };
}

async function completeTrace(supabase: any, userId: string, params: CompleteTraceParams) {
  const { trace_id, status, error_summary } = params;
  
  const { error } = await supabase
    .from('q_execution_traces')
    .update({
      status,
      error_summary,
      completed_at: new Date().toISOString(),
    })
    .eq('trace_id', trace_id)
    .eq('owner_id', userId);
  
  if (error) throw error;
  
  console.log(JSON.stringify({
    event: 'trace_completed',
    trace_id,
    status,
    timestamp: new Date().toISOString(),
  }));
  
  return { success: true };
}

/**
 * Cleanup orphaned traces that have been 'running' for more than 30 minutes
 */
async function cleanupOrphanedTraces(supabase: any, userId: string) {
  const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000).toISOString();
  
  const { data: orphanedTraces, error: selectError } = await supabase
    .from('q_execution_traces')
    .select('trace_id')
    .eq('owner_id', userId)
    .eq('status', 'running')
    .lt('started_at', thirtyMinutesAgo);
  
  if (selectError) throw selectError;
  
  if (!orphanedTraces || orphanedTraces.length === 0) {
    return { success: true, cleaned_up: 0, message: 'No orphaned traces found' };
  }
  
  const traceIds = orphanedTraces.map((t: any) => t.trace_id);
  
  const { error: updateError } = await supabase
    .from('q_execution_traces')
    .update({
      status: 'failed',
      error_summary: 'Orphaned trace - marked as failed after 30 minutes',
      completed_at: new Date().toISOString(),
    })
    .in('trace_id', traceIds)
    .eq('owner_id', userId);
  
  if (updateError) throw updateError;
  
  console.log(JSON.stringify({
    event: 'orphaned_traces_cleaned',
    count: traceIds.length,
    trace_ids: traceIds,
    timestamp: new Date().toISOString(),
  }));
  
  return { success: true, cleaned_up: traceIds.length };
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Validate user
    const validation = await validateUser(req);
    if (!validation.valid || !validation.user || !validation.supabase) {
      return new Response(JSON.stringify({ error: validation.error }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { user, supabase } = validation;
    
    let parsedBody: any;
    try {
      parsedBody = await req.json();
    } catch (parseError) {
      return new Response(JSON.stringify({ error: 'Invalid JSON in request body' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    
    const { action, ...params } = parsedBody;
    
    // Validate input
    const validation_result = validateExecutionManagerInput({ action, ...params });
    if (!validation_result.valid) {
      return new Response(JSON.stringify({ error: validation_result.error }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Check rate limit
    const rateLimit = await checkRateLimit(supabase, user.id, 'execution-manager');
    if (!rateLimit.allowed) {
      return new Response(JSON.stringify({ 
        error: 'Rate limit exceeded',
        retry_after: 60,
      }), {
        status: 429,
        headers: { ...corsHeaders, 'Content-Type': 'application/json', 'Retry-After': '60' },
      });
    }

    let result;
    switch (action) {
      case 'start_trace':
        result = await startTrace(supabase, user.id, params as TraceParams);
        break;
      case 'create_span':
        result = await createSpan(supabase, user.id, params as SpanParams);
        break;
      case 'complete_span':
        result = await completeSpan(supabase, user.id, params as CompleteSpanParams);
        break;
      case 'fail_span':
        result = await failSpan(supabase, user.id, params as FailSpanParams);
        break;
      case 'complete_trace':
        result = await completeTrace(supabase, user.id, params as CompleteTraceParams);
        break;
      case 'cleanup_orphaned':
        // Mark traces stuck in 'running' for > 30 minutes as 'failed'
        result = await cleanupOrphanedTraces(supabase, user.id);
        break;
      default:
        return new Response(JSON.stringify({ error: `Unknown action: ${action}` }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
    }

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    console.error('Execution manager error:', errorMessage);
    
    // Determine status code based on error
    let status = 500;
    if (errorMessage.includes('not found') || errorMessage.includes('access denied')) {
      status = 404;
    } else if (errorMessage.includes('already running')) {
      status = 409; // Conflict
    }
    
    return new Response(JSON.stringify({ error: errorMessage }), {
      status,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
