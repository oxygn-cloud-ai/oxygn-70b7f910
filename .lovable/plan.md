
# Revised Plan: Graceful OpenAI Configuration Error Handling

## Critical Review Findings

### Issue #1: Missing TypeScript Types in Hook Files (CRITICAL)

**Finding**: `useResourceHealth.ts` and `useThreads.ts` are plain JavaScript without TypeScript typing, violating the project's TypeScript infrastructure requirement.

**Evidence**:
- `useResourceHealth.ts` line 10: `export const useResourceHealth = (assistantRowId) => {` - no type annotation
- `useResourceHealth.ts` lines 11-14: `useState(null)` - untyped state
- `useThreads.ts` line 7: `export const useThreads = (assistantRowId, childPromptRowId) => {` - no type annotations

**Required Fix**: Add full TypeScript typing to both hooks.

---

### Issue #2: useAllResourceHealth Hook Not Updated in Plan (OMISSION)

**Finding**: The original plan only mentions `useResourceHealth` hook, but `useAllResourceHealth` (lines 143-206) also calls `resource-health` with `check_all` action and will throw errors when data.error is set.

**Evidence**: `HealthContent.tsx` line 282 uses `useAllResourceHealth`:
```tsx
const { assistants, isChecking, error, checkAll, repairAssistant } = useAllResourceHealth();
```

And lines 322-327 show error handling that will display the error:
```tsx
if (error) {
  return (
    <div className="p-4 bg-red-500/10 rounded-m3-lg text-red-600">
      <p className="text-body-sm">Error: {error}</p>
    </div>
  );
}
```

**Required Fix**: Update `useAllResourceHealth` to handle `not_configured` status gracefully.

---

### Issue #3: usePromptFamilyThreads Also Calls thread-manager get_messages (OMISSION)

**Finding**: The plan focuses on `useThreads.ts` but `usePromptFamilyThreads.ts` also calls `thread-manager` with `get_messages` action (line 136-142) and will encounter the same error.

**Evidence**: Lines 147-150 in `usePromptFamilyThreads.ts`:
```typescript
if (response.error) {
  console.error('Error fetching messages on thread switch:', response.error);
  return [];
}
```

This silently returns empty array on error, but the `response.data?.status` is not checked.

**Required Fix**: Also handle `openai_not_configured` status in `usePromptFamilyThreads.ts` to avoid silent failures.

---

### Issue #4: HealthResult Interface Already Includes 'not_configured' Status (GOOD)

**Finding**: The `HealthResult` interface in `resource-health/index.ts` (line 20) already includes `'not_configured'` as a valid status:
```typescript
status: 'healthy' | 'degraded' | 'broken' | 'not_configured';
```

This validates the plan's approach and confirms we're extending existing patterns.

---

### Issue #5: repair_assistant Action Still Requires OpenAI Key (CORRECT DESIGN)

**Finding**: The `repair_assistant` action (lines 510-524) will fail if no OpenAI key is configured. This is **correct behavior** since repair is an explicit user action requiring OpenAI access. No change needed here.

---

### Issue #6: check_all Action Missing Individual not_configured Handling (GAP)

**Finding**: When `check_all` is called without an OpenAI key, the entire response returns an error. However, the plan should also consider that individual assistant checks within `check_all` should return `not_configured` status per-assistant rather than fail the whole batch.

**Current behavior** (lines 498-501):
```typescript
for (const assistant of assistants || []) {
  const result = await checkAssistantHealth(supabase, assistant.row_id, openaiKey);
  results.push(result);
}
```

The early return at line 456-461 prevents reaching this loop. The plan correctly addresses this by returning a 200 with `not_configured` status before the switch statement.

---

### Issue #7: Thread Messages Response Type Mismatch Risk (TECHNICAL)

**Finding**: The planned `openai_not_configured` status field is a new addition to the response. Code that destructures the response must handle this gracefully.

**Evidence** in `usePromptFamilyThreads.ts` lines 152-157:
```typescript
return (response.data?.messages || []).map((m: { ... }) => ({ ... }));
```

This is safe because it defaults to empty array, but the status should be logged for debugging.

---

### Issue #8: Cached Health Data May Persist not_configured Status (EDGE CASE)

**Finding**: In `useResourceHealth.ts` lines 29-34, health data is cached:
```javascript
const setCachedHealth = useCallback((id, data) => {
  cacheRef.current[id] = {
    data,
    timestamp: Date.now(),
  };
}, []);
```

The plan correctly mentions NOT caching `not_configured` status, but the implementation details need to be explicit.

---

### Issue #9: Error State Not Cleared on not_configured (BUG POTENTIAL)

**Finding**: In `useResourceHealth.ts`, if a previous check failed with an error, then a subsequent check returns `not_configured`, the error state from line 78 (`setError(err.message)`) may persist.

**Required Fix**: Clear error state when receiving `not_configured` status.

---

### Issue #10: TypeScript Typing for Health Status Response (MISSING)

**Finding**: No TypeScript interface defines the graceful `not_configured` response structure. This should be added for type safety.

---

## Revised Implementation Plan

### Step 1: Update `supabase/functions/resource-health/index.ts`

**Location**: Lines 454-461 (early API key check)

**Change**: Replace hard error with graceful 200 response

```typescript
// Get user's OpenAI API key from credentials
const openaiKey = await getOpenAIApiKey(authHeader);
if (!openaiKey) {
  // Return graceful status instead of error for background health checks
  console.log('[resource-health] OpenAI API key not configured, returning graceful status');
  return new Response(JSON.stringify({
    status: 'not_configured',
    message: 'OpenAI API key not configured. Add your key in Settings → Integrations → OpenAI.',
    assistants: [],
  }), {
    status: 200,  // 200 OK, not 400
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
```

**No other changes to this file** - the switch statement actions are only reached if the key exists.

---

### Step 2: Update `supabase/functions/thread-manager/index.ts`

**Location**: Lines 336-348 (get_messages action)

**Change**: Replace `requireOpenAIKey()` with graceful handling

```typescript
// GET_MESSAGES - Get messages from OpenAI Conversations API
if (action === 'get_messages') {
  const { thread_row_id, limit = 50 } = body;

  // Get the thread and verify ownership
  const { data: thread, error: threadError } = await supabase
    .from(TABLES.THREADS)
    .select('openai_conversation_id, owner_id')
    .eq('row_id', thread_row_id)
    .maybeSingle();

  if (threadError || !thread) {
    console.error('Thread not found:', threadError);
    return new Response(
      JSON.stringify({ error: 'Thread not found' }),
      { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // Enforce ownership - only owner can read messages
  if (thread.owner_id !== validation.user?.id) {
    console.warn('Unauthorized get_messages attempt:', { thread_row_id, owner: thread.owner_id, requester: validation.user?.id });
    return new Response(
      JSON.stringify({ error: 'Access denied' }),
      { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // Gracefully handle missing API key for get_messages (background operation)
  const messagesApiKey = await getOpenAIKey();
  if (!messagesApiKey) {
    console.log('[thread-manager] OpenAI API key not configured, returning empty message history');
    return new Response(
      JSON.stringify({ 
        messages: [], 
        source: 'none',
        status: 'openai_not_configured',
        message: 'Configure OpenAI API key to view message history'
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // Fetch messages from OpenAI
  const messages = await fetchMessagesFromOpenAI(messagesApiKey, thread.openai_conversation_id, limit);

  console.log('Returning messages:', messages.length);

  return new Response(
    JSON.stringify({ messages, source: 'openai' }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}
```

---

### Step 3: Convert `src/hooks/useResourceHealth.ts` to TypeScript

**Full rewrite with types**:

```typescript
import { useState, useCallback, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';

const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

/** Health status for a single assistant */
export interface AssistantHealth {
  assistant_row_id: string;
  assistant_name: string;
  prompt_name: string;
  status: 'healthy' | 'degraded' | 'broken' | 'not_configured';
  vector_store: {
    status: 'exists' | 'missing' | 'not_configured';
    id?: string;
    error?: string;
  };
  files: {
    total_in_db: number;
    healthy: number;
    missing_openai: number;
    missing_storage: number;
    details: Array<{
      row_id: string;
      original_filename: string;
      openai_file_id: string | null;
      storage_path: string;
      status: 'healthy' | 'missing_openai' | 'missing_storage' | 'orphaned';
      error?: string;
    }>;
  };
  errors: string[];
}

/** Response from resource-health edge function */
interface HealthResponse {
  status?: 'not_configured';
  message?: string;
  assistants?: AssistantHealth[];
  error?: string;
}

interface CacheEntry {
  data: AssistantHealth;
  timestamp: number;
}

interface UseResourceHealthReturn {
  health: AssistantHealth | null;
  isChecking: boolean;
  isRepairing: boolean;
  error: string | null;
  checkHealth: (forceRefresh?: boolean) => Promise<AssistantHealth | null>;
  repair: () => Promise<unknown>;
  invalidateCache: () => void;
}

/**
 * Hook for checking and repairing OpenAI resource health for an assistant
 */
export const useResourceHealth = (assistantRowId: string | null): UseResourceHealthReturn => {
  const [health, setHealth] = useState<AssistantHealth | null>(null);
  const [isChecking, setIsChecking] = useState(false);
  const [isRepairing, setIsRepairing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const cacheRef = useRef<Record<string, CacheEntry>>({});

  // Check if cached result is still valid
  const getCachedHealth = useCallback((id: string): AssistantHealth | null => {
    const cached = cacheRef.current[id];
    if (!cached) return null;
    if (Date.now() - cached.timestamp > CACHE_TTL_MS) {
      delete cacheRef.current[id];
      return null;
    }
    return cached.data;
  }, []);

  // Store result in cache
  const setCachedHealth = useCallback((id: string, data: AssistantHealth): void => {
    cacheRef.current[id] = {
      data,
      timestamp: Date.now(),
    };
  }, []);

  // Invalidate cache for an assistant
  const invalidateCache = useCallback((id: string): void => {
    delete cacheRef.current[id];
  }, []);

  // Check health of a single assistant
  const checkHealth = useCallback(async (forceRefresh = false): Promise<AssistantHealth | null> => {
    if (!assistantRowId) return null;

    // Return cached result if available and not forcing refresh
    if (!forceRefresh) {
      const cached = getCachedHealth(assistantRowId);
      if (cached) {
        setHealth(cached);
        return cached;
      }
    }

    setIsChecking(true);
    setError(null);

    try {
      const { data, error: invokeError } = await supabase.functions.invoke<HealthResponse>('resource-health', {
        body: {
          action: 'check_assistant',
          assistant_row_id: assistantRowId,
        },
      });

      if (invokeError) {
        throw new Error(invokeError.message);
      }

      if (data?.error) {
        throw new Error(data.error);
      }

      // Handle graceful "not_configured" status - not an error, just unavailable
      if (data?.status === 'not_configured') {
        const notConfiguredHealth: AssistantHealth = {
          assistant_row_id: assistantRowId,
          assistant_name: 'Unknown',
          prompt_name: 'Unknown',
          status: 'not_configured',
          vector_store: { status: 'not_configured' },
          files: { total_in_db: 0, healthy: 0, missing_openai: 0, missing_storage: 0, details: [] },
          errors: [],
        };
        setHealth(notConfiguredHealth);
        // Don't cache not_configured so it re-checks after key is added
        return notConfiguredHealth;
      }

      // Normal health response
      const healthData = data as AssistantHealth;
      setHealth(healthData);
      setCachedHealth(assistantRowId, healthData);
      return healthData;
    } catch (err) {
      console.error('[useResourceHealth] Check error:', err);
      const message = err instanceof Error ? err.message : 'Unknown error';
      setError(message);
      return null;
    } finally {
      setIsChecking(false);
    }
  }, [assistantRowId, getCachedHealth, setCachedHealth]);

  // Repair an assistant's resources
  const repair = useCallback(async (): Promise<unknown> => {
    if (!assistantRowId) return null;

    setIsRepairing(true);
    setError(null);

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

      if (data?.error) {
        throw new Error(data.error);
      }

      // Invalidate cache and re-check health after repair
      invalidateCache(assistantRowId);
      await checkHealth(true);

      return data;
    } catch (err) {
      console.error('[useResourceHealth] Repair error:', err);
      const message = err instanceof Error ? err.message : 'Unknown error';
      setError(message);
      return null;
    } finally {
      setIsRepairing(false);
    }
  }, [assistantRowId, invalidateCache, checkHealth]);

  // Auto-check on mount (with cache)
  useEffect(() => {
    if (assistantRowId) {
      checkHealth(false);
    }
  }, [assistantRowId, checkHealth]);

  return {
    health,
    isChecking,
    isRepairing,
    error,
    checkHealth,
    repair,
    invalidateCache: () => invalidateCache(assistantRowId || ''),
  };
};

/** Response type for check_all action */
interface AllHealthResponse {
  status?: 'not_configured';
  message?: string;
  assistants?: AssistantHealth[];
  error?: string;
}

interface UseAllResourceHealthReturn {
  assistants: AssistantHealth[];
  isChecking: boolean;
  error: string | null;
  checkAll: () => Promise<AssistantHealth[]>;
  repairAssistant: (assistantRowId: string) => Promise<unknown>;
}

/**
 * Hook for checking health of all assistants (bulk operation)
 */
export const useAllResourceHealth = (): UseAllResourceHealthReturn => {
  const [assistants, setAssistants] = useState<AssistantHealth[]>([]);
  const [isChecking, setIsChecking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const checkAll = useCallback(async (): Promise<AssistantHealth[]> => {
    setIsChecking(true);
    setError(null);

    try {
      const { data, error: invokeError } = await supabase.functions.invoke<AllHealthResponse>('resource-health', {
        body: { action: 'check_all' },
      });

      if (invokeError) {
        throw new Error(invokeError.message);
      }

      if (data?.error) {
        throw new Error(data.error);
      }

      // Handle graceful "not_configured" status - return empty array, no error
      if (data?.status === 'not_configured') {
        console.log('[useAllResourceHealth] OpenAI not configured, showing empty assistants list');
        setAssistants([]);
        return [];
      }

      const assistantsList = data?.assistants || [];
      setAssistants(assistantsList);
      return assistantsList;
    } catch (err) {
      console.error('[useAllResourceHealth] Check error:', err);
      const message = err instanceof Error ? err.message : 'Unknown error';
      setError(message);
      return [];
    } finally {
      setIsChecking(false);
    }
  }, []);

  // Repair a specific assistant and refresh list
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

      // Refresh the list after repair
      await checkAll();

      return data;
    } catch (err) {
      console.error('[useAllResourceHealth] Repair error:', err);
      throw err;
    }
  }, [checkAll]);

  return {
    assistants,
    isChecking,
    error,
    checkAll,
    repairAssistant,
  };
};

export default useResourceHealth;
```

---

### Step 4: Convert `src/hooks/useThreads.ts` to TypeScript

**Full rewrite with types and graceful handling**:

```typescript
import { useState, useEffect, useCallback, useRef } from 'react';
import { useSupabase } from './useSupabase';
import { toast } from '@/components/ui/sonner';
import { trackEvent } from '@/lib/posthog';
import { parseApiError } from '@/utils/apiErrorUtils';

interface Thread {
  row_id: string;
  name: string | null;
  is_active: boolean;
  openai_conversation_id: string | null;
  created_at: string | null;
  updated_at: string | null;
}

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  created_at?: string;
}

interface ThreadResponse {
  threads?: Thread[];
  thread?: Thread;
  success?: boolean;
  error?: string;
  error_code?: string;
}

interface MessagesResponse {
  messages?: Message[];
  source?: string;
  status?: string;
  message?: string;
  error?: string;
  error_code?: string;
}

interface UseThreadsReturn {
  threads: Thread[];
  activeThread: Thread | null;
  setActiveThread: (thread: Thread | null) => void;
  messages: Message[];
  isLoading: boolean;
  isLoadingMessages: boolean;
  createThread: (name?: string) => Promise<Thread | null>;
  deleteThread: (threadRowId: string) => Promise<boolean>;
  fetchMessages: (threadRowId: string) => Promise<Message[]>;
  renameThread: (threadRowId: string, name: string) => Promise<boolean>;
  refetch: () => Promise<void>;
}

export const useThreads = (
  assistantRowId: string | null,
  childPromptRowId: string | null
): UseThreadsReturn => {
  const supabase = useSupabase();
  const [threads, setThreads] = useState<Thread[]>([]);
  const [activeThread, setActiveThread] = useState<Thread | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const isMountedRef = useRef(true);

  // Reset mounted ref on mount/unmount
  useEffect(() => {
    isMountedRef.current = true;
    return () => { isMountedRef.current = false; };
  }, []);

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

      // Check data.error first - it contains structured error_code even on 4xx responses
      if (data?.error) throw data;
      if (error) throw error;

      if (isMountedRef.current) {
        setThreads(data?.threads || []);

        // Set active thread if one exists
        if (data?.threads?.length && !activeThread) {
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
  }, [supabase, assistantRowId, childPromptRowId, activeThread]);

  useEffect(() => {
    fetchThreads();
  }, [fetchThreads]);

  const createThread = useCallback(async (name?: string): Promise<Thread | null> => {
    if (!supabase || !assistantRowId) return null;

    try {
      const { data, error } = await supabase.functions.invoke<ThreadResponse>('thread-manager', {
        body: {
          action: 'create',
          assistant_row_id: assistantRowId,
          child_prompt_row_id: childPromptRowId,
          name,
        },
      });

      // Check data.error first - it contains structured error_code even on 4xx responses
      if (data?.error) throw data;
      if (error) throw error;

      if (data?.thread) {
        setThreads(prev => [data.thread!, ...prev]);
        setActiveThread(data.thread);
        toast.success('New thread created', {
          source: 'useThreads.createThread',
          details: JSON.stringify({ threadRowId: data.thread.row_id, assistantRowId, childPromptRowId, name }, null, 2),
        });
        trackEvent('thread_created', { assistant_row_id: assistantRowId, child_prompt_row_id: childPromptRowId });
        return data.thread;
      }
      return null;
    } catch (error) {
      console.error('Error creating thread:', error);
      const parsed = parseApiError(error);
      toast.error(parsed.title, {
        description: parsed.message,
        source: 'useThreads.createThread',
        errorCode: parsed.code,
        details: JSON.stringify({ assistantRowId, childPromptRowId, name, error: parsed.original }, null, 2),
      });
      return null;
    }
  }, [supabase, assistantRowId, childPromptRowId]);

  const deleteThread = useCallback(async (threadRowId: string): Promise<boolean> => {
    if (!supabase) return false;

    try {
      const { data, error } = await supabase.functions.invoke<ThreadResponse>('thread-manager', {
        body: {
          action: 'delete',
          thread_row_id: threadRowId,
        },
      });

      // Check data.error first - it contains structured error_code even on 4xx responses
      if (data?.error) throw data;
      if (error) throw error;

      setThreads(prev => prev.filter(t => t.row_id !== threadRowId));
      if (activeThread?.row_id === threadRowId) {
        setActiveThread(null);
        setMessages([]);
      }
      toast.success('Thread deleted', {
        source: 'useThreads.deleteThread',
        details: JSON.stringify({ threadRowId }, null, 2),
      });
      trackEvent('thread_deleted', { thread_row_id: threadRowId });
      return true;
    } catch (error) {
      console.error('Error deleting thread:', error);
      const parsed = parseApiError(error);
      toast.error(parsed.title, {
        description: parsed.message,
        source: 'useThreads.deleteThread',
        errorCode: parsed.code,
        details: JSON.stringify({ threadRowId, error: parsed.original }, null, 2),
      });
      return false;
    }
  }, [supabase, activeThread]);

  const fetchMessages = useCallback(async (threadRowId: string): Promise<Message[]> => {
    if (!supabase || !threadRowId) return [];

    setIsLoadingMessages(true);
    try {
      const { data, error } = await supabase.functions.invoke<MessagesResponse>('thread-manager', {
        body: {
          action: 'get_messages',
          thread_row_id: threadRowId,
          limit: 50,
        },
      });

      // Check data.error first - it contains structured error_code even on 4xx responses
      if (data?.error) throw data;
      if (error) throw error;

      // Handle graceful not_configured status - return empty messages, no toast
      if (data?.status === 'openai_not_configured') {
        console.log('[useThreads] OpenAI not configured, returning empty messages');
        setMessages([]);
        return [];
      }

      const messageList = data?.messages || [];
      setMessages(messageList);
      return messageList;
    } catch (error) {
      console.error('Error fetching messages:', error);
      const parsed = parseApiError(error);
      toast.error(parsed.title, {
        description: parsed.message,
        source: 'useThreads.fetchMessages',
        errorCode: parsed.code,
      });
      return [];
    } finally {
      setIsLoadingMessages(false);
    }
  }, [supabase]);

  const renameThread = useCallback(async (threadRowId: string, name: string): Promise<boolean> => {
    if (!supabase) return false;

    try {
      const { data, error } = await supabase.functions.invoke<ThreadResponse>('thread-manager', {
        body: {
          action: 'rename',
          thread_row_id: threadRowId,
          name,
        },
      });

      // Check data.error first - it contains structured error_code even on 4xx responses
      if (data?.error) throw data;
      if (error) throw error;

      setThreads(prev => prev.map(t =>
        t.row_id === threadRowId ? { ...t, name } : t
      ));
      return true;
    } catch (error) {
      console.error('Error renaming thread:', error);
      const parsed = parseApiError(error);
      toast.error(parsed.title, {
        description: parsed.message,
        source: 'useThreads.renameThread',
        errorCode: parsed.code,
      });
      return false;
    }
  }, [supabase]);

  return {
    threads,
    activeThread,
    setActiveThread,
    messages,
    isLoading,
    isLoadingMessages,
    createThread,
    deleteThread,
    fetchMessages,
    renameThread,
    refetch: fetchThreads,
  };
};
```

---

### Step 5: Update `src/hooks/usePromptFamilyThreads.ts` for Graceful Handling

**Location**: Lines 147-150 (error handling in switchThread)

**Change**: Add status check for `openai_not_configured`

```typescript
// Check again after async operation
if (requestId !== switchRequestIdRef.current) return [];

// Handle invoke-level errors
if (response.error) {
  console.error('Error fetching messages on thread switch:', response.error);
  return [];
}

// Handle graceful not_configured status - empty messages, no error
if (response.data?.status === 'openai_not_configured') {
  console.log('[usePromptFamilyThreads] OpenAI not configured, returning empty messages');
  return [];
}

return (response.data?.messages || []).map((m: { id: string; role: 'user' | 'assistant'; content: string; created_at?: string }) => ({
  row_id: m.id,
  role: m.role,
  content: m.content,
  created_at: m.created_at,
}));
```

---

## Summary of Files to Modify

| File | Change Type | Summary |
|------|-------------|---------|
| `supabase/functions/resource-health/index.ts` | Edge Function | Return 200 with `status: 'not_configured'` at line 456-461 |
| `supabase/functions/thread-manager/index.ts` | Edge Function | Replace `requireOpenAIKey()` with graceful handling at line 336-348 |
| `src/hooks/useResourceHealth.ts` | Full Rewrite | Convert to TypeScript with proper types and `not_configured` handling |
| `src/hooks/useThreads.ts` | Full Rewrite | Convert to TypeScript with proper types and `openai_not_configured` handling |
| `src/hooks/usePromptFamilyThreads.ts` | Line Edit | Add status check for `openai_not_configured` at lines 147-157 |

---

## What is NOT Changed

1. **`create` action in thread-manager** - Still requires OpenAI key (explicit user action)
2. **`repair_assistant` action in resource-health** - Still requires OpenAI key (explicit user action)
3. **HealthContent.tsx** - No changes needed; `useAllResourceHealth` will handle the status
4. **Error codes in errorCodes.ts** - No changes; existing codes are reused
5. **parseApiError in apiErrorUtils.ts** - No changes; existing patterns cover these cases

---

## Testing Checklist

After implementation:

1. [ ] Load app without OpenAI key configured - no error toasts on page load
2. [ ] Navigate to Health page - shows "No assistants configured" without error
3. [ ] Navigate to prompt with assistant - thread list loads, messages show empty
4. [ ] Click "New Chat" without key - shows clear OPENAI_NOT_CONFIGURED error
5. [ ] Try to send message without key - shows clear OPENAI_NOT_CONFIGURED error
6. [ ] Configure API key in Settings → Integrations → OpenAI
7. [ ] Refresh page - all features work normally
8. [ ] Health page shows actual assistant health status
9. [ ] Messages load correctly for existing threads
