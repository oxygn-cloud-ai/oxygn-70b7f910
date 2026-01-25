

# Critical Audit: Chat Initialization & Performance Fix Plan

## Executive Summary

After exhaustive code review, I've identified **3 critical errors**, **2 significant omissions**, **4 architectural concerns**, and **1 type safety issue** in the proposed plan. The plan is directionally correct but incomplete and contains implementation errors that would cause runtime failures.

---

## CRITICAL ERROR #1: Race Condition Fix is Incomplete

### Problem
The plan proposes having `fetchThreads` return the auto-selected thread ID, but this only partially fixes the race condition. The actual bug is more nuanced:

**Current Code (usePromptFamilyChat.ts:183-225):**
```typescript
useEffect(() => {
  const loadThreadAndMessages = async () => {
    const tm = threadManagerRef.current;  // Ref to hook
    // ...
    await tm.fetchThreads();
    
    // BUG: tm.activeThreadId reads STATE, not ref!
    const activeId = tm.activeThreadId;  // This is React state - stale after await!
```

**The plan says:** "Use returned value from fetchThreads"

**Actual Issue:** `threadManagerRef.current` is updated on every render (line 61-64), but `tm.activeThreadId` is read from the **state** of that ref's value at call time, not the live state. Even with Option B (using `activeThreadIdRef.current`), the ref IS exposed but via the hook's internal ref, not the return interface.

### Correct Fix
The `fetchThreads` function at line 57-58 DOES update `activeThreadIdRef.current` synchronously:
```typescript
if (data?.length && !activeThreadIdRef.current) {
  setActiveThreadId(data[0].row_id);  // State update (async)
}
```

But `activeThreadIdRef` is NOT exposed in the return type (`UsePromptFamilyThreadsReturn`). The plan's Option A is the only valid solution, but requires:

1. **Change return type** of `fetchThreads` from `Promise<void>` to `Promise<string | null>`
2. **Update the interface** `UsePromptFamilyThreadsReturn.fetchThreads`
3. **Update `usePromptFamilyChat.ts` return type** which exposes `fetchThreads: threadManager.fetchThreads`

### Type Safety Risk
Changing `fetchThreads: () => Promise<void>` to `fetchThreads: () => Promise<string | null>` will break the `UsePromptFamilyChatReturn` interface at line 30:
```typescript
fetchThreads: () => Promise<void>;  // Must also change
```

---

## CRITICAL ERROR #2: Root Prompt Resolution - Fallback Logic Missing

### Problem
The plan proposes:
```typescript
const { data } = await supabase
  .from('q_prompts')
  .select('root_prompt_row_id')
  .eq('row_id', pRowId)
  .maybeSingle();

return data?.root_prompt_row_id || pRowId;
```

**Risk:** For a ROOT prompt, `root_prompt_row_id` equals `row_id` (per the DB trigger logic). This works correctly.

**BUT:** The database trigger (`compute_root_prompt_row_id`) is `BEFORE INSERT OR UPDATE OF parent_row_id`. If a prompt is inserted without a parent and later gets a parent, the trigger recalculates. However, if `root_prompt_row_id` is ever NULL (data corruption, migration issue, etc.), the fallback `|| pRowId` returns the CURRENT prompt ID, not the actual root.

**Validation Query Results:**
```
null_root: 0, total: 170, with_root: 170
```

Currently all prompts have `root_prompt_row_id` populated. However, the plan's fallback should still be robust:

### Recommended Safer Logic
```typescript
const computeRootPromptId = useCallback(async (pRowId: string): Promise<string> => {
  const { data, error } = await supabase
    .from('q_prompts')
    .select('root_prompt_row_id, parent_row_id')
    .eq('row_id', pRowId)
    .maybeSingle();
  
  if (error) {
    console.error('[computeRootPromptId] Query failed:', error);
    return pRowId; // Fallback to self
  }
  
  // If root_prompt_row_id is set, use it
  if (data?.root_prompt_row_id) {
    return data.root_prompt_row_id;
  }
  
  // If no parent, this IS the root
  if (!data?.parent_row_id) {
    return pRowId;
  }
  
  // Fallback: root_prompt_row_id is NULL but parent exists (data corruption)
  console.warn('[computeRootPromptId] Missing root_prompt_row_id for prompt with parent:', pRowId);
  return pRowId; // Return self; system will create isolated thread
}, []);
```

---

## CRITICAL ERROR #3: Interface Type Mismatch

### Problem
The `ChatThread` type in `src/types/chat.ts` doesn't match the `q_threads` table schema:

**ChatThread interface (src/types/chat.ts:3-13):**
```typescript
export interface ChatThread {
  row_id: string;
  title: string | null;           // ❌ Table has 'name', not 'title'
  root_prompt_row_id: string;     // ❌ Table allows NULL
  openai_conversation_id: string | null;
  owner_id: string;               // ❌ Table allows NULL
  is_active: boolean;             // ❌ Table allows NULL
  last_message_at: string | null;
  created_at: string;             // ❌ Table allows NULL
  updated_at?: string | null;
}
```

**q_threads table (from DB query):**
```
name: text (nullable)  <- not 'title'
root_prompt_row_id: uuid (nullable)
owner_id: uuid (nullable)
is_active: boolean (nullable)
created_at: timestamp (nullable)
```

### Impact
When fetching threads, the code at `usePromptFamilyThreads.ts:54`:
```typescript
setThreads((data || []) as ChatThread[]);
```

This unsafe cast will:
1. **Fail silently** when accessing `thread.title` (property doesn't exist, `name` does)
2. Cause TypeScript to not catch potential `null` access errors

### Fix Required
Update `ChatThread` interface OR update the thread fetch/select to alias `name` as `title`.

---

## SIGNIFICANT OMISSION #1: Backend Resolution Not Updated

### Problem
The plan only addresses **frontend** optimization (`src/hooks/usePromptFamilyChat.ts`), but the **identical iterative logic exists in the backend**:

**`supabase/functions/_shared/familyThreads.ts:99-123`:**
```typescript
export async function resolveRootPromptId(
  supabase: any, 
  promptRowId: string
): Promise<string> {
  let current = promptRowId;
  let depth = 0;
  const maxDepth = 15;
  // ... same iterative loop
}
```

This is called by `conversation-run/index.ts:2052`:
```typescript
const rootPromptRowId = await resolveRootPromptId(supabase, child_prompt_row_id);
```

### Impact
- Cascade/starburst runs will still suffer slow root resolution
- Inconsistent behavior between chat and cascade execution paths

### Required Addition
The plan should include updating `supabase/functions/_shared/familyThreads.ts` to also use direct column lookup:

```typescript
export async function resolveRootPromptId(
  supabase: any, 
  promptRowId: string
): Promise<string> {
  const { data } = await supabase
    .from(TABLES.PROMPTS)
    .select('root_prompt_row_id')
    .eq('row_id', promptRowId)
    .maybeSingle();
  
  return data?.root_prompt_row_id || promptRowId;
}
```

---

## SIGNIFICANT OMISSION #2: Effect Dependency Missing

### Problem
The consolidated effect in `usePromptFamilyChat.ts:184-225` accesses `threadManagerRef`, `messageManagerRef`, `streamManagerRef` but has NO dependencies on these refs:

```typescript
useEffect(() => {
  // ...
  const tm = threadManagerRef.current;
  const mm = messageManagerRef.current;
  const sm = streamManagerRef.current;
  // ...
}, [rootPromptId]);  // ❌ No ref dependencies - but that's intentional!
```

**This is actually CORRECT** - refs don't need to be dependencies. However, the plan doesn't mention verifying this pattern is preserved after changes.

---

## ARCHITECTURAL CONCERN #1: Duplicated Thread Fetch Logic

### Problem
Two hooks independently implement message fetching from the same endpoint:

1. **`usePromptFamilyThreads.ts:107-155`** - `switchThread()` calls `thread-manager` with `action: 'get_messages'`
2. **`usePromptFamilyChatMessages.ts:45-78`** - `fetchMessages()` calls `thread-manager` with `action: 'get_messages'`

Both hooks call the same edge function with the same action. The plan proposes modifying `fetchThreads` but doesn't address this duplication.

### Recommendation
Document that `switchThread` returns messages directly (as it already does), and `fetchMessages` in the messages hook is a fallback/refresh mechanism. This is acceptable but should be documented.

---

## ARCHITECTURAL CONCERN #2: sendMessage Uses Old Thread Reference

### Problem
In `usePromptFamilyChat.ts:143-181`, `sendMessage` callback depends on `threadManager.activeThreadId`:

```typescript
const sendMessage = useCallback(async (
  // ...
): Promise<string | null> => {
  // ...
  const effectiveThreadId = threadId || threadManager.activeThreadId;
  // ...
}, [threadManager.activeThreadId, promptRowId, ...]);  // ✅ Dependency included
```

This is correct - the dependency is included. No issue here.

---

## ARCHITECTURAL CONCERN #3: Unique Constraint on Family Threads

### Database Schema (from migration):
```sql
CREATE UNIQUE INDEX IF NOT EXISTS idx_q_threads_family_unique 
  ON q_threads(root_prompt_row_id, owner_id) 
  WHERE is_active = true AND root_prompt_row_id IS NOT NULL;
```

This enforces ONE active thread per family per user. However, the current code at `usePromptFamilyThreads.ts:73-79` deactivates all previous threads before creating a new one:

```typescript
await supabase
  .from('q_threads')
  .update({ is_active: false })
  .eq('root_prompt_row_id', rootPromptId)
  .eq('owner_id', user.id)
  .eq('is_active', true);
```

**Potential Issue:** If this update fails, the subsequent insert will violate the unique constraint. The code doesn't check for the update error before proceeding.

### Not in Plan Scope
This is a pre-existing issue, not introduced by the plan. Noting for awareness.

---

## ARCHITECTURAL CONCERN #4: q_threads vs q_prompt_family_threads

### Observation
The codebase has TWO thread tables:
1. `q_threads` - Used by current implementation
2. `q_prompt_family_threads` - Referenced in `TABLES.PROMPT_FAMILY_THREADS`

**From `supabase/functions/_shared/tables.ts:30`:**
```typescript
PROMPT_FAMILY_THREADS: getEnv('PROMPT_FAMILY_THREADS_TBL', 'q_prompt_family_threads'),
```

But the actual code uses `q_threads` (via `TABLES.THREADS`). This appears to be legacy/unused but should be verified.

### Not in Plan Scope
This is a pre-existing architectural decision. The plan correctly uses `q_threads`.

---

## TYPE SAFETY ISSUE: Unsafe Type Assertions

### Problem
Multiple locations use `as ChatThread[]` or `as ChatThread`:

1. `usePromptFamilyThreads.ts:54`:
   ```typescript
   setThreads((data || []) as ChatThread[]);
   ```

2. `usePromptFamilyThreads.ts:92`:
   ```typescript
   const newThread = response.data?.thread as ChatThread | undefined;
   ```

These bypass TypeScript's type checking. Given the interface mismatch identified above, these will silently allow incorrect data shapes.

### Fix Required
Either:
1. Fix the `ChatThread` interface to match reality, OR
2. Create a mapping function that properly transforms DB rows to interface

---

## CORRECTED PLAN

### Phase 1: Fix Type Definitions (MUST DO FIRST)

**File: `src/types/chat.ts`**

Update `ChatThread` to match `q_threads` table:
```typescript
export interface ChatThread {
  row_id: string;
  name: string | null;  // Fixed: was 'title'
  root_prompt_row_id: string | null;  // Fixed: allow null
  openai_conversation_id: string | null;
  owner_id: string | null;  // Fixed: allow null
  is_active: boolean | null;  // Fixed: allow null
  last_message_at: string | null;
  created_at: string | null;  // Fixed: allow null
  updated_at?: string | null;
  // Additional columns from DB
  provider?: string | null;
  external_session_id?: string | null;
}
```

### Phase 2: Optimize Root Resolution (Frontend)

**File: `src/hooks/usePromptFamilyChat.ts`**

Replace lines 67-83:
```typescript
const computeRootPromptId = useCallback(async (pRowId: string): Promise<string> => {
  const { data, error } = await supabase
    .from('q_prompts')
    .select('root_prompt_row_id, parent_row_id')
    .eq('row_id', pRowId)
    .maybeSingle();
  
  if (error) {
    console.error('[computeRootPromptId] Query failed:', error);
    return pRowId;
  }
  
  if (data?.root_prompt_row_id) {
    return data.root_prompt_row_id;
  }
  
  // No parent means this IS the root
  if (!data?.parent_row_id) {
    return pRowId;
  }
  
  // Data corruption fallback
  console.warn('[computeRootPromptId] Missing root_prompt_row_id:', pRowId);
  return pRowId;
}, []);
```

### Phase 3: Optimize Root Resolution (Backend)

**File: `supabase/functions/_shared/familyThreads.ts`**

Replace lines 99-123:
```typescript
export async function resolveRootPromptId(
  supabase: any, 
  promptRowId: string
): Promise<string> {
  const { data, error } = await supabase
    .from(TABLES.PROMPTS)
    .select('root_prompt_row_id, parent_row_id')
    .eq('row_id', promptRowId)
    .maybeSingle();
  
  if (error) {
    console.error('[resolveRootPromptId] Query failed:', error);
    return promptRowId;
  }
  
  if (data?.root_prompt_row_id) {
    return data.root_prompt_row_id;
  }
  
  if (!data?.parent_row_id) {
    return promptRowId;
  }
  
  console.warn('[resolveRootPromptId] Missing root_prompt_row_id:', promptRowId);
  return promptRowId;
}
```

### Phase 4: Fix Race Condition

**File: `src/hooks/usePromptFamilyThreads.ts`**

Step 4a - Update interface (line 12):
```typescript
fetchThreads: () => Promise<string | null>;  // Changed from Promise<void>
```

Step 4b - Update function (lines 35-63):
```typescript
const fetchThreads = useCallback(async (): Promise<string | null> => {
  if (!rootPromptId) {
    setThreads([]);
    return null;
  }

  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;
    
    const { data, error } = await supabase
      .from('q_threads')
      .select('*')
      .eq('root_prompt_row_id', rootPromptId)
      .eq('owner_id', user.id)
      .eq('is_active', true)
      .order('last_message_at', { ascending: false, nullsFirst: false });

    if (error) throw error;
    setThreads((data || []) as ChatThread[]);
    
    // Auto-select first thread if none selected
    if (data?.length && !activeThreadIdRef.current) {
      setActiveThreadId(data[0].row_id);
      return data[0].row_id;  // Return the auto-selected ID
    }
    return activeThreadIdRef.current;  // Return current selection
  } catch (error) {
    console.error('Error fetching threads:', error);
    return null;
  }
}, [rootPromptId]);
```

**File: `src/hooks/usePromptFamilyChat.ts`**

Step 4c - Update interface (line 30):
```typescript
fetchThreads: () => Promise<string | null>;  // Changed from Promise<void>
```

Step 4d - Update effect (lines 202-216):
```typescript
try {
  // Fetch threads - returns auto-selected thread ID
  const autoSelectedId = await tm.fetchThreads();
  
  if (cancelled) return;
  
  // Fetch messages for the auto-selected thread
  if (autoSelectedId) {
    const messages = await tm.switchThread(autoSelectedId);
    if (!cancelled) {
      mm.setMessages(messages);
    }
  }
} catch (error) {
  console.error('Error in loadThreadAndMessages:', error);
}
```

### Phase 5: Update UI for Thread Name

**File: `src/components/chat/ThreadDropdown.tsx`** (if exists)

Ensure it uses `thread.name` not `thread.title` after the interface fix.

---

## TESTING CHECKLIST

1. **Root resolution**: Select a deeply nested child prompt, verify chat initializes in <500ms
2. **Thread auto-select**: On first load with existing threads, verify messages appear
3. **New thread creation**: Create new chat, verify messages clear and new thread is active
4. **Cascade execution**: Run a cascade, verify it uses the same optimized root resolution
5. **Type safety**: No TypeScript errors after interface changes
6. **Edge cases**:
   - Prompt with no threads (should create on first message)
   - Prompt that IS the root (should return self)
   - Rapidly switching prompts (race condition should be prevented)

---

## FILES TO MODIFY

1. `src/types/chat.ts` - Fix ChatThread interface
2. `src/hooks/usePromptFamilyChat.ts` - Optimize computeRootPromptId, fix effect
3. `src/hooks/usePromptFamilyThreads.ts` - Change fetchThreads return type
4. `supabase/functions/_shared/familyThreads.ts` - Optimize resolveRootPromptId

## FILES TO VERIFY (No Changes)

1. `src/components/chat/ThreadDropdown.tsx` - Verify uses `name` not `title`
2. `src/components/layout/ConversationPanel.tsx` - Verify thread display logic

---

## BUILD BLOCKER NOTE

The **TS6310** error in `tsconfig.json` is a platform infrastructure issue. A workaround exists in `vite.config.ts` using `esbuild.tsconfigRaw`. The proposed changes do not affect this blocker.

