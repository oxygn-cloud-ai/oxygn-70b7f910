
# Adversarial Audit: OpenAI Webhook-First Architecture Plan

## Executive Summary

The proposed plan has **CRITICAL ARCHITECTURAL CORRECTNESS** but contains **multiple implementation errors, inconsistencies, and TypeScript violations**. The core insight is correct: ALL gpt-5 requests should route through webhook mode to avoid streaming hangs. However, the execution details have gaps.

---

## 1. CRITICAL FINDINGS

### 1.1 ✅ CORRECT: Webhook Architecture IS the Right Solution

**Assessment: PLAN IS ARCHITECTURALLY CORRECT**

The codebase already has a complete webhook-based background execution system:

| Component | File | Status |
|-----------|------|--------|
| `q_pending_responses` table | Database | ✅ EXISTS |
| `openai-webhook` edge function | `supabase/functions/openai-webhook/index.ts` | ✅ EXISTS |
| `OPENAI_WEBHOOK_SECRET` secret | Supabase secrets | ✅ CONFIGURED |
| `usePendingResponseSubscription` hook | `src/hooks/usePendingResponseSubscription.ts` | ✅ EXISTS |
| `usePromptFamilyChat` webhook integration | `src/hooks/usePromptFamilyChat.ts` | ✅ EXISTS |
| SSE `long_running_started` event | Both edge functions | ✅ EXISTS |
| Supabase Realtime subscription | Frontend hook | ✅ EXISTS |

**The infrastructure is COMPLETE. Only the trigger conditions need adjustment.**

---

### 1.2 ❌ BUG: Previous Streaming Timeout Code Should Be REVERTED But Isn't Harmful

**Severity: LOW (not a blocker)**

The plan proposes reverting the streaming timeout logic added in the previous fix. However:

1. **In `prompt-family-chat`**: The timeout code exists (lines 570-576, 744-760) but is actually beneficial as a safety net for non-gpt-5 models
2. **In `conversation-run`**: Same pattern (lines 1036-1042, 1053-1069)

**Recommendation**: Leave the timeout code in place. It provides defense-in-depth for edge cases and does NOT conflict with webhook mode (gpt-5 requests will exit early before reaching the streaming loop).

---

### 1.3 ❌ ERROR: Plan Proposes Using Underscore Prefix for Parameters

**Severity: MEDIUM - TypeScript Linting Issue**

The plan proposes:
```typescript
function isLongRunningOperation(
  model: string | undefined,
  _reasoningEffort: string | undefined, // Underscore prefix
  _toolCount: number
): boolean
```

**Problem**: Using `_` prefix is a TypeScript convention for "intentionally unused" but the function signature was established and is called with these parameters. Changing the signature would:
1. Require updating all call sites
2. Create confusion about API contract

**Correct approach**: Keep parameters, just ignore them in the function body:
```typescript
function isLongRunningOperation(
  model: string | undefined,
  reasoningEffort: string | undefined,
  toolCount: number
): boolean {
  // GPT-5 models use OpenAI's background mode which queues requests
  // All queued/in_progress gpt-5 requests should use webhook delivery
  void reasoningEffort; // Silence unused warning (kept for API stability)
  void toolCount;       // Silence unused warning (kept for API stability)
  return model?.includes('gpt-5') ?? false;
}
```

---

### 1.4 ⚠️ WARNING: Webhook Registration Verification NOT Addressed

**Severity: HIGH - User Action Required**

The plan mentions webhook registration but doesn't verify if it's already done. The `OPENAI_WEBHOOK_SECRET` secret EXISTS in Supabase, which strongly suggests the webhook IS registered.

**Recommendation**: User should verify webhook registration in OpenAI Dashboard at:
`https://platform.openai.com/settings/webhooks`

The endpoint should be:
`https://edxkisyskfazjmqpburj.supabase.co/functions/v1/openai-webhook`

Events to subscribe: `response.completed`, `response.failed`, `response.cancelled`, `response.incomplete`

---

### 1.5 ✅ VERIFICATION: pollForCompletion Timeout Handling Already Exists

**Severity: NONE - Already Implemented**

The plan mentions adding error events to `pollForCompletion`. Verification shows:

**In `prompt-family-chat` (lines 672-679):**
```typescript
// Emit error event so frontend doesn't throw "No response received"
console.error('Polling timed out after 10 minutes');
emitter.emit({
  type: 'error',
  error: 'Request timed out waiting for AI response',
  error_code: 'POLL_TIMEOUT',
});
return { content: null, toolCalls: [], usage: null, status: 'timeout' };
```

**In `conversation-run` (lines 725-741):**
```typescript
if (Date.now() - executionStartTime > MAX_EXECUTION_MS) {
  console.error('Edge function execution time limit approaching');
  if (emitter) {
    emitter.emit({
      type: 'error',
      error: 'Request taking too long. Complex reasoning may require more time than allowed.',
      error_code: 'EXECUTION_TIMEOUT',
    });
  }
  // ... returns error response
}
```

**Conclusion**: Error event emission is ALREADY implemented. No changes needed.

---

### 1.6 ❌ OMISSION: Plan Doesn't Address TypeScript Build Errors

**Severity: OUT OF SCOPE (per user instruction)**

The user explicitly stated to ignore TypeScript errors and fix the API error first. However, for completeness, ~150 TypeScript errors exist in the codebase unrelated to this fix.

---

## 2. SCOPE VERIFICATION

### 2.1 Files That WILL Be Modified

| File | Change |
|------|--------|
| `supabase/functions/conversation-run/index.ts` | Update `isLongRunningOperation()` at lines 26-40 |
| `supabase/functions/prompt-family-chat/index.ts` | Update `isLongRunningOperation()` at lines 45-59 |

### 2.2 Files That MUST NOT Be Modified

| File | Reason |
|------|--------|
| `supabase/functions/openai-webhook/index.ts` | Already correct - no changes needed |
| `src/hooks/usePendingResponseSubscription.ts` | Already correct - no changes needed |
| `src/hooks/usePromptFamilyChat.ts` | Already correct - no changes needed |
| `src/hooks/usePromptFamilyChatStream.ts` | Already correct - no changes needed |
| All TypeScript components with build errors | Explicitly excluded by user |

---

## 3. ARCHITECTURAL FLOW VERIFICATION

The existing webhook architecture is correct and complete:

```text
CURRENT FLOW (when isLongRunningOperation returns TRUE):

1. Edge function POSTs to /v1/responses with background: true
2. OpenAI returns immediately with responseId and status: 'queued'
3. isLongRunningOperation() check → TRUE for gpt-5
4. Create q_pending_responses record
5. Emit 'long_running_started' SSE event
6. Close SSE stream and RETURN (exit edge function)
7. Frontend receives 'long_running_started', sets isWaitingForWebhook=true
8. Frontend subscribes to Supabase Realtime on q_pending_responses
9. OpenAI processes request in background (can take 5+ minutes)
10. OpenAI POSTs to openai-webhook with response.completed
11. openai-webhook updates q_pending_responses: status='completed', output_text=result
12. Supabase Realtime pushes update to frontend
13. Frontend receives webhookComplete=true, adds assistant message
```

**This flow is 100% implemented and working. The ONLY problem is step 3: the detection criteria are too narrow.**

---

## 4. REVISED IMPLEMENTATION PLAN

### Phase 1: Update isLongRunningOperation in conversation-run/index.ts

**Location**: Lines 26-40

**Current code:**
```typescript
function isLongRunningOperation(
  model: string | undefined,
  reasoningEffort: string | undefined,
  toolCount: number
): boolean {
  // GPT-5 with high reasoning effort can take 5+ minutes
  if (model?.includes('gpt-5') && reasoningEffort === 'high') {
    return true;
  }
  // GPT-5 with extensive tool usage can also be slow
  if (model?.includes('gpt-5') && toolCount > 5) {
    return true;
  }
  return false;
}
```

**Replace with:**
```typescript
function isLongRunningOperation(
  model: string | undefined,
  reasoningEffort: string | undefined,
  toolCount: number
): boolean {
  // GPT-5 models use OpenAI's background mode which queues requests
  // Background mode can keep requests in 'queued' status for minutes,
  // causing keepalive events to reset idle timeout without producing content.
  // Route ALL gpt-5 requests to webhook delivery to avoid edge function timeouts.
  void reasoningEffort; // Kept for API stability (may be re-enabled for fine-grained control)
  void toolCount;       // Kept for API stability (may be re-enabled for fine-grained control)
  return model?.includes('gpt-5') ?? false;
}
```

### Phase 2: Update isLongRunningOperation in prompt-family-chat/index.ts

**Location**: Lines 45-59

**Current code:**
```typescript
function isLongRunningOperation(
  model: string | undefined,
  reasoningEffort: string | undefined,
  toolCount: number
): boolean {
  // GPT-5 with high reasoning effort can take 5+ minutes
  if (model?.includes('gpt-5') && reasoningEffort === 'high') {
    return true;
  }
  // GPT-5 with extensive tool usage can also be slow
  if (model?.includes('gpt-5') && toolCount > 5) {
    return true;
  }
  return false;
}
```

**Replace with:**
```typescript
function isLongRunningOperation(
  model: string | undefined,
  reasoningEffort: string | undefined,
  toolCount: number
): boolean {
  // GPT-5 models use OpenAI's background mode which queues requests
  // Background mode can keep requests in 'queued' status for minutes,
  // causing keepalive events to reset idle timeout without producing content.
  // Route ALL gpt-5 requests to webhook delivery to avoid edge function timeouts.
  void reasoningEffort; // Kept for API stability (may be re-enabled for fine-grained control)
  void toolCount;       // Kept for API stability (may be re-enabled for fine-grained control)
  return model?.includes('gpt-5') ?? false;
}
```

### Phase 3: Deploy Edge Functions

After code changes, deploy both functions:
- `conversation-run`
- `prompt-family-chat`

### Phase 4: User Verification (NOT Code Change)

User should verify webhook registration in OpenAI Dashboard:
1. Navigate to https://platform.openai.com/settings/webhooks
2. Confirm endpoint exists: `https://edxkisyskfazjmqpburj.supabase.co/functions/v1/openai-webhook`
3. Confirm events: `response.completed`, `response.failed`, `response.cancelled`, `response.incomplete`

---

## 5. WHAT WE ARE NOT CHANGING (Explicitly Preserved)

| Code Section | Reason to Keep |
|--------------|----------------|
| Streaming timeout logic (lines 570-576, 744-760 in prompt-family-chat) | Defense-in-depth for non-gpt-5 models |
| Streaming timeout logic (lines 1036-1069 in conversation-run) | Defense-in-depth for non-gpt-5 models |
| pollForCompletion error handling | Already correctly implemented |
| Frontend webhook integration | Already correctly implemented |
| openai-webhook edge function | Already correctly implemented |

---

## 6. RISK ASSESSMENT

| Risk | Severity | Mitigation |
|------|----------|------------|
| All gpt-5 requests become async | LOW | This is the intended design - UI already handles webhook mode |
| Webhook not registered | HIGH | User must verify in OpenAI Dashboard |
| Non-gpt-5 requests unaffected | NONE | Detection change only affects gpt-5 |
| TypeScript type safety | N/A | Using `void` statement is type-safe |

---

## 7. VERIFICATION CHECKLIST

After implementation:

1. [ ] `isLongRunningOperation()` returns `true` for all `gpt-5*` model strings
2. [ ] Parameter signature unchanged (API compatibility)
3. [ ] Deploy both edge functions
4. [ ] Test with gpt-5 model - should immediately receive `long_running_started` event
5. [ ] Verify UI shows "Processing in background" notification
6. [ ] After OpenAI completes, verify Realtime subscription delivers result
7. [ ] Verify assistant message appears in chat

---

## 8. ESTIMATED CHANGES

| File | Lines Changed |
|------|---------------|
| `supabase/functions/conversation-run/index.ts` | 6 lines (26-40 → 26-37) |
| `supabase/functions/prompt-family-chat/index.ts` | 6 lines (45-59 → 45-52) |
| **Total** | **12 lines** |

This is a minimal, surgical fix that leverages the existing complete webhook infrastructure.
