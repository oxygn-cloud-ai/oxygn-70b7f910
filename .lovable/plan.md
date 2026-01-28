
# Fix Plan: Chat Thread Not Reappearing After Login

## Root Cause
The `activeThreadIdRef` in `usePromptFamilyThreads` is updated via `useEffect`, which runs AFTER render. When `setActiveThreadId(null)` is called followed immediately by `fetchThreads()`, the ref still contains the stale value from the previous session, causing auto-selection to be skipped.

## Solution
Update `activeThreadIdRef` synchronously when `setActiveThreadId` is called, rather than relying on a delayed `useEffect`.

---

## File: `src/hooks/usePromptFamilyThreads.ts`

### Change 1: Create a wrapper function that updates both state and ref synchronously

Replace direct exposure of `setActiveThreadId` with a wrapper:

```typescript
// Around line 20, after state declarations
const [activeThreadId, setActiveThreadIdState] = useState<string | null>(null);

// Replace the ref sync effect (lines 30-32) with a synchronous setter
const setActiveThreadId = useCallback((id: string | null) => {
  activeThreadIdRef.current = id;  // Sync update FIRST
  setActiveThreadIdState(id);      // Then schedule React state update
}, []);

// REMOVE the useEffect that was syncing the ref (lines 30-32):
// useEffect(() => {
//   activeThreadIdRef.current = activeThreadId;
// }, [activeThreadId]);
```

### Change 2: Add diagnostic logging to verify the fix

Add logging in `fetchThreads` to track the auto-selection flow:

```typescript
// Around line 55, after setting threads
console.log('[PromptFamilyThreads] fetchThreads result:', {
  threadCount: data?.length || 0,
  activeThreadIdRef: activeThreadIdRef.current,
  willAutoSelect: data?.length && !activeThreadIdRef.current,
  firstThreadId: data?.[0]?.row_id,
});
```

---

## Summary of Changes

| File | Change |
|------|--------|
| `src/hooks/usePromptFamilyThreads.ts` | Replace async ref sync (useEffect) with synchronous update in setActiveThreadId wrapper |

---

## Testing After Fix

1. Log in to the app
2. Select a prompt and send a chat message
3. Log out
4. Log back in
5. Select the same prompt
6. **Expected:** Previous chat thread should appear with messages
7. Check console for `[PromptFamilyThreads] fetchThreads result:` log showing `willAutoSelect: true`

---

## Technical Notes

- The fix ensures `activeThreadIdRef.current` is always in sync with the intended state
- This pattern (sync ref + async state) is a common React optimization for refs that need to be read immediately in async operations
- No changes needed to the edge function or database - this is purely a frontend timing issue
