

# Adversarial Implementation Audit Report

## Files Changed

| File | Action |
|------|--------|
| `supabase/functions/poll-openai-response/index.ts` | Created |
| `src/hooks/usePendingResponseSubscription.ts` | Modified |
| `src/pages/MainLayout.tsx` | Modified |
| `src/components/layout/ReadingPane.tsx` | Modified |
| `src/components/content/PromptsContent.tsx` | Modified |
| `src/components/shared/ResizableOutputArea.tsx` | Modified |

---

## Per-File Analysis

### 1. `supabase/functions/poll-openai-response/index.ts` (Created)

**Description**: New edge function that polls OpenAI `GET /v1/responses/{id}`, extracts reasoning and output content, and acts as a webhook fallback by updating the database on terminal status.

**Verification**: Correct | Warning

**Issues**:

1. **No HTTP method validation (LOW)**: The function only checks for `OPTIONS`. A `GET`, `PUT`, or `DELETE` request passes through to `req.json()` which would throw on a body-less request. The outer `try/catch` catches this and returns 500, but a 405 Method Not Allowed would be more correct.

2. **`req.json()` failure returns 500 instead of 400 (LOW)**: Line 106 -- if the body is malformed JSON, the outer catch returns 500 with the parse error message. This should be a 400 Bad Request for invalid input.

3. **Webhook idempotency gap (MEDIUM)**: The poll function sets `webhook_event_id = 'poll_fallback_{response_id}'` and guards with `.eq('status', 'pending')`. However, the `openai-webhook` function (line 219-226) updates by `.eq('row_id', ...)` with NO status guard. If the poll completes first (setting status to `completed`), the webhook arrives, reads the row (now with `webhook_event_id = poll_fallback_xxx`), sees that its own `eventId` does not match `poll_fallback_xxx`, passes the idempotency check, and overwrites the row. The data is functionally equivalent (same output), so this is not a data-loss bug, but it is an unnecessary double-write and a deviation from the plan's stated idempotency guarantee.

4. **Non-completed terminal statuses mapped to `failed` (LOW)**: Line 197 -- `cancelled` and `incomplete` are both mapped to `failed` in the DB update. The webhook handles these distinctly (lines 260-300 in openai-webhook). This means the poll fallback loses status granularity compared to the webhook path. Acceptable per plan (the plan specifies this mapping), but worth noting.

**Risk Level**: Medium

---

### 2. `src/hooks/usePendingResponseSubscription.ts` (Modified)

**Description**: Added 30-second polling interval, `reasoningText` state, and increased timeout from 3 minutes to 10 minutes.

**Verification**: Correct | Warning

**Issues**:

5. **Polling starts when `pendingResponse === null` (LOW)**: Line 116 -- `const isPending = pendingResponse?.status === 'pending' || pendingResponse === null`. When the hook mounts with a valid `responseId`, `pendingResponse` is initially `null` (before the initial fetch returns). This means `isPending = true` and polling starts immediately. The poll edge function will return 404 (row not yet found if INSERT is still in flight). The error is silently swallowed (line 133-135), so no user-visible impact, but it generates unnecessary edge function invocations and 404 error logs.

6. **Polling effect dependency on `pendingResponse?.status` causes restart (LOW)**: Line 178 -- the effect depends on `pendingResponse?.status`. When the initial fetch at line 72-74 sets `pendingResponse`, the effect re-runs, cleaning up the first 5-second timeout and starting a new one. This means the first actual poll happens ~5 seconds after the initial fetch completes rather than 5 seconds after mount. This is benign but slightly inefficient (the first timeout is wasted).

7. **`clearPendingResponse` does not clear `error` state (TRIVIAL)**: Line 47-51 -- `clearPendingResponse` clears `pendingResponse`, `timedOut`, and `reasoningText` but does not clear `error`. If a fetch error occurred and the caller clears the pending response, the error state persists. This is pre-existing behavior unchanged by this implementation; noting for completeness only.

8. **Type safety is correct**: `PollResult` interface is properly defined. `supabase.functions.invoke<PollResult>` provides typed response. No `any` usage. No `@ts-nocheck`. Strict typing requirement met.

**Risk Level**: Low

---

### 3. `src/pages/MainLayout.tsx` (Modified)

**Description**: Destructured `reasoningText` as `webhookReasoningText` from `usePendingResponseSubscription` and passed it as `backgroundReasoningText` prop to `ReadingPane`.

**Verification**: Correct

**Issues**: None. Lines 292-293 correctly destructure `reasoningText` (aliased as `webhookReasoningText`). Line 1495-1496 pass `isWaitingForBackground={pendingWebhookResponseId !== null}` and `backgroundReasoningText={webhookReasoningText}`. The `@ts-nocheck` is pre-existing and not modified.

**Risk Level**: Low

---

### 4. `src/components/layout/ReadingPane.tsx` (Modified)

**Description**: Added `isWaitingForBackground` and `backgroundReasoningText` props with defaults, threaded to `PromptsContent`.

**Verification**: Correct

**Issues**: None. Props declared at lines 46-47 with correct defaults. Passed through at lines 205-206. Minimal change, correct threading.

**Risk Level**: Low

---

### 5. `src/components/content/PromptsContent.tsx` (Modified)

**Description**: Added `backgroundReasoningText` prop to both `PromptTabContent` (inner component) and the main `PromptsContent` component, threaded to `ResizableOutputArea`.

**Verification**: Correct

**Issues**: None. Line 202 adds the prop to `PromptTabContent` with default `null`. Line 251 passes it to `ResizableOutputArea`. Lines 1323-1324 add it to the main component. Line 1685 threads it down.

**Risk Level**: Low

---

### 6. `src/components/shared/ResizableOutputArea.tsx` (Modified)

**Description**: Added `Brain` icon import, `backgroundReasoningText` prop, reasoning indicator in the background processing banner, and a reasoning content display area.

**Verification**: Correct | Warning

**Issues**:

9. **Reasoning content area has hardcoded `maxHeight: '300px'` (TRIVIAL)**: Line 411 -- the reasoning display area has `style={{ maxHeight: '300px' }}`. This is a reasonable default but is not configurable and doesn't follow the existing resize pattern of the output area. Since this is a temporary display (replaced on completion), this is acceptable.

10. **Reasoning area renders outside the resizable content area (LOW)**: Lines 407-417 -- the reasoning content div is rendered as a sibling to the main content area (lines 419+), not inside it. This means the reasoning text is shown in a separate box above the output area, which is visually distinct but means the output area's collapse/expand state doesn't fully control reasoning visibility (only `!isCollapsed` is checked at line 408). When the output is collapsed, reasoning is hidden -- this is correct behavior.

11. **No auto-expand on reasoning arrival**: The plan states "Keep the output area expanded (auto-set to 'min' state if collapsed)" when reasoning text arrives. This was NOT implemented. If the user has collapsed the output area, reasoning text will be hidden until they manually expand. This is an **omission** from the plan.

**Risk Level**: Low

---

## Bugs Found

1. **BUG-1** (Medium) -- `supabase/functions/poll-openai-response/index.ts`, line 106: `req.json()` called without method validation. Non-POST requests will reach this line and throw a JSON parse error, returning 500 instead of 405.

2. **BUG-2** (Low) -- `src/hooks/usePendingResponseSubscription.ts`, line 116: `pendingResponse === null` treated as pending causes the first poll to fire before the initial DB fetch returns, resulting in a 404 from the edge function on the first poll attempt.

3. **BUG-3** (Medium) -- `supabase/functions/poll-openai-response/index.ts` + `supabase/functions/openai-webhook/index.ts`: Webhook can overwrite poll's database update because the webhook's update query (line 219-226 of openai-webhook) does not guard on `status = 'pending'`. The poll sets a synthetic `webhook_event_id`, but the webhook's idempotency check only compares its own `eventId` against the stored value, which will differ, allowing a second write.

---

## Critical Risks

1. **(MEDIUM) Double-write on completion**: If both poll and webhook detect terminal status, the row is updated twice. Data is functionally equivalent so no data loss occurs, but the `webhook_event_id` is overwritten, losing audit trail of which mechanism delivered first. **Remediation**: Add `.eq('status', 'pending')` guard to the webhook's update query in `openai-webhook/index.ts` (out of scope for this implementation but should be tracked).

2. **(LOW) Unnecessary edge function invocations**: The null-state polling (Bug-2) generates 404 responses from the edge function for the first poll attempt. At 1 extra call per background request, this is negligible but creates noise in logs. **Remediation**: Only start polling after `pendingResponse` is non-null with status `pending`.

---

## Unintended Changes

None detected. All modifications are within the approved scope. No dependencies were added, removed, or version-altered. No configuration files were modified. No database migrations were created (as specified in the plan).

---

## Omissions

1. **Auto-expand output area on reasoning arrival**: The plan explicitly states "Keep the output area expanded (auto-set to 'min' state if collapsed)" when `backgroundReasoningText` arrives. This logic was not implemented in `ResizableOutputArea.tsx`. The reasoning text is simply hidden when collapsed.

---

## Architectural Deviations

None detected. The implementation follows the existing patterns:
- Edge function uses `getCorsHeaders`, `getOpenAIApiKey`, `buildErrorResponse` from shared modules
- Authentication follows the `getUser()` + `isAllowedDomain()` pattern from `openai-proxy`
- Frontend polling uses `supabase.functions.invoke` (existing pattern)
- Prop threading through `@ts-nocheck` files follows existing conventions
- No new patterns, layers, or coupling introduced

---

## Summary

The implementation is **substantially correct** and matches the approved plan with minor deviations. Three bugs were identified: one medium-severity idempotency gap (double-write between poll and webhook), one low-severity premature polling issue, and one low-severity missing method validation. One plan omission was found (auto-expand on reasoning arrival). No critical or blocking issues were identified.

**Recommendation**: Progression is **permitted** with the following remediation items tracked for follow-up.

---

## Remediation Plan

### Step 1: Fix premature polling (Bug-2)
**File**: `src/hooks/usePendingResponseSubscription.ts`
**Change**: Line 116 -- remove `|| pendingResponse === null` from the isPending check. Change to:
```typescript
const isPending = pendingResponse?.status === 'pending';
```
This ensures polling only starts after the initial fetch confirms a pending row exists.

### Step 2: Add HTTP method validation (Bug-1)
**File**: `supabase/functions/poll-openai-response/index.ts`
**Change**: After the OPTIONS check (line 69-71), add:
```typescript
if (req.method !== 'POST') {
  return new Response(
    JSON.stringify({ error: 'Method not allowed' }),
    { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}
```

### Step 3: Implement auto-expand on reasoning arrival (Omission)
**File**: `src/components/shared/ResizableOutputArea.tsx`
**Change**: Add a `useEffect` that sets `expandState` to `'min'` when `isWaitingForBackground` is true, `backgroundReasoningText` is non-empty, and the current state is `'collapsed'`:
```typescript
useEffect(() => {
  if (isWaitingForBackground && backgroundReasoningText && expandState === 'collapsed') {
    setExpandState('min');
    setManualHeight(null);
  }
}, [isWaitingForBackground, backgroundReasoningText, expandState]);
```

### Step 4: Track webhook idempotency improvement (Bug-3)
**Scope**: Out of scope for this implementation (requires modifying `openai-webhook/index.ts` which was not in the approved plan). Should be tracked as a follow-up task. The fix is to add `.eq('status', 'pending')` to the webhook's update queries, matching the pattern used by the poll function.

