

## Deep Adversarial Audit of Plan: `waitForBackgroundResponse` Resilience Fix

### Audit Methodology
Examined all three delivery paths (Realtime, DB poll, edge function poll), the webhook text extraction pipeline, the cascade executor's consumption of results, and the child cascade's equivalent path. Cross-referenced against actual production data for the failing prompt.

---

### Finding 1: CRITICAL — Plan Does Not Fix the Actual Root Cause (Empty Text Extraction)

**Evidence:** All three `q_pending_responses` rows for prompt `74e60cbb` show `status: completed` with `output_len: 0`. The webhook DID fire (event IDs start with `evt_`, not `poll_fallback_`). The webhook's `extractOutputText` returned empty string for all three attempts.

This means the webhook is successfully receiving the OpenAI payload, parsing it, and storing an empty string. The text extraction function only looks for `item.type === 'message'` with nested content blocks of type `output_text` or `text`. If GPT-5 returns output in a different structure (e.g., a top-level `text` item, or a `content_part` variant), the extraction silently returns `''`.

**Impact:** Even if all conditions in `waitForBackgroundResponse` are relaxed, the cascade will receive an empty string as the "response", which will still fail downstream checks (`!!result?.response` is falsy for `''`).

**The plan completely ignores this.** The webhook and poll extraction functions may need updating to handle additional GPT-5 output formats, OR diagnostic logging must be added to the webhook to capture what `data.output` actually contains when extraction yields empty string.

**Revised plan action:** Add a diagnostic guard in `extractOutputText` (webhook) that logs the raw `data.output` structure when the extracted text is empty but the response status is `completed`. This does not change behaviour but provides the data needed to identify the actual missing content type. Same for `extractContent` in `poll-openai-response`.

---

### Finding 2: CRITICAL — Plan's Change 1 Fixes `waitForBackgroundResponse` But the Caller Re-Breaks It

The plan relaxes lines 1756, 1781, 1799 so `completed` status resolves even with empty `output_text`. This means `waitForBackgroundResponse` returns `{ response: '', success: true }`.

But at **line 987** in the `long_running` handler:
```typescript
if (bgResult.success && bgResult.response) {
```
Empty string is **falsy**. This condition fails. Execution falls to `result = { response: null }` at line 1003. The fix is negated.

**Same bug exists in `executeChildCascade`** at line 2034:
```typescript
success: !!result?.response,  // '' is falsy → marked failed
```

**Revised plan action:** Line 987 must change to `bgResult.success && bgResult.response != null` (or `!== null && !== undefined`). Line 2034 should use `result?.response != null` for consistency.

---

### Finding 3: HIGH — Plan's Change 2 (DB Fallback) Is Ineffective Given Root Cause

The plan adds a DB fallback: if `waitForBackgroundResponse` fails, check `q_prompts.output_response` directly.

But the webhook already wrote empty string to `output_response` (confirmed: `output_len: 0` on the prompt row). The fallback will find `''`, which is truthy in a `if (freshPrompt?.output_response)` check... actually `''` is falsy. So the fallback will also fail.

**Revised plan action:** The DB fallback should check `freshPrompt?.output_response != null` (not truthiness) to distinguish "webhook wrote empty string" from "webhook never ran". However, this still returns empty string, which may not be useful. The real value of this fallback is for cases where the webhook updates the prompt but `q_pending_responses.output_text` is null (not empty). Keep the fallback but fix the condition.

---

### Finding 4: MEDIUM — No Type Safety (User Requirement Violation)

The user explicitly requires: "All new and amended files must be TypeScript with strict type safety."

`waitForBackgroundResponse` is entirely untyped:
- Parameters: `responseId`, `timeoutMs`, `pollIntervalMs` — all implicitly `any`
- Return type: `Promise<any>` (the `resolve` callback receives an untyped object)
- Internal variables: `subscription`, `pollTimer`, etc. — all `let x = null` with no types

The plan adds no types.

**Revised plan action:** Add an explicit return type interface and parameter types:
```typescript
interface BackgroundWaitResult {
  response: string | null;
  success: boolean;
  response_id?: string;
}
```

---

### Finding 5: LOW — Duplicate DB Update

At line 994-1001, the `long_running` handler updates `output_response` and `user_prompt_result` in the prompts table. But the webhook (line 248-254) and the poll function (line 220-231) ALREADY do this same update. This means the prompt gets updated twice (or three times) with identical data.

**Assessment:** Harmless but wasteful. The plan's rationale ("same as executeChildCascade") is valid — `executeChildCascade` also does this at line 2060-2066. The duplicate update provides a safety net in case the webhook/poll update failed, which is acceptable.

**No change needed.**

---

### Finding 6: LOW — Toast Message Hardcodes "GPT-5"

Line 981: `'Waiting for GPT-5 to complete...'` — this is model-specific. Future long-running models will show misleading text.

**Assessment:** Minor UX issue. The plan should use a generic message or reference the prompt's actual model.

**Revised plan action:** Change to `'Waiting for background processing to complete...'`

---

### Finding 7: VERIFICATION — No Architecture Divergence

- Uses existing `waitForBackgroundResponse` helper (no new abstractions)
- Uses existing `supabase.from(import.meta.env.VITE_PROMPTS_TBL)` pattern (correct)
- Uses existing `toast` import (correct)
- No new edge functions or database changes
- Follows same pattern as `executeChildCascade` (line 2009-2028)

**No divergence detected.**

---

### Finding 8: VERIFICATION — No Duplicate Capability

The `long_running` handler at line 974 is the ONLY handler for this interrupt type in `executeCascade`. The existing code at `executeChildCascade` (line 2010) handles the same interrupt type for child cascades — these are different code paths for different execution contexts. No duplication.

---

## Revised Plan

**File: `src/hooks/useCascadeExecutor.ts`** — 5 changes

### Change 1: Add `BackgroundWaitResult` type (before `waitForBackgroundResponse`, ~line 1695)

```typescript
interface BackgroundWaitResult {
  response: string | null;
  success: boolean;
  response_id?: string;
}
```

### Change 2: Type `waitForBackgroundResponse` signature (line 1704-1708)

```typescript
const waitForBackgroundResponse = async (
  responseId: string,
  timeoutMs: number = 600_000,
  pollIntervalMs: number = 10_000
): Promise<BackgroundWaitResult> => {
  return new Promise<BackgroundWaitResult>((resolve) => {
```

### Change 3: Relax completed checks in `waitForBackgroundResponse` (3 locations)

**Line 1756:** `row?.status === 'completed' && row?.output_text` →
```typescript
if (row?.status === 'completed') {
  finish({ response: row.output_text ?? '', success: true, response_id: responseId });
```

**Line 1781:** `data?.status === 'completed' && data?.output_text` →
```typescript
} else if (data?.status === 'completed') {
  console.log(`[waitForBg] DB poll: completed for ${responseId}`);
  finish({ response: data.output_text ?? '', success: true, response_id: responseId });
```

**Line 1799:** `pollData?.status === 'completed' && pollData?.output_text` →
```typescript
} else if (pollData?.status === 'completed') {
  console.log(`[waitForBg] Edge poll: completed for ${responseId}`);
  finish({ response: pollData.output_text ?? '', success: true, response_id: responseId });
```

### Change 4: Fix the caller condition and add DB fallback (lines 980-1005)

Replace the existing `long_running` handler body with:

```typescript
toast.info(`Background processing: ${prompt.prompt_name}`, {
  description: 'Waiting for background processing to complete...',
  source: 'useCascadeExecutor',
});

const bgResult: BackgroundWaitResult = await waitForBackgroundResponse(bgResponseId);

if (bgResult.success && bgResult.response != null) {
  result = {
    response: bgResult.response,
    response_id: bgResult.response_id || bgResponseId,
  };

  // Update the prompt output in DB (same as executeChildCascade)
  await supabase
    .from(import.meta.env.VITE_PROMPTS_TBL)
    .update({
      output_response: bgResult.response,
      user_prompt_result: bgResult.response,
      updated_at: new Date().toISOString(),
    })
    .eq('row_id', prompt.row_id);
} else {
  // Fallback: check if webhook/poll already updated the prompt directly
  const { data: freshPrompt } = await supabase
    .from(import.meta.env.VITE_PROMPTS_TBL)
    .select('output_response')
    .eq('row_id', prompt.row_id)
    .maybeSingle();

  if (freshPrompt?.output_response != null && freshPrompt.output_response !== '') {
    console.log('executeCascade: Recovered response from prompt DB fallback');
    result = {
      response: freshPrompt.output_response,
      response_id: bgResponseId,
    };
  } else {
    console.error('executeCascade: Background response failed and no DB fallback available');
    result = { response: null };
  }
}
```

Key differences from original plan:
- `bgResult.response != null` instead of `bgResult.response` (fixes empty-string falsy bug)
- DB fallback checks `!= null && !== ''` (excludes empty string, which is the current failure mode)
- Toast message is model-agnostic
- Uses typed `BackgroundWaitResult`

### Change 5: Add diagnostic logging to webhook extraction

**File: `supabase/functions/openai-webhook/index.ts`** — 1 change

After line 217 (`const outputText = extractOutputText(data.output);`), add:

```typescript
if (!outputText && type === 'response.completed') {
  console.warn('[openai-webhook] [DIAG] Empty output extraction for completed response:', {
    responseId,
    outputItemCount: data.output?.length ?? 0,
    outputTypes: data.output?.map((item: any) => item.type) ?? [],
    firstItemKeys: data.output?.[0] ? Object.keys(data.output[0]) : [],
    rawOutputPreview: JSON.stringify(data.output)?.substring(0, 500),
  });
}
```

**File: `supabase/functions/poll-openai-response/index.ts`** — 1 change

After line 189 (`const { reasoning, outputText } = extractContent(openaiData.output);`), add:

```typescript
if (!outputText && openaiData.status === 'completed') {
  console.warn('[poll-openai-response] [DIAG] Empty output extraction for completed response:', {
    responseId,
    outputItemCount: openaiData.output?.length ?? 0,
    outputTypes: openaiData.output?.map((item: OpenAIResponseOutput) => item.type) ?? [],
    rawOutputPreview: JSON.stringify(openaiData.output)?.substring(0, 500),
  });
}
```

---

## Scope Summary

| File | Changes | Lines affected |
|------|---------|---------------|
| `src/hooks/useCascadeExecutor.ts` | Add type, type signature, relax 3 conditions, fix caller + add fallback | ~1695, 1704-1708, 1756, 1781, 1799, 980-1005 |
| `supabase/functions/openai-webhook/index.ts` | Add diagnostic log | After line 217 |
| `supabase/functions/poll-openai-response/index.ts` | Add diagnostic log | After line 189 |

No database changes. No new files. No architectural changes.

---

## Outstanding Risk

The diagnostic logging is essential. The DB shows all 3 attempts completed with **zero bytes of output text**. Until we can see what OpenAI actually sends in `data.output`, the extraction functions may be silently dropping content. The condition fixes and DB fallback protect against timeouts and missed events, but they cannot recover content that was never extracted. If the next run still produces empty output, the diagnostic logs will reveal the actual payload structure so `extractOutputText` can be fixed.

