
# Adversarial Audit of Proposed OpenAI Streaming Timeout Fix

## Executive Summary

The proposed plan contains **critical omissions, scope gaps, and lacks TypeScript strict type safety**. The plan correctly identifies the root cause (keepalive events resetting idle timeout) but fails to address parallel code paths, lacks precise implementation details, and does not follow existing architectural patterns.

---

## 1. CRITICAL FINDINGS

### 1.1 OMISSION: `prompt-family-chat` Has IDENTICAL Vulnerability (NOT Addressed)

**Severity: CRITICAL**

The plan only targets `conversation-run/index.ts`, but `prompt-family-chat/index.ts` has the **exact same streaming vulnerability**:

| Aspect | `conversation-run` | `prompt-family-chat` |
|--------|-------------------|---------------------|
| Idle timeout | 90 seconds (line 705) | **5 minutes** (line 565) |
| Execution time check | Only in `pollForCompletion()` | **NONE** |
| Streaming loop protection | **NONE** | **NONE** |

The user's error originated from `usePromptFamilyChatStream.ts` calling `prompt-family-chat`, NOT `conversation-run`. The plan fixes the wrong file.

**Remediation**: Apply identical fixes to BOTH edge functions.

---

### 1.2 OMISSION: `executionStartTime` Not Accessible in Streaming Loop

**Severity: HIGH**

The plan proposes using `executionStartTime` inside the streaming loop (line ~1050), but this variable is defined inside `runResponsesAPI()` (line 711), NOT in the function scope where the streaming loop exists.

**Current structure:**
```text
runResponsesAPI():
  Line 711: const executionStartTime = Date.now();
  Line 714: const pollForCompletion = async () => { ... }
  Line 961: const resetIdleTimeout = () => { ... }
  Line 1040: while (true) { ... } // Streaming loop
```

The streaming loop is inside `runResponsesAPI`, so `executionStartTime` IS accessible. However, the plan's line references are INCORRECT - the streaming loop starts at line 1041, not 1050.

**Remediation**: Correct line references in plan.

---

### 1.3 OMISSION: Missing Variable Declaration for `lastContentTime`

**Severity: HIGH**

The plan proposes:
```typescript
lastContentTime = Date.now(); // NEW: Track real content arrival
```

But `lastContentTime` is never declared with `let` or `const`. This is a **syntax error**.

**Remediation**: Add declaration:
```typescript
let lastContentTime = Date.now(); // Add near line 1038
```

---

### 1.4 BUG: Plan Uses Wrong Threshold Logic

**Severity: MEDIUM**

The plan proposes:
```typescript
if (accumulatedText.length === 0 && now - lastContentTime > NO_CONTENT_FALLBACK_MS)
```

**Problem**: If the stream receives one character of text at minute 0, then only keepalives for 3 minutes, this check will NEVER trigger because `accumulatedText.length > 0`.

**Correct logic should be**:
```typescript
// Track when text length last CHANGED (not just when it was non-zero)
const previousTextLength = accumulatedTextLengthRef;
accumulatedTextLengthRef = accumulatedText.length;
if (accumulatedText.length > previousTextLength) {
  lastContentTime = now;
}

// Then check for no-progress condition
if (now - lastContentTime > NO_CONTENT_FALLBACK_MS) {
  // Fall back to polling
}
```

**Remediation**: Use progress-based detection, not empty-content detection.

---

### 1.5 MISSING: TypeScript Strict Type Annotations

**Severity: MEDIUM**

The plan provides no TypeScript type annotations. With strict mode now enforced, all new code MUST include explicit types:

```typescript
// BAD (implicit any)
let lastContentTime = Date.now();

// GOOD (explicit type)
let lastContentTime: number = Date.now();
let accumulatedTextLengthRef: number = 0;
```

**Remediation**: Add explicit type annotations to all new variables.

---

### 1.6 DUPLICATION: Existing `pollForCompletion` Already Has Timeout Logic

**Severity: LOW**

The plan proposes adding `MAX_EXECUTION_MS` checks. This constant and logic already exist in `pollForCompletion()` (lines 725-741). The plan should REUSE this existing pattern, not duplicate it with potentially divergent values.

**Existing code (line 712):**
```typescript
const MAX_EXECUTION_MS = 270000; // 4.5 minutes max
```

**Remediation**: Reference existing constant, do not redefine.

---

### 1.7 OMISSION: Frontend Handling Not Addressed

**Severity: MEDIUM**

When the stream falls back to polling due to timeout, `pollForCompletion()` emits `output_text_done` (line 835-841). The frontend `parseSSEStream` in `useConversationRun.ts` correctly handles this event type. However, the plan does not verify this path works end-to-end.

The current error "No response received from edge function" occurs because:
1. Stream hangs with only keepalives
2. Edge function times out at 5 minutes (Supabase limit)
3. Response body closes WITHOUT emitting `[DONE]` or `complete`
4. `parseSSEStream` returns `result = null`
5. Line 382-383 throws: `if (!data) throw new Error('No response received from edge function')`

**The fix must ensure either:**
- `output_text_done` is emitted before timeout, OR
- `error` event with `EXECUTION_TIMEOUT` is emitted

**Remediation**: Add explicit `emitter.emit({ type: 'error', error: 'Execution timeout', error_code: 'EXECUTION_TIMEOUT' })` before polling fallback returns timeout.

---

## 2. SCOPE VERIFICATION

### 2.1 Files That MUST Be Modified

| File | Reason |
|------|--------|
| `supabase/functions/conversation-run/index.ts` | Add streaming loop protection |
| `supabase/functions/prompt-family-chat/index.ts` | **MISSING FROM PLAN** - Has identical vulnerability |

### 2.2 Files That MUST NOT Be Modified

| File | Reason |
|------|--------|
| `src/hooks/useConversationRun.ts` | Frontend handles events correctly; no change needed |
| `src/hooks/usePromptFamilyChatStream.ts` | Frontend handles events correctly; no change needed |
| TypeScript files with build errors | Explicitly excluded per user instruction |

---

## 3. ARCHITECTURAL COMPLIANCE

### 3.1 Pattern: Existing Timeout Fallback Architecture

The codebase already has a consistent pattern for timeout handling:

1. **Streaming path**: `while(true)` loop reading SSE events
2. **Idle timeout**: `resetIdleTimeout()` with AbortController
3. **Fallback trigger**: `if (abortReason === 'idle')` → `pollForCompletion()`
4. **Execution limit**: `MAX_EXECUTION_MS` checked in polling loop

The plan correctly follows this pattern but must extend it to the streaming loop.

### 3.2 Pattern: Error Event Emission

All error paths emit structured events:
```typescript
emitter.emit({
  type: 'error',
  error: 'Human-readable message',
  error_code: 'MACHINE_READABLE_CODE',
});
```

The plan's fallback must follow this pattern.

---

## 4. REVISED COMPLETE IMPLEMENTATION PLAN

### Phase 1: Fix `conversation-run/index.ts` (Streaming Loop Protection)

**Location**: Inside `runResponsesAPI()` function, lines 1035-1060

**Step 1.1**: Add progress tracking variables (after line 1038)
```typescript
// Progress tracking
const streamStartTime: number = Date.now();
let chunkCount: number = 0;
let lastLogTime: number = Date.now();
// NEW: Track last time actual content was received (for no-progress fallback)
let lastContentTime: number = Date.now();
let previousTextLength: number = 0;
const NO_CONTENT_FALLBACK_MS: number = 120000; // 2 minutes with no content progress
```

**Step 1.2**: Add execution time check inside streaming loop (after line 1046, before line 1047)
```typescript
const now: number = Date.now();

// Check edge function execution time limit during streaming
if (now - executionStartTime > MAX_EXECUTION_MS) {
  console.error('Edge function execution time limit approaching during stream - falling back to polling');
  if (idleTimeoutId !== null) clearTimeout(idleTimeoutId);
  reader.cancel();
  return await pollForCompletion();
}

// Check for "no content progress" condition (receiving keepalives but no text)
if (previousTextLength === accumulatedText.length && now - lastContentTime > NO_CONTENT_FALLBACK_MS) {
  console.warn('No text content progress for 2 minutes - falling back to polling');
  if (idleTimeoutId !== null) clearTimeout(idleTimeoutId);
  reader.cancel();
  return await pollForCompletion();
}
```

**Step 1.3**: Update progress tracking when content is received (after line 1153)
```typescript
if (contentItem.type === 'output_text' && contentItem.text) {
  accumulatedText = contentItem.text;
  // Track content progress for no-content fallback detection
  if (accumulatedText.length > previousTextLength) {
    lastContentTime = Date.now();
    previousTextLength = accumulatedText.length;
  }
}
```

### Phase 2: Fix `prompt-family-chat/index.ts` (CRITICAL - Missing from Original Plan)

**Location**: Inside `streamOpenAIResponse()` function, lines 560-850

**Step 2.1**: Add execution time tracking (after line 568)
```typescript
// Track execution start for edge function time limits
const executionStartTime: number = Date.now();
const MAX_EXECUTION_MS: number = 270000; // 4.5 minutes max
// Progress tracking for no-content fallback
let lastContentTime: number = Date.now();
let previousContentLength: number = 0;
const NO_CONTENT_FALLBACK_MS: number = 120000; // 2 minutes
```

**Step 2.2**: Add execution time check inside streaming loop (after line 727)
```typescript
const now: number = Date.now();

// Check edge function execution time limit during streaming
if (now - executionStartTime > MAX_EXECUTION_MS) {
  console.error('Edge function execution time limit approaching during stream');
  if (idleTimeoutId !== null) clearTimeout(idleTimeoutId);
  reader.cancel();
  return await pollForCompletion();
}

// Check for no-content-progress condition
if (accumulatedContent.length === previousContentLength && now - lastContentTime > NO_CONTENT_FALLBACK_MS) {
  console.warn('No content progress for 2 minutes - falling back to polling');
  if (idleTimeoutId !== null) clearTimeout(idleTimeoutId);
  reader.cancel();
  return await pollForCompletion();
}
```

**Step 2.3**: Update progress tracking when content is received (inside event parsing, around line 773)
```typescript
if (contentItem.type === 'output_text' && contentItem.text) {
  accumulatedContent = contentItem.text;
  // Track content progress
  if (accumulatedContent.length > previousContentLength) {
    lastContentTime = Date.now();
    previousContentLength = accumulatedContent.length;
  }
}
```

### Phase 3: Enhance `pollForCompletion` Timeout Handling

**Location**: Both edge functions

The existing `pollForCompletion` functions already have `MAX_EXECUTION_MS` checks but should ensure the frontend receives an error event before timing out.

**Step 3.1**: Verify timeout path emits error (already exists in `conversation-run` lines 727-733)

**Step 3.2**: Add same pattern to `prompt-family-chat` `pollForCompletion` (around line 660):
```typescript
// Before returning null on timeout
console.error('Polling timed out');
emitter.emit({
  type: 'error',
  error: 'Request timed out waiting for AI response',
  error_code: 'POLL_TIMEOUT',
});
return { content: null, toolCalls: [], usage: null, status: 'timeout' };
```

---

## 5. VERIFICATION CHECKLIST

After implementation, verify:

1. [ ] Both `conversation-run` and `prompt-family-chat` have execution time checks in streaming loops
2. [ ] All new variables have explicit TypeScript type annotations
3. [ ] `NO_CONTENT_FALLBACK_MS` constant is defined (not just referenced)
4. [ ] Progress tracking uses content LENGTH comparison, not just empty check
5. [ ] Frontend receives either `output_text_done` or `error` event before edge function terminates
6. [ ] No changes to files outside the two edge functions
7. [ ] Deploy both edge functions after changes

---

## 6. RISK ASSESSMENT

| Risk | Severity | Mitigation |
|------|----------|------------|
| False positive fallback during genuine long thinking | LOW | 2-minute threshold is generous; genuine reasoning produces events |
| Polling also times out | MEDIUM | Polling has 10-minute timeout with error events |
| Inconsistent behavior between edge functions | HIGH | Apply identical fixes to both functions |
| Missing TypeScript types causes build failure | MEDIUM | Add explicit type annotations to all new code |

---

## 7. ESTIMATED LINE CHANGES

| File | Lines Added | Lines Modified |
|------|-------------|----------------|
| `supabase/functions/conversation-run/index.ts` | ~15 | ~5 |
| `supabase/functions/prompt-family-chat/index.ts` | ~25 | ~10 |
| **Total** | ~40 | ~15 |

