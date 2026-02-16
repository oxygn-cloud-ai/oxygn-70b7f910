

# Revised Plan: Persist Chat Conversations Across Prompt Switches

## Problem

When switching between prompts in different families, messages disappear because `usePromptFamilyChat` has no in-memory cache. Every `rootPromptId` change triggers a full reset-and-reload cycle.

## Audit Findings Addressed

| # | Finding | Resolution |
|---|---------|------------|
| 1 | Cache `threadId` typed as `string` but value is `string \| null` | Use `string \| null` in cache type |
| 2 | No cache invalidation on `deleteThread`/`clearMessages`/`createThread` | Invalidate cache entry for current family on any mutation |
| 3 | Background refresh listed as "optional" | Make it mandatory: silently refresh from server after cache restore |
| 4 | `@ts-nocheck` on both files | Preserve existing `@ts-nocheck`; do not remove (out of scope). New code is written type-safe regardless |
| 5 | Effect ordering / snapshot timing | Document assumption: ref-sync effect (line 78) runs before consolidated effect due to declaration order |
| 6 | Raw `setThreads` exposure | Expose as `restoreThreads` (same setter, renamed in return interface) |
| 7 | Unbounded cache growth | Cap cache at 20 entries (LRU eviction) |
| 8 | Loading state flash on background refresh | Use a silent refresh path that does NOT set `isLoading` |

## Solution

### File 1: `src/hooks/usePromptFamilyChat.ts`

**Change 1 — Add cache type and ref (after line 11)**

```typescript
interface FamilyCacheEntry {
  threadId: string | null;
  messages: ChatMessage[];
  threads: ChatThread[];
}
```

**Change 2 — Add cache ref, previous root ref, and eviction helper (after line 53)**

```typescript
const familyCacheRef = useRef<Map<string, FamilyCacheEntry>>(new Map());
const previousRootRef = useRef<string | null>(null);
const MAX_CACHE_ENTRIES = 20;
```

**Change 3 — Add cache invalidation helper (after refs)**

```typescript
const invalidateCurrentCache = useCallback(() => {
  const current = previousRootRef.current;
  if (current) {
    familyCacheRef.current.delete(current);
  }
}, []);
```

**Change 4 — Call invalidation on mutations**

In `createThread` wrapper (line 189), `clearMessages` (line 198), and the webhook completion handler (line 140), call `invalidateCurrentCache()` to prevent stale cache from being restored later.

In `sendMessage` (line 227), update cache for current family after message is added (both user message add and assistant message completion).

**Change 5 — Rewrite consolidated effect (lines 282-321)**

```text
Replace the existing effect body with:

1. Save outgoing family to cache:
   - Read previousRootRef.current
   - If it exists and tm.activeThreadId is set:
     - Save { threadId, messages, threads } to familyCacheRef
     - Evict oldest entry if cache exceeds MAX_CACHE_ENTRIES
   - Update previousRootRef.current = rootPromptId

2. Reset UI state (same as current)

3. If rootPromptId is null, return early

4. Check cache for incoming family:
   - If cached entry exists:
     - Restore threadId, messages, threads immediately
     - Schedule background refresh (non-loading):
       a. Fetch threads from server
       b. If active thread still exists, fetch its messages
       c. Silently update state if data differs
     - Return (skip full server fetch)

5. If no cache: full server fetch (existing logic, unchanged)
```

**Change 6 — Background refresh helper**

Add a private function `backgroundRefresh` that:
- Calls `tm.fetchThreads()` WITHOUT setting `isLoading`
- Calls `tm.switchThread()` for the active thread
- Only updates `mm.setMessages()` if the fetched messages differ from cached
- Swallows all errors silently (cache is already displayed)

To avoid the loading flash (finding #8), the background refresh calls `fetchThreads` directly and maps response manually rather than going through `switchThread` (which sets `isLoading = true`). Alternatively, a new `fetchMessagesQuietly` method on threadManager can be used.

### File 2: `src/hooks/usePromptFamilyThreads.ts`

**Change 1 — Expose `setThreads` as `restoreThreads` in the return interface**

Add to `UsePromptFamilyThreadsReturn`:
```typescript
restoreThreads: React.Dispatch<React.SetStateAction<ChatThread[]>>;
```

Add to return object:
```typescript
restoreThreads: setThreads,
```

**Change 2 — Add `fetchMessagesQuietly` method**

A variant of `switchThread` that fetches messages for a given thread WITHOUT setting `isLoading` or updating `activeThreadId`. Returns `ChatMessage[]`. This is used exclusively by the background refresh to avoid UI flicker.

```typescript
const fetchMessagesQuietly = useCallback(async (threadId: string): Promise<ChatMessage[]> => {
  if (!threadId) return [];
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return [];
    const response = await supabase.functions.invoke('thread-manager', {
      body: { action: 'get_messages', thread_row_id: threadId, limit: 100 }
    });
    if (response.error) return [];
    if (response.data?.status === 'openai_not_configured') return [];
    return (response.data?.messages || []).map((m: { id: string; role: 'user' | 'assistant'; content: string; created_at?: string }) => ({
      row_id: m.id,
      role: m.role,
      content: m.content,
      created_at: m.created_at,
    }));
  } catch {
    return [];
  }
}, []);
```

Add to return interface and return object.

## Files Changed

| File | Change |
|------|--------|
| `src/hooks/usePromptFamilyChat.ts` | Add cache ref, save/restore in consolidated effect, cache invalidation on mutations, background refresh |
| `src/hooks/usePromptFamilyThreads.ts` | Expose `restoreThreads`, add `fetchMessagesQuietly` |

## What stays the same

- OpenAI Conversations API remains the source of truth
- Thread creation, deletion, and message sending logic unchanged (only cache invalidation calls added)
- Edge functions unchanged
- Database schema unchanged
- No other files touched
- `@ts-nocheck` preserved (not in scope to remove)

## Edge cases handled

| Case | Handling |
|------|----------|
| First visit to a family (no cache) | Full server fetch, identical to current behavior |
| Cache at capacity (>20) | Oldest entry evicted before insert |
| Stale cache (webhook message arrived while away) | Background refresh silently updates after restore |
| Deleted thread in cache | Background refresh detects missing thread, falls back to first available |
| User deletes thread then switches away/back | `invalidateCurrentCache` clears entry on delete, forcing full fetch on return |
| User sends message then switches away/back | Cache updated on family switch (snapshot captures latest messages) |
| `rootPromptId` is null | Cache saved for outgoing family, no restore attempted |
| Rapid switching (race condition) | Existing `cancelled` flag in effect prevents stale updates; background refresh checks `rootPromptId` hasn't changed before applying |

