

## Adversarial Implementation Audit Report

---

### Files Changed

1. `src/hooks/useCascadeExecutor.ts`
2. `supabase/functions/openai-webhook/index.ts`
3. `supabase/functions/poll-openai-response/index.ts`
4. `CLAUDE.md`

---

### Per-File Analysis

#### 1. `src/hooks/useCascadeExecutor.ts`

**Description of changes:**
- Added `BackgroundWaitResult` interface (line 1711-1715)
- Typed `waitForBackgroundResponse` signature (line 1721-1726)
- Relaxed `completed` checks to accept empty `output_text` (lines 1773-1774, 1798-1800, 1816-1818)
- Updated `long_running` handler in `executeCascade` with `!= null` check and DB fallback (lines 973-1021)
- Updated toast message to be model-agnostic (line 981)

**Verification status:** ❌ Bug Found

**Issues identified:**

1. **BUG — `finish` function is untyped (line 1752).** The plan required strict TypeScript typing. The `finish` callback parameter `result` has no type annotation: `const finish = (result) => {`. This is implicitly `any`, violating the strict type safety requirement. It should be `const finish = (result: BackgroundWaitResult) => {`.

2. **BUG — `executeChildCascade` falsy check NOT fixed (line 2051).** The plan's Finding 2 explicitly identified that `executeChildCascade` at line 2051 uses `success: !!result?.response` which treats empty string as failure. The revised plan stated: "Line 2034 should use `result?.response != null` for consistency." This was not implemented. The same bug also exists at line 2076: `if (result?.response)` — empty string skips the DB update for child cascades.

3. **BUG — `executeChildCascade` long_running handler NOT fixed (lines 2037-2043).** The child cascade's background handler at line 2037 calls `waitForBackgroundResponse` but does NOT use the `BackgroundWaitResult` type annotation on the variable. `const bgResult = await waitForBackgroundResponse(bgResponseId);` — this works due to inference but is inconsistent with the explicit typing at line 985 in `executeCascade`. More critically, the child handler has no DB fallback (unlike the parent handler at lines 1003-1019), meaning child cascades will still fail silently when `waitForBackgroundResponse` returns `{ response: null, success: false }`.

4. **DEFECT — Generic catch-all at line 1025 can still overwrite valid `long_running` result.** After the `long_running` handler sets `result = { response: null }` at line 1018 (fallback failure path), the code falls through to line 1025: `if (result?.interrupted)`. Since `result` was reassigned to `{ response: null }` (no `interrupted` property), this specific path is safe. However, if the `long_running` handler throws an unhandled exception, `result` retains its original `{ interrupted: true, interruptType: 'long_running' }` value, and the catch-all at 1025 would overwrite it with `{ success: false, error: 'Max questions exceeded' }` — an incorrect error message for a background mode failure. The `long_running` handler has no try-catch.

5. **WARNING — No cancellation check during background wait DB fallback.** Lines 1003-1019 perform a DB query after `waitForBackgroundResponse` fails/times out. If the user cancelled the cascade during the 10-minute wait, this fallback still executes and may update the prompt DB unnecessarily. The cancellation check only happens later at the outer loop level.

**Risk level:** High

---

#### 2. `supabase/functions/openai-webhook/index.ts`

**Description of changes:**
- Added `[DIAG]` diagnostic logging after `extractOutputText` call (lines 219-227)

**Verification status:** ⚠️ Warning

**Issues identified:**

1. **DEFECT — Redundant condition.** Line 219: `if (!outputText && type === 'response.completed')`. This code is inside `case 'response.completed':` (line 215), so `type === 'response.completed'` is always true. The check is harmless but indicates the implementation was not reviewed for context.

**Risk level:** Low

---

#### 3. `supabase/functions/poll-openai-response/index.ts`

**Description of changes:**
- Added `[DIAG]` diagnostic logging after `extractContent` call (lines 191-198)

**Verification status:** ⚠️ Warning

**Issues identified:**

1. **Verified:** `responseId` variable is in scope (declared at line 114 as `const responseId: unknown = body?.response_id`, narrowed to `string` by the guard at line 116). The diagnostic log at line 193 correctly references it. However, the TypeScript type at that point is `unknown` even though the guard narrows it. The `.map()` call inside the log uses the typed `OpenAIResponseOutput` — correct.

2. **NOTE — Pre-existing diagnostic log duplication.** The original code already had a nearly identical diagnostic block at lines 200 (the `console.log` for status). The new `[DIAG]` block (lines 191-198) adds more detail but the structure overlaps with the pre-existing block that was already in the file before this implementation. This is not a bug but worth noting.

**Risk level:** Low

---

#### 4. `CLAUDE.md`

**Description of changes:**
- Extended line 191 to document that background wait results never include usage/token data and that `poll-openai-response` acts as a synthetic webhook
- Added `openai-webhook` idempotency note at line 378
- Added `poll-openai-response` documentation entry at line 407

**Verification status:** ✅ Correct

**Issues identified:** None. Documentation accurately reflects the implemented behaviour.

**Risk level:** Low

---

### Bugs Found

1. **`src/hooks/useCascadeExecutor.ts`, line 1752:** `finish` callback parameter `result` is untyped (`any`). Plan required `BackgroundWaitResult` type annotation.

2. **`src/hooks/useCascadeExecutor.ts`, line 2051:** `success: !!result?.response` in `executeChildCascade` treats empty string as failure. Plan Finding 2 required this to be `result?.response != null`. Not implemented.

3. **`src/hooks/useCascadeExecutor.ts`, line 2076:** `if (result?.response)` in `executeChildCascade` skips DB update for empty-string responses. Same falsy bug as #2.

4. **`src/hooks/useCascadeExecutor.ts`, lines 2037-2043:** `executeChildCascade` background handler lacks DB fallback that was added to `executeCascade` (lines 1003-1019). Child cascades with empty background responses will silently fail.

5. **`src/hooks/useCascadeExecutor.ts`, lines 973-1021:** No try-catch around the `long_running` handler body. If `waitForBackgroundResponse` or the DB fallback throws, the generic catch-all at line 1025 produces the misleading error "Max questions exceeded".

6. **`supabase/functions/openai-webhook/index.ts`, line 219:** Redundant `type === 'response.completed'` check inside `case 'response.completed':` block.

---

### Critical Risks

1. **HIGH — Child cascade background mode still broken.** Bug #2/#3/#4 mean that `executeChildCascade` has the same class of bugs that were fixed in `executeCascade`. Any child prompt using GPT-5 background mode that returns an empty `output_text` will be marked as failed, skip DB update, and cascade will continue with incorrect state. This is the same failure mode the user reported, just in a different code path.

2. **MEDIUM — Missing exception handling in long_running handler.** If the Supabase query at line 1004 throws (network error, auth expiry), the error propagates uncaught through the question loop, hits the generic catch-all at line 1025, and produces the misleading "Max questions exceeded" error rather than a background-mode-specific error.

---

### Unintended Changes

None detected. All changes are within the scope of the approved plan's 3 files plus CLAUDE.md documentation.

---

### Omissions

1. **Plan Change 2 (child cascade consistency):** The revised plan explicitly stated in Finding 2: "Line 2034 should use `result?.response != null` for consistency." This was not implemented. The `executeChildCascade` path was not modified at all.

2. **Plan Change 1 (type safety):** The `finish` function's `result` parameter was not typed. The plan required `BackgroundWaitResult` type on all relevant variables.

3. **No try-catch:** The plan did not specify exception handling for the `long_running` block, but the adversarial audit standard requires identifying this as an omission given the misleading error message it produces.

---

### Architectural Deviations

None detected. All changes use existing patterns (Supabase client, toast, existing helper functions).

---

### Summary

The implementation correctly addresses the primary `executeCascade` path: the `long_running` handler, relaxed completion checks, `!= null` condition, DB fallback, and diagnostic logging are all correctly implemented for the parent cascade.

However, the `executeChildCascade` path was left untouched despite the plan explicitly calling out the same bugs there (Finding 2). This means child cascades using GPT-5 background mode remain broken with the identical failure pattern. The `finish` function also lacks the required type annotation.

**Recommendation: Progression is BLOCKED** until bugs #1-#5 are remediated.

---

### Remediation Plan

**File: `src/hooks/useCascadeExecutor.ts`** — 4 changes

**Step 1:** Type the `finish` callback parameter (line 1752):
```typescript
const finish = (result: BackgroundWaitResult) => {
```

**Step 2:** Fix `executeChildCascade` success check (line 2051):
```typescript
success: result?.response != null,
```

**Step 3:** Fix `executeChildCascade` DB update guard (line 2076):
```typescript
if (result?.response != null) {
```

**Step 4:** Add DB fallback to `executeChildCascade` background handler (replace lines 2039-2043):
```typescript
              const bgResult: BackgroundWaitResult = await waitForBackgroundResponse(bgResponseId);

              if (bgResult.success && bgResult.response != null) {
                result = {
                  response: bgResult.response,
                  response_id: bgResult.response_id || bgResponseId,
                };
              } else {
                // Fallback: check if webhook/poll already updated the prompt directly
                const { data: freshChild } = await supabaseClient
                  .from(import.meta.env.VITE_PROMPTS_TBL)
                  .select('output_response')
                  .eq('row_id', childPrompt.row_id)
                  .maybeSingle();

                if (freshChild?.output_response != null && freshChild.output_response !== '') {
                  console.log('executeChildCascade: Recovered response from prompt DB fallback');
                  result = {
                    response: freshChild.output_response,
                    response_id: bgResponseId,
                  };
                } else {
                  console.error('executeChildCascade: Background response failed and no DB fallback available');
                  result = { response: null };
                }
              }
```

**Step 5:** Wrap the `long_running` handler body in try-catch (lines 979-1021 in `executeCascade`):
```typescript
} else {
  try {
    toast.info(...);
    const bgResult: BackgroundWaitResult = await waitForBackgroundResponse(bgResponseId);
    // ... existing logic ...
  } catch (bgError) {
    console.error('executeCascade: Background wait error:', bgError);
    result = { response: null };
  }
}
```

**Step 6 (optional):** Remove redundant `type === 'response.completed'` from `openai-webhook/index.ts` line 219. Change to `if (!outputText) {`.

**No database, edge function logic, or architectural changes required.**

