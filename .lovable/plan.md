
# Revised Fix Plan: Chat Thread Not Reappearing After Login

## Root Cause (Verified)
The `activeThreadIdRef` in `usePromptFamilyThreads` was updated via `useEffect`, which runs AFTER render. When the parent hook (`usePromptFamilyChat`) calls `tm.setActiveThreadId(null)` followed by `tm.fetchThreads()`, the ref still contained the stale value from the previous session, causing auto-selection to be skipped.

The actual call path is in `src/hooks/usePromptFamilyChat.ts` lines 220-230:
```typescript
tm.setActiveThreadId(null);
// ...
const autoSelectedId = await tm.fetchThreads();
```

## Solution (Verified)
The synchronous setter wrapper (already implemented) correctly updates `activeThreadIdRef.current` BEFORE the React state update, ensuring `fetchThreads()` reads the correct value.

---

## File: `src/hooks/usePromptFamilyThreads.ts`

### Change 1: Remove Redundant Ref Update in `switchThread` ✅ NEW

**Location**: Lines 140-141

**Current code**:
```typescript
// Update state immediately for responsive UI
setActiveThreadId(threadId);
activeThreadIdRef.current = threadId;  // REMOVE: redundant
```

**Change to**:
```typescript
// Update state immediately for responsive UI
setActiveThreadId(threadId);
```

**Rationale**: `setActiveThreadId` already updates `activeThreadIdRef.current` synchronously. The explicit update is redundant and creates code inconsistency.

---

### Change 2: Update Dependency Arrays for Completeness ✅ NEW

**Location**: `fetchThreads` callback (line 76)

**Current code**:
```typescript
}, [rootPromptId]);
```

**Change to**:
```typescript
}, [rootPromptId, setActiveThreadId]);
```

**Location**: `switchThread` callback (line 190)

**Current code**:
```typescript
}, []);
```

**Change to**:
```typescript
}, [setActiveThreadId]);
```

**Rationale**: Although `setActiveThreadId` is referentially stable (empty deps `useCallback`), explicit dependencies improve code clarity and satisfy strict linting rules.

---

### Change 3: Guard Diagnostic Logging for Development Only ✅ NEW

**Location**: Lines 58-64

**Current code**:
```typescript
// Diagnostic logging
console.log('[PromptFamilyThreads] fetchThreads result:', {
  threadCount: data?.length || 0,
  activeThreadIdRef: activeThreadIdRef.current,
  willAutoSelect: data?.length && !activeThreadIdRef.current,
  firstThreadId: data?.[0]?.row_id,
});
```

**Change to**:
```typescript
// Diagnostic logging (development only)
if (import.meta.env.DEV) {
  console.log('[PromptFamilyThreads] fetchThreads result:', {
    threadCount: data?.length || 0,
    willAutoSelect: data?.length && !activeThreadIdRef.current,
    firstThreadId: data?.[0]?.row_id,
  });
}
```

**Changes**:
1. Guard with `import.meta.env.DEV` to exclude from production builds
2. Remove `activeThreadIdRef: activeThreadIdRef.current` as it exposes internal state

---

### NO CHANGE NEEDED: Synchronous Setter (Already Correct)

The wrapper function (lines 29-33) is correctly implemented:
```typescript
const setActiveThreadId = useCallback((id: string | null) => {
  activeThreadIdRef.current = id;  // Sync update FIRST
  setActiveThreadIdState(id);      // Then schedule React state update
}, []);
```

---

## Summary of All Changes

| Line | Change | Rationale |
|------|--------|-----------|
| 58-64 | Guard logging with `import.meta.env.DEV`, remove internal ref logging | Production cleanliness |
| 76 | Add `setActiveThreadId` to deps | Explicit dependencies |
| 141 | Remove redundant `activeThreadIdRef.current = threadId` | Eliminate dead code |
| 190 | Add `setActiveThreadId` to deps | Explicit dependencies |

---

## Known Limitation: Rapid Prompt Switching Race Condition

**Scenario**: If user rapidly selects different prompts, auto-selection from an earlier `fetchThreads` call could apply to the wrong family.

**Current Mitigation**: The `cancelled` flag in `usePromptFamilyChat.ts` only guards message loading, not `setActiveThreadId` inside `fetchThreads`.

**Accepted Risk**: This is a low-probability edge case. Full fix would require passing a cancellation token into `fetchThreads` and checking it before auto-selection. Deferred to future iteration if user reports issue.

---

## Testing After Fix

1. Log in to the app
2. Select a prompt and send a chat message
3. Log out
4. Log back in
5. Select the same prompt
6. **Expected**: Previous chat thread should appear with messages
7. In development mode, check console for `[PromptFamilyThreads] fetchThreads result:` log showing `willAutoSelect: true`

---

## Type Safety Verification ✅

All types are correct:
- `setActiveThreadId: (id: string | null) => void` - matches interface at line 11
- `fetchThreads: () => Promise<string | null>` - matches interface at line 12
- `activeThreadIdRef: useRef<string | null>` - correct generic type at line 24

---

## Files Changed (Final)

Only `src/hooks/usePromptFamilyThreads.ts` - no other files modified.
