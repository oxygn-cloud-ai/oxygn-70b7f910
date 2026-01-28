
# Remediation Plan: Fix Audit Findings

## Issues to Address

| # | Severity | File | Issue |
|---|----------|------|-------|
| 1 | **CRITICAL** | `src/hooks/useThreads.ts` | Infinite loop risk from `activeThread` in `fetchThreads` dependency array |
| 2 | **MEDIUM** | `src/hooks/useResourceHealth.ts` | Unsafe type assertion `data as AssistantHealth` |
| 3 | **LOW** | `src/hooks/useResourceHealth.ts` | Missing `data?.error` check in `repairAssistant` |

Note: The `tsconfig.json` build error is a pre-existing issue unrelated to this implementation.

---

## Fix #1: useThreads.ts Infinite Loop (CRITICAL)

**Problem**: `fetchThreads` includes `activeThread` in its dependency array. When `fetchThreads` calls `setActiveThread`, it changes `activeThread`, which triggers `fetchThreads` again, creating an infinite loop.

**Location**: Lines 51-85 in `src/hooks/useThreads.ts`

**Solution**: Use a ref to track whether auto-selection has occurred, and remove `activeThread` from the dependency array.

```typescript
// Add new ref after isMountedRef (around line 24)
const hasAutoSelectedRef = useRef(false);

// Update fetchThreads (lines 51-85)
const fetchThreads = useCallback(async (): Promise<void> => {
  if (!supabase) return;

  try {
    const { data, error } = await supabase.functions.invoke<ThreadResponse>('thread-manager', {
      body: {
        action: 'list',
        assistant_row_id: assistantRowId,
        child_prompt_row_id: childPromptRowId,
      },
    });

    if (data?.error) throw data;
    if (error) throw error;

    if (isMountedRef.current) {
      setThreads(data?.threads || []);

      // Only auto-select on first fetch, use ref to prevent re-triggering
      if (data?.threads?.length && !hasAutoSelectedRef.current) {
        hasAutoSelectedRef.current = true;
        const active = data.threads.find(t => t.is_active);
        setActiveThread(active || data.threads[0]);
      }
    }
  } catch (error) {
    if (isMountedRef.current) {
      console.error('Error fetching threads:', error);
      const parsed = parseApiError(error);
      toast.error(parsed.title, {
        description: parsed.message,
        source: 'useThreads.fetchThreads',
        errorCode: parsed.code,
      });
    }
  } finally {
    if (isMountedRef.current) setIsLoading(false);
  }
}, [supabase, assistantRowId, childPromptRowId]); // REMOVED activeThread

// Reset auto-selection ref when assistant changes (add after existing useEffect)
useEffect(() => {
  hasAutoSelectedRef.current = false;
}, [assistantRowId, childPromptRowId]);
```

---

## Fix #2: useResourceHealth.ts Unsafe Type Assertion (MEDIUM)

**Problem**: Line 113 uses `data as AssistantHealth` without validating the response structure.

**Location**: Lines 110-115 in `src/hooks/useResourceHealth.ts`

**Solution**: Add a type guard function and use it before assignment.

```typescript
// Add type guard after interfaces (around line 45)
function isAssistantHealth(data: unknown): data is AssistantHealth {
  if (!data || typeof data !== 'object') return false;
  const obj = data as Record<string, unknown>;
  return (
    typeof obj.assistant_row_id === 'string' &&
    typeof obj.status === 'string' &&
    ['healthy', 'degraded', 'broken', 'not_configured'].includes(obj.status as string)
  );
}

// Update the checkHealth function (lines 110-115)
// BEFORE:
// const healthData = data as AssistantHealth;
// setHealth(healthData);

// AFTER:
if (isAssistantHealth(data)) {
  setHealth(data);
  setCachedHealth(assistantRowId, data);
  return data;
} else {
  console.error('[useResourceHealth] Invalid response structure:', data);
  throw new Error('Invalid health check response');
}
```

---

## Fix #3: repairAssistant Missing Error Check (LOW)

**Problem**: `repairAssistant` in `useAllResourceHealth` doesn't check `data?.error` before proceeding.

**Location**: Lines 188-206 in `src/hooks/useResourceHealth.ts`

**Solution**: Add consistent error checking.

```typescript
// Update repairAssistant function (lines 188-206)
const repairAssistant = useCallback(async (assistantRowId: string): Promise<unknown> => {
  try {
    const { data, error: invokeError } = await supabase.functions.invoke('resource-health', {
      body: {
        action: 'repair_assistant',
        assistant_row_id: assistantRowId,
      },
    });

    if (invokeError) {
      throw new Error(invokeError.message);
    }

    // ADD THIS CHECK - was missing
    if (data?.error) {
      throw new Error(data.error);
    }

    // Refresh the list after repair
    await checkAll();

    return data;
  } catch (err) {
    console.error('[useAllResourceHealth] Repair error:', err);
    throw err;
  }
}, [checkAll]);
```

---

## Files to Modify

| File | Changes |
|------|---------|
| `src/hooks/useThreads.ts` | Add `hasAutoSelectedRef`, remove `activeThread` from deps, add reset effect |
| `src/hooks/useResourceHealth.ts` | Add `isAssistantHealth` type guard, add `data?.error` check in `repairAssistant` |

---

## Verification After Fix

1. [ ] App loads without infinite loop
2. [ ] Thread auto-selection works on first load
3. [ ] Thread auto-selection doesn't re-trigger on subsequent fetches
4. [ ] Health check handles malformed responses gracefully
5. [ ] Repair errors are properly surfaced to UI
