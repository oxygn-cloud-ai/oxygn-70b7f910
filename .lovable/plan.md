
# Revised Plan: Fix PromptFamilyChat Concurrency with Prompt Execution

## Root Cause Analysis

After exhaustive investigation, the issue is confirmed:

### The Problem
Both `prompt-family-chat` (interactive chat) and `conversation-run` (prompt execution) call `getOrCreateFamilyThread()` with identical parameters:
- Same `root_prompt_row_id`
- Same `owner_id`
- Same `provider` ('openai')

This returns the **same thread row** from `q_threads`, meaning they share:
- `openai_conversation_id` (conv_xxx)
- `last_response_id` (resp_xxx chain)

When prompt execution runs, it updates `last_response_id`, breaking the chat's conversation chain. Subsequent chat requests fail because the `previous_response_id` no longer matches the current conversation state.

### Why q_prompt_family_threads Wasn't Used
The existing `q_prompt_family_threads` table was designed for chat isolation but **was never integrated** into `prompt-family-chat` edge function. Instead, both chat and execution incorrectly use `q_threads` via `familyThreads.ts`.

### Context Sharing (Already Works)
Chat already has access to prompt execution results via:
1. **familySummary** - includes `output_preview` for each prompt in the tree
2. **get_prompt_details** tool - returns full `output_response` from `q_prompts` table

Execution writes `output_response` to `q_prompts`, which chat can read. **No additional data synchronization is needed**.

---

## Solution: Add Purpose Parameter to Thread Isolation

Rather than migrate to `q_prompt_family_threads` (which would orphan existing chat history and require broader changes), we add a `purpose` column to `q_threads` to distinguish chat from execution threads within the existing architecture.

```text
┌─────────────────────────────────────────────────────────────────────────┐
│                        FIXED ARCHITECTURE                                │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│   q_threads (with purpose discrimination)                                │
│   ┌─────────────────────────────────────────────────────────────────┐   │
│   │ Row 1: purpose='chat', root_prompt_row_id="abc-123"             │   │
│   │        openai_conversation_id: "conv_chat_xxx"                  │   │
│   │        last_response_id: "resp_chat_yyy"                        │   │
│   └─────────────────────────────────────────────────────────────────┘   │
│   ┌─────────────────────────────────────────────────────────────────┐   │
│   │ Row 2: purpose='run', root_prompt_row_id="abc-123"              │   │
│   │        openai_conversation_id: "conv_run_xxx"                   │   │
│   │        last_response_id: "resp_run_yyy"                         │   │
│   └─────────────────────────────────────────────────────────────────┘   │
│                  │                              │                        │
│                  ▼                              ▼                        │
│   ┌──────────────────────────────────────┐    ┌─────────────────────┐   │
│   │ conversation-run (prompt execution)  │    │ prompt-family-chat  │   │
│   │ Uses purpose='run'                   │    │ Uses purpose='chat' │   │
│   └──────────────────────────────────────┘    └─────────────────────┘   │
│                                                                          │
│   ISOLATION: Each purpose has its own OpenAI conversation chain          │
│   Both can execute simultaneously without interference                   │
│                                                                          │
│   CONTEXT SHARING: Chat reads output_response from q_prompts             │
│   (already implemented via get_prompt_details tool)                      │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Implementation Plan

### Phase 1: Database Schema Update

**File: New Migration SQL**

```sql
-- Add purpose column to q_threads for track isolation
ALTER TABLE q_threads 
ADD COLUMN IF NOT EXISTS purpose text NOT NULL DEFAULT 'run';

-- Create composite index for efficient lookups
CREATE INDEX IF NOT EXISTS idx_threads_family_purpose 
ON q_threads(root_prompt_row_id, owner_id, provider, purpose, is_active)
WHERE is_active = true;

-- Update existing threads: assume all existing are 'run' (execution)
-- Chat threads will be created fresh on first use
COMMENT ON COLUMN q_threads.purpose IS 'Thread track: chat for interactive chat, run for prompt execution';
```

### Phase 2: Update Shared Thread Functions

**File: `supabase/functions/_shared/familyThreads.ts`**

Add `purpose` parameter to `getOrCreateFamilyThread`:

```typescript
// Type definition for purpose
export type ThreadPurpose = 'chat' | 'run';

export async function getOrCreateFamilyThread(
  supabase: any,
  rootPromptRowId: string,
  ownerId: string,
  promptName?: string,
  openAIApiKey?: string,
  provider: string = 'openai',
  purpose: ThreadPurpose = 'run'  // NEW: default to 'run' for backwards compatibility
): Promise<{ 
  row_id: string; 
  openai_conversation_id: string | null; 
  external_session_id: string | null; 
  last_response_id: string | null; 
  created: boolean;
  purpose: ThreadPurpose;
}> {
  // Query includes purpose filter
  const { data: existingThreads, error: findError } = await supabase
    .from(TABLES.THREADS)
    .select('row_id, openai_conversation_id, external_session_id, last_response_id, provider, purpose')
    .eq('root_prompt_row_id', rootPromptRowId)
    .eq('owner_id', ownerId)
    .eq('provider', provider)
    .eq('purpose', purpose)  // NEW FILTER
    .eq('is_active', true)
    .order('last_message_at', { ascending: false, nullsFirst: false })
    .limit(1);

  // ... rest of logic unchanged, but INSERT includes purpose
  const { data: newThread, error: createError } = await supabase
    .from(TABLES.THREADS)
    .insert({
      root_prompt_row_id: rootPromptRowId,
      owner_id: ownerId,
      name: threadName,
      is_active: true,
      openai_conversation_id: conversationId,
      external_session_id: externalSessionId,
      provider,
      purpose,  // NEW: store purpose
    })
    .select('row_id, openai_conversation_id, external_session_id, last_response_id, purpose')
    .maybeSingle();

  return { ...newThread, created: true };
}
```

Also update `getFamilyThread` and `clearFamilyThread` to accept `purpose` parameter.

### Phase 3: Update prompt-family-chat Edge Function

**File: `supabase/functions/prompt-family-chat/index.ts`**

Change thread acquisition to use `purpose='chat'`:

```typescript
// Line ~1100 - Pass purpose='chat'
const familyThread = await getOrCreateFamilyThread(
  supabase,
  rootId,
  validation.user!.id,
  'Chat',
  openAIApiKey,
  'openai',  // provider
  'chat'     // NEW: purpose
);
```

### Phase 4: Update conversation-run Edge Function

**File: `supabase/functions/conversation-run/index.ts`**

Explicitly pass `purpose='run'` (for clarity, even though it's the default):

```typescript
// Line ~2336 - Pass purpose='run' explicitly
const familyThread = await getOrCreateFamilyThread(
  supabase, 
  rootPromptRowId,
  validation.user.id,
  promptName,
  openAIApiKey,
  'openai',  // provider
  'run'      // NEW: explicit purpose
);
```

### Phase 5: Update Frontend Thread Hook

**File: `src/hooks/usePromptFamilyThreads.ts`**

Add purpose filter when fetching threads for chat UI:

```typescript
// Line 45-51 - Add purpose filter for chat
const { data, error } = await supabase
  .from('q_threads')
  .select('*')
  .eq('root_prompt_row_id', rootPromptId)
  .eq('owner_id', user.id)
  .eq('purpose', 'chat')  // NEW: only show chat threads
  .eq('is_active', true)
  .order('last_message_at', { ascending: false, nullsFirst: false });
```

### Phase 6: Update Type Definitions

**File: `src/types/chat.ts`**

Add purpose to ChatThread type:

```typescript
export type ThreadPurpose = 'chat' | 'run';

export interface ChatThread {
  row_id: string;
  name: string | null;
  root_prompt_row_id: string | null;
  openai_conversation_id: string | null;
  owner_id: string | null;
  is_active: boolean | null;
  last_message_at: string | null;
  created_at: string | null;
  updated_at?: string | null;
  provider?: string | null;
  external_session_id?: string | null;
  last_response_id?: string | null;
  purpose?: ThreadPurpose;  // NEW
}
```

---

## Files Summary

| File | Action | Description |
|------|--------|-------------|
| `supabase/migrations/[timestamp].sql` | CREATE | Add `purpose` column and index to q_threads |
| `supabase/functions/_shared/familyThreads.ts` | MODIFY | Add `purpose` parameter to thread functions |
| `supabase/functions/prompt-family-chat/index.ts` | MODIFY | Pass `purpose='chat'` when getting thread |
| `supabase/functions/conversation-run/index.ts` | MODIFY | Pass `purpose='run'` explicitly |
| `src/hooks/usePromptFamilyThreads.ts` | MODIFY | Filter by `purpose='chat'` in queries |
| `src/types/chat.ts` | MODIFY | Add `ThreadPurpose` type and update interface |

---

## Context Awareness (No Additional Work Needed)

Chat is already aware of execution results through:

1. **System Prompt Context**: `getFamilyDataOptimized()` loads all prompts including `output_preview` (first 200 chars of output_response)

2. **get_prompt_details Tool**: Returns full `output_response` for any prompt in the family

3. **Real-time Data**: Each chat request re-fetches `getFamilyDataOptimized()`, so it always has the latest execution results

**No additional synchronization mechanism is required.** The prompt's `output_response` field (in `q_prompts`) is the shared state between execution and chat.

---

## Backwards Compatibility

1. **Existing threads**: Default `purpose='run'`, so all existing threads continue to work for execution
2. **Chat threads**: Will be created fresh (with `purpose='chat'`) on first chat after deployment
3. **No data loss**: Execution history preserved; new chat sessions start fresh (acceptable since chat was broken anyway)

---

## Testing Verification

After implementation:
- [ ] Start a cascade run on a prompt family
- [ ] While cascade is running, open chat panel and send a message
- [ ] Chat should stream response without interruption
- [ ] Complete cascade, verify outputs stored in prompts
- [ ] Send another chat message asking about the outputs
- [ ] Chat should be able to retrieve output_response via get_prompt_details tool

---

## Technical Notes

### Why Not Use q_prompt_family_threads?

The `q_prompt_family_threads` table exists but was designed with different assumptions:
- Uses `prompt_row_id` not `root_prompt_row_id`
- Has `title` column instead of `name`
- Doesn't have `last_response_id` for OpenAI chaining
- Would require migrating/duplicating thread-manager logic

Adding `purpose` to existing `q_threads` is a minimal, surgical fix that:
- Reuses proven `getOrCreateFamilyThread` logic
- Maintains OpenAI Conversations API integration
- Requires only 6 file changes vs. potential 15+ for full migration

### Why Default to 'run'?

Backwards compatibility. All existing threads are for prompt execution. New chat threads will be created with `purpose='chat'` on first use after deployment.
