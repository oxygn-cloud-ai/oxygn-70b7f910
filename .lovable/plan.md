

## Adversarial Implementation Audit Report

---

### Files Changed

1. `src/hooks/useCascadeExecutor.ts`
2. `supabase/functions/openai-webhook/index.ts`

---

### Per-File Analysis

#### 1. `src/hooks/useCascadeExecutor.ts`

**Description of changes (remediation steps 1-5):**
- Step 1: Typed `finish` callback parameter as `BackgroundWaitResult` (line 1757) ✅
- Step 2: Fixed `executeChildCascade` success check to `result?.response != null` (line 2075) ✅
- Step 3: Fixed `executeChildCascade` DB update guard to `result?.response != null` (line 2100) ✅
- Step 4: Added DB fallback to `executeChildCascade` background handler (lines 2042-2067) ✅
- Step 5: Wrapped `executeCascade` `long_running` handler body in try-catch (lines 980-1025) ✅

**Verification status:** ❌ Bug Found

**Issues identified:**

1. **BUG — Parent `executeCascade` main success gate still uses falsy check (line 1057).** After the `long_running` handler sets `result = { response: '' }` (empty string from a completed-but-empty-text background response), execution proceeds to line 1057: `if (result?.response)`. Empty string is **falsy**. This skips the entire success path: `markPromptComplete` is never called, the response is not added to `accumulatedResponses`, the prompt is not stored in `promptDataMap` (breaking `q.ref[UUID]` resolution for subsequent prompts), and the span is not completed. Execution falls through to the error/failure handling. **This is the same class of falsy bug that was remediated in `executeChildCascade` but was missed in the parent cascade.** This bug was NOT identified in any prior audit and was NOT in the remediation plan scope, but it renders the entire fix chain ineffective for the parent cascade path.

2. **BUG — Child cascade `completeSpan` status uses falsy check (line 2085).** `status: result?.response ? 'success' : 'failed'` — empty string evaluates to `'failed'`. The span will be recorded as failed even though the response was successfully received. This was not identified in any prior audit.

3. **WARNING — `executeChildCascade` missing try-catch around background handler (lines 2037-2068).** The parent `executeCascade` long_running handler was wrapped in try-catch (Step 5). The child cascade's equivalent handler at lines 2037-2068 has no try-catch. If `waitForBackgroundResponse` or the DB fallback query throws, the exception propagates uncaught through `executeChildCascade`, which will crash the entire child cascade run. This is inconsistent with the parent handler's error isolation pattern.

**Risk level:** Critical (Bug #1 blocks the primary use case)

---

#### 2. `supabase/functions/openai-webhook/index.ts`

**Description of changes (remediation step 6):**
- Removed redundant `type === 'response.completed'` condition from diagnostic log (line 219)

**Verification status:** ✅ Correct

The condition now reads `if (!outputText)` inside `case 'response.completed':`. This is correct — the redundant check was removed as specified.

**Risk level:** Low

---

### Bugs Found

1. **`src/hooks/useCascadeExecutor.ts`, line 1057:** `if (result?.response)` in parent `executeCascade` treats empty string as failure. When the `long_running` handler at line 988-992 produces `result = { response: '' }`, this gate fails and the entire success path (markPromptComplete, accumulatedResponses, promptDataMap, span completion) is skipped. The prompt is effectively treated as failed despite the background response completing successfully.

2. **`src/hooks/useCascadeExecutor.ts`, line 2085:** `status: result?.response ? 'success' : 'failed'` in child `completeSpan` call treats empty string response as `'failed'`. Should be `result?.response != null ? 'success' : 'failed'`.

---

### Critical Risks

1. **CRITICAL — Parent cascade success path unreachable for empty-string background responses (Bug #1).** The remediation fixed the `long_running` handler's internal condition (line 988) and the child cascade's success check (line 2075), but the parent cascade's primary success gate at line 1057 was never touched. This means GPT-5 background responses that complete with empty `output_text` (the exact failure mode being fixed) will STILL fail in the parent cascade. The entire chain of fixes (relaxed completion checks, DB fallback, try-catch) successfully produces `result = { response: '' }`, which is then immediately discarded at line 1057. **Severity: Critical. Remediation: Change line 1057 to `if (result?.response != null)`.**

2. **MEDIUM — Child cascade background handler lacks exception isolation.** If `waitForBackgroundResponse` throws in child context, it crashes the child cascade loop without producing an error result. **Severity: Medium. Remediation: Wrap lines 2038-2068 in try-catch matching the parent pattern.**

---

### Unintended Changes

None detected. All modifications are within the scope of the approved remediation plan (Steps 1-6). No files outside the 2-file scope were modified.

---

### Omissions

1. **Parent cascade success gate (line 1057):** The remediation plan did not identify or address this falsy check. It was outside the plan scope (which focused on the `long_running` handler and `executeChildCascade`), but it is the next gate in the same execution path and renders the fix ineffective.

2. **Child cascade try-catch (lines 2037-2068):** The remediation plan specified try-catch wrapping for the parent handler (Step 5) but did not specify it for the child handler, despite both handlers performing the same operations with the same failure modes.

3. **Child span status falsy check (line 2085):** Not identified in the remediation plan.

---

### Architectural Deviations

None detected. All changes use existing patterns and conventions.

---

### Summary

The 6 remediation steps from the previous audit were all correctly implemented. However, the remediation plan itself had an omission: it did not identify the parent cascade's main success gate at line 1057, which uses the same falsy check pattern (`if (result?.response)`) that was fixed elsewhere. This gate sits directly downstream of the `long_running` handler, meaning the fix produces a correct `result = { response: '' }` that is immediately discarded.

**Recommendation: Progression is BLOCKED** until Bug #1 (line 1057) is remediated. Bug #2 (line 2085) and the missing child try-catch should be addressed simultaneously.

---

### Remediation Plan

**File: `src/hooks/useCascadeExecutor.ts`** — 3 changes

**Step 1:** Fix parent cascade success gate (line 1057):
```typescript
if (result?.response != null) {
```

**Step 2:** Fix child cascade `completeSpan` status check (line 2085):
```typescript
status: result?.response != null ? 'success' : 'failed',
```

**Step 3:** Wrap child cascade background handler in try-catch (lines 2037-2068). Replace the `else` block:
```typescript
} else {
  try {
    console.log(`executeChildCascade: Child ${childPrompt.prompt_name} went to background mode (${bgResponseId}), waiting...`);
    toast.info(`Waiting for background response: ${childPrompt.prompt_name}`);
    const bgResult: BackgroundWaitResult = await waitForBackgroundResponse(bgResponseId);
    // ... existing fallback logic unchanged ...
  } catch (bgError: unknown) {
    console.error('executeChildCascade: Background wait error:', bgError);
    result = { response: null };
  }
}
```

No other files require changes. No database, edge function, or architectural changes required.

