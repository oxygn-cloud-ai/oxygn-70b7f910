

## Adversarial Audit: Complete End-to-End Fix for Auto-Run Children

### Audit Findings

---

### FINDING 1 (CRITICAL - BLOCKS ALL POLLING): `usage` column does not exist

**Location:** `src/hooks/useCascadeExecutor.ts` lines 1684, 1694, 1715

The `waitForBackgroundResponse` helper queries:
```sql
SELECT status, output_text, error, usage FROM q_pending_responses
```

The `q_pending_responses` table has NO `usage` column (confirmed by schema and 30+ HTTP 400 errors in network logs). Every poll returns a 400 error, `data` is `null`, the loop continues for 10 minutes, then times out.

Additionally, lines 1694 and 1715 return `usage: data.usage` and `usage: pollData.usage` -- both are undefined references. The `poll-openai-response` edge function returns `{ status, reasoning_text, output_text }` with no `usage` field either.

The return type of `waitForBackgroundResponse` includes `usage?: any` which propagates to line 1918 (`usage: bgResult.usage`) and then to `completeSpan` at line 1941 where it attempts to destructure `result.usage.input_tokens`. Since `usage` is always `undefined`, this won't crash (the ternary `result?.usage ? {...} : undefined` guards it), but it is misleading dead code.

**Fix:** Remove `usage` from the `.select()` query, from all return objects, and from the function's return shape.

---

### FINDING 2 (CRITICAL - ORDERING BUG): DB fallback uses wrong sort column

**Location:** `src/pages/MainLayout.tsx` lines 493 and 1018

Both auto-run DB fallback queries use:
```typescript
.order('position', { ascending: true })
```

The entire codebase uses `position_lex` for ordering (85 occurrences across 11 files; `fetchCascadeHierarchy` at line 381 in the same file uses `position_lex`). The `position` column is a legacy integer field that may be `null` for newly created children (the action executors only set `position_lex`). This means children fetched via the DB fallback could be returned in wrong order or with unpredictable nulls-first/last behavior.

**Fix:** Change `.order('position', { ascending: true })` to `.order('position_lex', { ascending: true })` in both locations.

---

### FINDING 3 (MEDIUM - NO CASCADE CONTEXT): `executeChildCascade` called without `startCascade`/`completeCascade`

**Location:** `src/pages/MainLayout.tsx` lines 500 and 1028

When `executeChildCascade` is called from the webhook effect (line 500) or inline flow (line 1028), neither caller invokes `startCascade()` beforehand or `completeCascade()` afterward. This means:

1. `updateProgress()` at line 1830 in the executor sets state that has no visible UI representation (no `CascadeRunProgress` panel shown because `isRunning` is `false`)
2. `isCancelled()` reads `cancelRef.current` which is `false` by default -- this happens to work, but the cascade cannot be cancelled by the user because the cancel button only appears when `isRunning` is `true`
3. `checkPaused()` similarly works by accident but pause is invisible

**Risk assessment:** This does NOT block execution -- `isCancelled()` returns `false` and `waitWhilePaused()` returns `true` by default. However, the user gets no progress feedback and no cancel capability during potentially long-running child cascades.

**Fix:** Wrap `executeChildCascade` in both flows with `startCascade(1, childrenToRun.length, 0)` before and `completeCascade()` after (in a finally block). This provides progress UI and cancel capability.

---

### FINDING 4 (MEDIUM - TYPE SAFETY): File uses `@ts-nocheck`

**Location:** `src/hooks/useCascadeExecutor.ts` line 1, `src/pages/MainLayout.tsx` line 1

Both files use `// @ts-nocheck`. The user's instructions require strict type safety for all new and amended files. However, adding types to `waitForBackgroundResponse` alone while the entire 2085-line file is `@ts-nocheck` is impractical and would require retyping the entire file -- far beyond the scope of this fix.

**Pragmatic fix:** Add explicit TypeScript-style type annotations to the new `waitForBackgroundResponse` function signature via JSDoc comments so intent is documented, even though the compiler won't enforce them. This is consistent with the existing pattern in the file (e.g., `ManusError` class has no type annotations but is functional). Do NOT remove `@ts-nocheck` from either file as that would require massive unrelated changes.

---

### FINDING 5 (LOW - DEAD CODE): `bgResult.usage` propagated but always undefined

**Location:** `src/hooks/useCascadeExecutor.ts` lines 1916-1920

The result override after background wait:
```typescript
result = {
  response: bgResult.response,
  usage: bgResult.usage,      // always undefined
  response_id: bgResult.response_id,
};
```

Then at line 1941, `completeSpan` checks `result?.usage` which is `undefined`, so `usage_tokens` is `undefined`. This is harmless but misleading.

**Fix:** Remove `usage` from the result override since it's never populated.

---

### FINDING 6 (LOW - RECURSIVE PATH NOT FIXED): Recursive grandchild auto-cascade still uses `children.length` check

**Location:** `src/hooks/useCascadeExecutor.ts` line 1996

```typescript
if (actionResult.success && actionResult.children?.length > 0) {
```

This is the recursive auto-cascade path inside `executeChildCascade` itself. It does NOT have the `createdCount` fallback or DB fetch that was added to `MainLayout.tsx`. If the executor creates grandchildren but `actionResult.children` is empty (same bug that triggered the DB fallback fix), the recursive cascade won't trigger.

**Fix:** Apply the same `createdCount > 0` check with DB fallback pattern here, matching what was done in `MainLayout.tsx`.

---

### FINDING 7 (TRIVIAL - ARCHITECTURAL DEVIATION): Realtime vs polling approach

The plan proposes replacing the sleep-loop with Realtime + polling (matching `usePendingResponseSubscription`). However, `waitForBackgroundResponse` is called inside a sequential `for` loop within a `useCallback`. Using `supabaseClient.channel()` inside a non-React function that runs in a loop is architecturally different from the hook pattern in `usePendingResponseSubscription`. This is acceptable because:

- The Manus task execution at line 177 already uses the exact same pattern (Realtime channel + poll interval + timeout inside a Promise within a `useCallback`)
- Proper cleanup (channel unsubscribe, interval clear) must be guaranteed on all exit paths

The Realtime approach is validated by the existing `runManusTask` pattern. No deviation.

---

### FINDING 8 (TRIVIAL - TOAST SPAM): Success toast fires even for failed children

**Location:** `src/hooks/useCascadeExecutor.ts` line 2025

```typescript
toast.success(`Auto-run: ${childPrompt.prompt_name}`, {
```

This toast fires AFTER the try block for every child, including children where `result?.response` is falsy (success is `false`). It should be conditional on `promptResult.success`.

**Fix:** Move inside the `if (result?.response)` block or wrap in a success check.

---

### Revised Plan

**File: `src/hooks/useCascadeExecutor.ts`**

1. **Rewrite `waitForBackgroundResponse`** (lines 1660-1726):
   - Use Promise + Realtime channel + setInterval pattern (matching `runManusTask` at line 177)
   - Remove `usage` from `.select()` query -- use `'status, output_text, error'`
   - Remove `usage` from all return objects
   - Add Realtime subscription on `q_pending_responses` filtered by `response_id`
   - Add 10-second polling interval with DB check + edge function invoke
   - Add 1-second cancellation check interval
   - Add immediate initial DB check (don't wait 10 seconds)
   - Add `console.log` at every state transition for diagnostics
   - Properly clean up channel + intervals on all exit paths
   - Add JSDoc type annotations for the function signature

2. **Fix result override** (lines 1916-1920):
   - Remove `usage: bgResult.usage` from the result object

3. **Fix recursive grandchild cascade** (line 1996):
   - Change condition to `actionResult.createdCount > 0` with DB fallback (matching MainLayout pattern)
   - Use `position_lex` for ordering in the DB fallback

4. **Fix toast spam** (line 2025):
   - Make success toast conditional on `promptResult.success`

**File: `src/pages/MainLayout.tsx`**

5. **Fix DB fallback sort order** (lines 493 and 1018):
   - Change `.order('position', { ascending: true })` to `.order('position_lex', { ascending: true })`

6. **Add cascade context management** (lines 497-516 and 1022-1050):
   - Before `executeChildCascade`: call `startCascade(1, childrenToRun.length, 0)`
   - After `executeChildCascade` (in a finally block): call `completeCascade()`
   - This provides progress UI and cancel capability

**No other files are modified. No edge function changes. No database changes.**

### Summary of all 8 findings

| # | Severity | Issue | Fix |
|---|----------|-------|-----|
| 1 | CRITICAL | `usage` column doesn't exist, all polls fail with 400 | Remove from select query and returns |
| 2 | CRITICAL | DB fallback sorts by `position` (legacy) not `position_lex` | Change to `position_lex` |
| 3 | MEDIUM | No `startCascade`/`completeCascade` around child cascade | Add cascade context lifecycle |
| 4 | MEDIUM | `@ts-nocheck` prevents type safety | Add JSDoc annotations; don't remove `@ts-nocheck` |
| 5 | LOW | `usage` field propagated but always undefined | Remove from result override |
| 6 | LOW | Recursive grandchild path lacks DB fallback | Apply same `createdCount` + DB fallback |
| 7 | NONE | Realtime inside useCallback -- validated by runManusTask pattern | No change needed |
| 8 | TRIVIAL | Success toast fires for failed children | Make conditional |

