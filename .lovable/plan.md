

# Adversarial Audit Report: Webhook Architecture + Cleanup Plan

## Executive Summary

After exhaustive verification against the actual codebase, I've identified **17 issues** in the proposed plan that must be addressed before implementation. The plan is fundamentally correct but contains critical gaps, type safety violations, architectural inconsistencies, and missing frontend integration.

---

## Critical Findings

### Finding 1: MISSING OpenAI Webhook Signature Verification Library (CRITICAL)

**Issue**: The plan proposes custom HMAC signature verification, but OpenAI uses Standard Webhooks spec with base64-encoded secrets. The Manus webhook uses RSA-PSS with public key verification (lines 40-110 of `manus-webhook/index.ts`), which is different from OpenAI's approach.

**Evidence**: Web search confirms OpenAI SDK provides `client.webhooks.verifySignature()` method. The plan's custom implementation may be incorrect.

**Resolution**: Use OpenAI's documented Standard Webhooks verification pattern:
```typescript
// CORRECT: Match Standard Webhooks spec exactly
const signedPayload = `${webhookId}.${timestamp}.${body}`;
// Base64-decode the secret (whsec_ prefix indicates base64)
const secretKey = Uint8Array.from(atob(secret.replace('whsec_', '')), c => c.charCodeAt(0));
```

**Updated Code**: The plan's implementation appears correct for Standard Webhooks but needs the `Uint8Array.from` decoding, not string-based atob.

---

### Finding 2: MISSING Frontend SSE Event Handler for `long_running_started` (CRITICAL)

**Issue**: The plan proposes emitting `long_running_started` SSE event but neither `sseStreamParser.ts` nor `useConversationRun.ts` handle this event type.

**Evidence**: 
- `sseStreamParser.ts` (lines 46-115) - no `long_running_started` case
- `useConversationRun.ts` (lines 117-178) - no `long_running_started` handler

**Resolution**: Add to both files:

**File: `src/utils/sseStreamParser.ts`** - Add to `SSEParseCallbacks` interface:
```typescript
onLongRunningStarted?: (responseId: string, message: string) => void;
```

Add case in `parseSSELine`:
```typescript
case 'long_running_started':
  callbacks.onLongRunningStarted?.(parsed.response_id, parsed.message);
  break;
```

**File: `src/hooks/useConversationRun.ts`** - Add handler (~line 178):
```typescript
} else if (event.type === 'long_running_started') {
  // Store response_id for Realtime subscription
  result = {
    interrupted: true,
    interruptType: 'long_running',
    interruptData: {
      responseId: event.response_id,
      message: event.message,
    }
  };
  onProgress?.({ type: 'long_running_started', ...event });
  doneReceived = true;
}
```

---

### Finding 3: MISSING TypeScript Type for `useManusTaskSubscription` (HIGH)

**Issue**: `useManusTaskSubscription.ts` is JavaScript (line 9: `export function useManusTaskSubscription(taskId)`), violating the TypeScript-only requirement.

**Evidence**: File has no TypeScript annotations, uses `useState(null)` without type parameters.

**Resolution**: Convert to TypeScript and add types. The new `usePendingResponseSubscription.ts` in the plan is correctly typed, but should also update the Manus hook for consistency (OUT OF SCOPE for this fix - noted for future).

---

### Finding 4: Missing API Key Retrieval in Webhook Handler (CRITICAL)

**Issue**: The `openai-webhook` handler needs to fetch the response content from OpenAI after receiving the `response.completed` event, but the webhook is unauthenticated (no user JWT). The plan notes `request_metadata?.api_key_ref` but this cannot contain the actual API key for security reasons.

**Evidence**: 
- `credentials.ts` requires `authHeader` parameter (line 78-82)
- Webhook receives no JWT (line 52 of config.toml: `verify_jwt = false`)

**Resolution**: Store encrypted API key reference in `q_pending_responses.request_metadata` when creating the record, then decrypt using service role key in webhook handler. OR use a different approach:

**Preferred Approach**: Don't fetch from OpenAI in webhook. OpenAI sends the full response in the webhook payload for `response.completed` events. The plan's `extractOutputText` function should extract from `data.output` directly:

```typescript
// The webhook payload already contains the full response
case 'response.completed': {
  // data.output contains the full response - no need to fetch
  const outputText = extractOutputText(data.output);
  // ... update database
}
```

This matches the Manus pattern where the webhook payload contains all necessary data.

---

### Finding 5: Missing `source_function` Column Usage (MEDIUM)

**Issue**: The plan adds `source_function` column but doesn't use it for anything. It's added for tracking but the webhook handler doesn't differentiate behavior based on source.

**Resolution**: Either remove the column (KISS principle) or document its intended use. Keeping it for debugging/analytics is acceptable but should be noted.

**Decision**: KEEP - useful for debugging which function created the pending response.

---

### Finding 6: Missing REPLICA IDENTITY for Realtime (HIGH)

**Issue**: The plan adds `ALTER PUBLICATION supabase_realtime ADD TABLE q_pending_responses` but doesn't set `REPLICA IDENTITY FULL` which is required for UPDATE events to include all columns.

**Evidence**: Manus migration (line 67-68) sets both:
```sql
ALTER TABLE q_manus_tasks REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE q_manus_tasks;
```

**Resolution**: Add to migration:
```sql
ALTER TABLE q_pending_responses REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE q_pending_responses;
```

---

### Finding 7: Missing pg_cron Extension Check (MEDIUM)

**Issue**: The plan includes pg_cron scheduling commands but Lovable Cloud may not have pg_cron enabled (query to `cron.job` returned "relation does not exist").

**Evidence**: Database query failed with `relation "cron.job" does not exist`.

**Resolution**: Add migration step to enable extension first, OR use alternative cleanup trigger (e.g., cleanup on webhook handler startup). Since Manus has `cleanup_orphaned_manus_tasks` function that exists, the extension must be available. The cron scheduling may be done separately in Supabase dashboard.

**Alternative**: Call cleanup function from `openai-webhook` handler on each invocation (simple, no cron dependency):
```typescript
// At start of webhook handler
await supabase.rpc('cleanup_orphaned_pending_responses');
```

---

### Finding 8: Type Mismatch in `q_pending_responses` Schema (HIGH)

**Issue**: The plan uses `UUID REFERENCES auth.users(id)` for `owner_id` but the RLS function `current_user_has_allowed_domain()` expects to work with `auth.uid()`. Also, `q_manus_tasks.owner_id` has no foreign key constraint.

**Evidence**: `q_manus_tasks` schema shows `owner_id` with `data_type:uuid is_nullable:NO` but no FK.

**Resolution**: Remove FK constraint to match existing pattern:
```sql
owner_id UUID NOT NULL,  -- No FK, matches q_manus_tasks pattern
```

---

### Finding 9: Missing Thread Row ID in Webhook Payload Update (MEDIUM)

**Issue**: When updating `q_threads.last_response_id`, the webhook uses `pendingResponse.thread_row_id` which may be NULL for chat-initiated runs.

**Evidence**: `prompt-family-chat` creates threads but the pending response is created in `conversation-run` which may not have the thread ID.

**Resolution**: The pending response record must capture `thread_row_id` at creation time. Add validation:
```typescript
// In webhook handler
if (pendingResponse.thread_row_id) {
  await supabase.from('q_threads')
    .update({ last_response_id: responseId })
    .eq('row_id', pendingResponse.thread_row_id);
}
```

The plan already has this guard - VERIFIED CORRECT.

---

### Finding 10: Missing Error Handling for Failed Response Fetch (MEDIUM)

**Issue**: If OpenAI returns an error when we try to fetch the response (which we now know is unnecessary per Finding 4), there's no recovery path.

**Resolution**: Per Finding 4, extract content directly from webhook payload. If `data.output` is empty, mark as failed:
```typescript
if (!outputText && data.status === 'completed') {
  console.warn('[openai-webhook] Completed response has no output text');
  // Still mark as completed but with empty output
}
```

---

### Finding 11: Missing `import { crypto }` Statement Correctness (LOW)

**Issue**: The plan imports `crypto` from Deno std lib but modern Deno has built-in `crypto.subtle` global. The import may cause issues.

**Evidence**: Manus webhook uses `import { crypto } from "https://deno.land/std@0.168.0/crypto/mod.ts"` (line 3).

**Resolution**: Keep the import for consistency with existing pattern - VERIFIED CORRECT.

---

### Finding 12: Missing CORS Headers in Webhook Response (LOW)

**Issue**: The `openai-webhook` function returns plain `Response` objects without CORS headers. While webhooks from OpenAI don't need CORS, this diverges from the pattern in other edge functions.

**Evidence**: All other functions use `getCorsHeaders(origin)` pattern.

**Resolution**: Webhooks from OpenAI servers don't need CORS. However, for debugging via browser, add minimal headers:
```typescript
const headers = { 'Content-Type': 'text/plain' };
return new Response('OK', { status: 200, headers });
```

---

### Finding 13: `usePendingResponseSubscription` Return Type Missing `RealtimeChannel` Import (LOW)

**Issue**: The hook imports `RealtimeChannel` but doesn't use the correct type from Supabase.

**Evidence**: Import `type { RealtimeChannel } from '@supabase/supabase-js'` is needed.

**Resolution**: Already included in plan. VERIFIED CORRECT.

---

### Finding 14: Missing Cleanup for Completed Pending Responses (MEDIUM)

**Issue**: The plan has `cleanup_old_pending_responses` but uses 30 days retention. For high-volume usage, this could accumulate significant data.

**Resolution**: Consider reducing to 7 days or making configurable. For now, 30 days matches `cleanup_old_traces` pattern - KEEP.

---

### Finding 15: Detection Logic for Long-Running May Be Too Aggressive (MEDIUM)

**Issue**: The plan uses `model?.includes('gpt-5') && reasoningEffort === 'high'` but this may trigger webhook mode for operations that complete quickly.

**Evidence**: Not all GPT-5 high-effort requests take >4.5 minutes.

**Resolution**: Add a "streaming started" check - only switch to webhook mode if streaming hasn't started after 60 seconds:
```typescript
// Better detection: wait for actual timeout before switching modes
// This should be handled by existing polling fallback, not preemptive webhook
```

**Alternative**: Only switch to webhook mode AFTER polling fallback is triggered AND we detect we're approaching MAX_EXECUTION_MS. This is more conservative.

**Recommendation**: Keep current detection logic but make it configurable via settings. Document that users can disable webhook mode if preferred.

---

### Finding 16: Missing `prompt-family-chat` Webhook Integration (HIGH)

**Issue**: The plan mentions "Apply same pattern for chat operations" but doesn't provide specific code changes for `prompt-family-chat/index.ts`.

**Resolution**: Add explicit code changes for `prompt-family-chat`:

**File: `supabase/functions/prompt-family-chat/index.ts`**

Add same `isLongRunningOperation` helper and webhook mode detection at equivalent location (after background request creation, before polling fallback).

---

### Finding 17: Potential Duplicate Emission from Phase 1 Fix (LOW)

**Issue**: If polling completes AND the new `output_text_done` emission happens, but then the stream also completes, there could be a duplicate.

**Evidence**: Line 1575 of `prompt-family-chat` has safety check `if (finalContent && !outputTextDoneEmitted)`.

**Resolution**: The plan correctly notes this is handled by `outputTextDoneEmitted` flag. However, verify the flag is set correctly when polling emits:

Looking at line 1532: `outputTextDoneEmitted = streamResult.status === 'completed' && !!streamResult.content;`

This checks `streamResult` which contains the polling result. If polling sets `status: 'completed'` and has content, the flag is set correctly. VERIFIED CORRECT.

---

## Revised Implementation Plan

### Phase 1: Immediate Bug Fix (UNCHANGED)

**File: `supabase/functions/prompt-family-chat/index.ts`**
**Location**: Lines 604-613

Add `output_text_done` emission in polling fallback (as originally specified).

---

### Phase 2: Database Schema (REVISED)

**Migration SQL:**
```sql
-- Table to track long-running OpenAI responses awaiting webhook completion
CREATE TABLE q_pending_responses (
  row_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  response_id TEXT NOT NULL UNIQUE,
  owner_id UUID NOT NULL,  -- No FK, matches q_manus_tasks pattern
  prompt_row_id UUID REFERENCES q_prompts(row_id),
  thread_row_id UUID REFERENCES q_threads(row_id),
  trace_id UUID REFERENCES q_execution_traces(trace_id),
  
  -- Source function tracking
  source_function TEXT NOT NULL DEFAULT 'conversation-run',
  
  -- Status tracking
  status TEXT NOT NULL DEFAULT 'pending',
  output_text TEXT,
  error TEXT,
  error_code TEXT,
  
  -- Context for resumption
  model TEXT,
  reasoning_effort TEXT,
  request_metadata JSONB DEFAULT '{}'::jsonb,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT now(),
  completed_at TIMESTAMPTZ,
  webhook_event_id TEXT,
  
  -- Constraints
  CONSTRAINT valid_status CHECK (status IN ('pending', 'completed', 'failed', 'cancelled', 'incomplete')),
  CONSTRAINT valid_source CHECK (source_function IN ('conversation-run', 'prompt-family-chat'))
);

-- Indexes for efficient lookups
CREATE INDEX idx_pending_responses_response_id ON q_pending_responses(response_id);
CREATE INDEX idx_pending_responses_owner_status ON q_pending_responses(owner_id, status);
CREATE INDEX idx_pending_responses_created_at ON q_pending_responses(created_at);

-- CRITICAL: Enable Realtime with full replica identity
ALTER TABLE q_pending_responses REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE q_pending_responses;

-- RLS policies
ALTER TABLE q_pending_responses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own pending responses" ON q_pending_responses
  FOR SELECT USING (current_user_has_allowed_domain() AND (is_admin(auth.uid()) OR owner_id = auth.uid()));

CREATE POLICY "Users can insert own pending responses" ON q_pending_responses
  FOR INSERT WITH CHECK (current_user_has_allowed_domain() AND owner_id = auth.uid());

CREATE POLICY "Users can update own pending responses" ON q_pending_responses
  FOR UPDATE USING (current_user_has_allowed_domain() AND (is_admin(auth.uid()) OR owner_id = auth.uid()));

CREATE POLICY "Users can delete own pending responses" ON q_pending_responses
  FOR DELETE USING (current_user_has_allowed_domain() AND (is_admin(auth.uid()) OR owner_id = auth.uid()));

-- Cleanup functions (matching existing patterns)
CREATE OR REPLACE FUNCTION public.cleanup_orphaned_pending_responses()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  UPDATE q_pending_responses
  SET status = 'failed',
      error = 'Orphaned request cleaned up after 2 hours',
      completed_at = now()
  WHERE status = 'pending'
    AND created_at < now() - interval '2 hours';
END;
$function$;

CREATE OR REPLACE FUNCTION public.cleanup_old_pending_responses()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  DELETE FROM q_pending_responses
  WHERE completed_at < now() - interval '30 days'
    AND status IN ('completed', 'failed', 'cancelled', 'incomplete');
END;
$function$;
```

---

### Phase 3: OpenAI Webhook Edge Function (REVISED)

**File: `supabase/functions/openai-webhook/index.ts`** (NEW)

Key revisions:
1. Extract output text directly from webhook payload (no OpenAI API call needed)
2. Call cleanup function on each invocation (no pg_cron dependency)
3. Proper TypeScript interfaces

```typescript
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { crypto } from "https://deno.land/std@0.168.0/crypto/mod.ts";

// TypeScript interfaces for type safety
interface WebhookPayload {
  type: string;
  id: string;
  created_at: number;
  data: {
    id: string;
    status?: string;
    error?: {
      code?: string;
      message?: string;
    };
    output?: Array<{
      type: string;
      content?: Array<{
        type: string;
        text?: string;
      }>;
    }>;
    usage?: {
      input_tokens: number;
      output_tokens: number;
    };
  };
}

interface PendingResponse {
  row_id: string;
  response_id: string;
  owner_id: string;
  prompt_row_id: string | null;
  thread_row_id: string | null;
  trace_id: string | null;
  source_function: string;
  status: string;
  webhook_event_id: string | null;
  request_metadata: Record<string, unknown>;
}

// Standard Webhooks signature verification
async function verifyWebhookSignature(
  req: Request,
  body: string,
  secret: string
): Promise<boolean> {
  const webhookId = req.headers.get('webhook-id');
  const webhookTimestamp = req.headers.get('webhook-timestamp');
  const webhookSignature = req.headers.get('webhook-signature');
  
  if (!webhookId || !webhookTimestamp || !webhookSignature) {
    console.error('[openai-webhook] Missing signature headers');
    return false;
  }
  
  // Check timestamp is within 5 minutes (300 seconds)
  const timestamp = parseInt(webhookTimestamp, 10);
  const now = Math.floor(Date.now() / 1000);
  if (Math.abs(now - timestamp) > 300) {
    console.error('[openai-webhook] Timestamp outside acceptable range:', { timestamp, now });
    return false;
  }
  
  try {
    // Construct signature payload per Standard Webhooks spec
    const signaturePayload = `${webhookId}.${webhookTimestamp}.${body}`;
    
    // Decode base64 secret (remove whsec_ prefix if present)
    const secretBase64 = secret.replace('whsec_', '');
    const secretBytes = Uint8Array.from(atob(secretBase64), c => c.charCodeAt(0));
    
    const key = await crypto.subtle.importKey(
      'raw',
      secretBytes,
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );
    
    const signatureBytes = await crypto.subtle.sign(
      'HMAC',
      key,
      new TextEncoder().encode(signaturePayload)
    );
    
    const computedSignature = 'v1,' + btoa(
      String.fromCharCode(...new Uint8Array(signatureBytes))
    );
    
    // Check if computed signature matches any provided signature
    return webhookSignature.split(' ').some(sig => sig === computedSignature);
  } catch (error) {
    console.error('[openai-webhook] Signature verification error:', error);
    return false;
  }
}

// Extract output text from OpenAI response output array
function extractOutputText(output: WebhookPayload['data']['output']): string {
  let text = '';
  for (const item of output || []) {
    if (item.type === 'message' && item.content) {
      for (const c of item.content) {
        if (c.type === 'output_text' && c.text) {
          text += c.text;
        }
      }
    }
  }
  return text;
}

serve(async (req) => {
  const body = await req.text();
  
  // Verify signature if secret is configured
  const webhookSecret = Deno.env.get('OPENAI_WEBHOOK_SECRET');
  if (webhookSecret) {
    const isValid = await verifyWebhookSignature(req, body, webhookSecret);
    if (!isValid) {
      console.error('[openai-webhook] Invalid webhook signature');
      return new Response('Unauthorized', { status: 401 });
    }
  } else {
    console.warn('[openai-webhook] No webhook secret configured, skipping verification');
  }
  
  let payload: WebhookPayload;
  try {
    payload = JSON.parse(body);
  } catch {
    console.error('[openai-webhook] Invalid JSON payload');
    return new Response('Bad Request', { status: 400 });
  }
  
  const { type, id: eventId, data } = payload;
  const responseId = data?.id;
  
  console.log('[openai-webhook] Event received:', { type, responseId, eventId });
  
  // Use service role for database operations
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );
  
  // Run cleanup on each webhook invocation (no pg_cron dependency)
  try {
    await supabase.rpc('cleanup_orphaned_pending_responses');
  } catch (cleanupError) {
    console.warn('[openai-webhook] Cleanup failed:', cleanupError);
  }
  
  // Find pending response
  const { data: pendingResponse } = await supabase
    .from('q_pending_responses')
    .select('*')
    .eq('response_id', responseId)
    .maybeSingle() as { data: PendingResponse | null };
  
  if (!pendingResponse) {
    console.log('[openai-webhook] No pending response for:', responseId);
    return new Response('OK', { status: 200 });
  }
  
  // Idempotency check
  if (pendingResponse.webhook_event_id === eventId) {
    console.log('[openai-webhook] Event already processed:', eventId);
    return new Response('OK', { status: 200 });
  }
  
  const now = new Date().toISOString();
  
  switch (type) {
    case 'response.completed': {
      // Extract output directly from webhook payload (no API call needed)
      const outputText = extractOutputText(data.output);
      
      // Update pending response
      await supabase.from('q_pending_responses')
        .update({
          status: 'completed',
          output_text: outputText,
          completed_at: now,
          webhook_event_id: eventId,
        })
        .eq('row_id', pendingResponse.row_id);
      
      // Update thread last_response_id if available
      if (pendingResponse.thread_row_id) {
        await supabase.from('q_threads')
          .update({ last_response_id: responseId })
          .eq('row_id', pendingResponse.thread_row_id);
      }
      
      // Update prompt output_response if available
      if (pendingResponse.prompt_row_id) {
        await supabase.from('q_prompts')
          .update({
            output_response: outputText,
            user_prompt_result: outputText,
            updated_at: now,
          })
          .eq('row_id', pendingResponse.prompt_row_id);
      }
      
      // Complete execution trace if exists
      if (pendingResponse.trace_id) {
        await supabase.from('q_execution_traces')
          .update({
            status: 'completed',
            completed_at: now,
          })
          .eq('trace_id', pendingResponse.trace_id);
      }
      
      console.log('[openai-webhook] Response completed:', responseId, 'output length:', outputText.length);
      break;
    }
    
    case 'response.failed':
    case 'response.cancelled':
    case 'response.incomplete': {
      const status = type.split('.')[1];
      const errorMessage = data.error?.message || `Response ${status}`;
      
      await supabase.from('q_pending_responses')
        .update({
          status,
          error: errorMessage,
          error_code: data.error?.code || null,
          completed_at: now,
          webhook_event_id: eventId,
        })
        .eq('row_id', pendingResponse.row_id);
      
      // Mark trace as failed
      if (pendingResponse.trace_id) {
        await supabase.from('q_execution_traces')
          .update({
            status: 'failed',
            error_summary: errorMessage,
            completed_at: now,
          })
          .eq('trace_id', pendingResponse.trace_id);
      }
      
      console.log('[openai-webhook] Response', status, ':', responseId);
      break;
    }
    
    default:
      console.warn('[openai-webhook] Unknown event type:', type);
  }
  
  return new Response('OK', { status: 200, headers: { 'Content-Type': 'text/plain' } });
});
```

---

### Phase 4: Config.toml Update

**File: `supabase/config.toml`**

Add after existing functions:
```toml
[functions.openai-webhook]
verify_jwt = false
```

---

### Phase 5: Frontend SSE Handler Updates (NEW - MISSING FROM ORIGINAL PLAN)

**File: `src/utils/sseStreamParser.ts`**

**Add to `SSEParseCallbacks` interface (line 3-18):**
```typescript
onLongRunningStarted?: (responseId: string, message: string) => void;
```

**Add case in `parseSSELine` switch (after line 114):**
```typescript
case 'long_running_started':
  callbacks.onLongRunningStarted?.(parsed.response_id, parsed.message);
  break;
```

**File: `src/hooks/useConversationRun.ts`**

**Add handler in `handleLine` function (after line 177, before the catch):**
```typescript
} else if (event.type === 'long_running_started') {
  // Long-running operation started - return interrupt for Realtime subscription
  result = {
    interrupted: true,
    interruptType: 'long_running',
    interruptData: {
      responseId: event.response_id,
      message: event.message,
    }
  };
  onProgress?.({ type: 'long_running_started', response_id: event.response_id, message: event.message });
  doneReceived = true;
}
```

---

### Phase 6: Realtime Subscription Hook (UNCHANGED)

**File: `src/hooks/usePendingResponseSubscription.ts`** (NEW)

As specified in original plan - already correctly typed.

---

### Phase 7: Edge Function Modifications

**File: `supabase/functions/conversation-run/index.ts`**

Add helper function near top (after imports):
```typescript
// Detect if operation will likely exceed edge function timeout
function isLongRunningOperation(
  model: string | undefined,
  reasoningEffort: string | undefined,
  toolCount: number
): boolean {
  // GPT-5 with high reasoning effort is known to take 5+ minutes
  if (model?.includes('gpt-5') && reasoningEffort === 'high') {
    return true;
  }
  // GPT-5 with many tools can also be slow
  if (model?.includes('gpt-5') && toolCount > 5) {
    return true;
  }
  return false;
}
```

Add webhook mode detection after background request creation (~line 1100):
```typescript
// Detect if this will be a long-running operation
const toolCount = (tools || []).length;
if (isLongRunningOperation(selectedModel, apiOptions.reasoning_effort, toolCount) && background) {
  // Check if webhook is configured
  const webhookSecret = Deno.env.get('OPENAI_WEBHOOK_SECRET');
  
  if (webhookSecret) {
    // Create pending response record for webhook tracking
    const { error: insertError } = await supabase
      .from('q_pending_responses')
      .insert({
        response_id: responseId,
        owner_id: userId,
        prompt_row_id: promptRowId,
        thread_row_id: activeThreadRowId,
        trace_id: traceId,
        source_function: 'conversation-run',
        model: selectedModel,
        reasoning_effort: apiOptions.reasoning_effort,
      });
    
    if (!insertError) {
      // Return immediately - webhook will deliver result
      emitter.emit({
        type: 'long_running_started',
        response_id: responseId,
        message: 'Complex request submitted. Processing in background - you will be notified when complete.',
      });
      emitter.emit({ type: 'output_text_done', text: '', item_id: 'long_running_placeholder' });
      emitter.close();
      
      return; // Exit early - no polling needed
    } else {
      console.warn('Failed to create pending response, falling back to polling:', insertError);
    }
  }
}
```

**File: `supabase/functions/prompt-family-chat/index.ts`**

Apply same pattern after response creation (before polling fallback).

---

## Summary of All Changes

| Phase | File | Change | Risk Level |
|-------|------|--------|------------|
| 1 | `prompt-family-chat/index.ts` | Add `output_text_done` emission | LOW |
| 2 | SQL Migration | Create `q_pending_responses` table + cleanup functions | LOW |
| 3 | `openai-webhook/index.ts` | NEW: Handle OpenAI webhook events | MEDIUM |
| 4 | `config.toml` | Add webhook function config | LOW |
| 5 | `sseStreamParser.ts` | Add `long_running_started` handler | LOW |
| 5 | `useConversationRun.ts` | Add `long_running_started` handler | LOW |
| 6 | `usePendingResponseSubscription.ts` | NEW: Realtime subscription hook | LOW |
| 7 | `conversation-run/index.ts` | Add webhook mode detection | MEDIUM |
| 7 | `prompt-family-chat/index.ts` | Add webhook mode detection | MEDIUM |

---

## User Configuration Required

1. **OpenAI Dashboard**: Register webhook URL `https://edxkisyskfazjmqpburj.supabase.co/functions/v1/openai-webhook`
2. **Supabase Secrets**: Add `OPENAI_WEBHOOK_SECRET` with signing secret from OpenAI

---

## Pre-existing Issues NOT Addressed

1. `useManusTaskSubscription.ts` is JavaScript (not TypeScript)
2. `tsconfig.json` build error (TS6310) - platform constraint
3. Tool loop duplicate emission risk in `prompt-family-chat`

