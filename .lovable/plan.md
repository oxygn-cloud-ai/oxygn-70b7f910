

# Remediation Plan: Fix Thread Purpose Propagation

## Problem Summary
The implementation added `purpose` column isolation to `familyThreads.ts` and the edge functions, but failed to:
1. Update `thread-manager` to accept and store `purpose`
2. Update `usePromptFamilyThreads.createThread` to pass `purpose='chat'`
3. Update `usePromptFamilyThreads.createThread` deactivation to filter by purpose

## Phase 1: Update thread-manager Edge Function

### File: `supabase/functions/thread-manager/index.ts`

**Change 1 - Accept purpose parameter in create action (lines 156-196):**

```typescript
// Line 157 - extract purpose from body
const { assistant_row_id, child_prompt_row_id, name, root_prompt_row_id, purpose } = body;

// Line 170 - include purpose in insert
const { data: savedThread, error: saveError } = await supabase
  .from(TABLES.THREADS)
  .insert({
    assistant_row_id,
    child_prompt_row_id,
    root_prompt_row_id,
    openai_conversation_id: conversationId,
    name: threadName,
    is_active: true,
    owner_id: validation.user?.id,
    purpose: purpose || 'run',  // NEW: default to 'run' for backwards compatibility
  })
  .select()
  .maybeSingle();
```

**Change 2 - Update list action to accept purpose filter (lines 199-236):**

```typescript
// Line 200 - extract purpose
const { assistant_row_id, child_prompt_row_id, root_prompt_row_id, purpose } = body;

// After line 218 - add purpose filter
if (purpose) {
  query = query.eq('purpose', purpose);
}
```

## Phase 2: Update Frontend createThread

### File: `src/hooks/usePromptFamilyThreads.ts`

**Change 1 - Pass purpose to thread-manager (lines 91-97):**

```typescript
const response = await supabase.functions.invoke('thread-manager', {
  body: {
    action: 'create',
    root_prompt_row_id: rootPromptId,
    name: title,
    purpose: 'chat',  // NEW: explicitly create chat threads
  }
});
```

**Change 2 - Add purpose filter to deactivation query (lines 78-83):**

```typescript
const { error: deactivateError } = await supabase
  .from('q_threads')
  .update({ is_active: false })
  .eq('root_prompt_row_id', rootPromptId)
  .eq('owner_id', user.id)
  .eq('purpose', 'chat')  // NEW: only deactivate chat threads
  .eq('is_active', true);
```

## Phase 3: Deploy and Verify

1. Deploy updated `thread-manager` edge function
2. Test: Create new chat thread → verify it appears in thread list
3. Test: Create chat thread while run thread exists → verify run thread is NOT deactivated
4. Test: Chat isolation with concurrent prompt execution

## Files to Modify

| File | Lines | Change |
|------|-------|--------|
| `supabase/functions/thread-manager/index.ts` | 157, 170-177 | Accept and store `purpose` in create action |
| `supabase/functions/thread-manager/index.ts` | 200, 218+ | Add `purpose` filter to list action |
| `src/hooks/usePromptFamilyThreads.ts` | 91-97 | Pass `purpose: 'chat'` to thread-manager |
| `src/hooks/usePromptFamilyThreads.ts` | 78-83 | Add `.eq('purpose', 'chat')` to deactivation query |

## Risk Assessment
- **Low risk**: Changes are additive and backwards compatible
- **Default behavior preserved**: `purpose: 'run'` default ensures existing code works
- **No data migration needed**: Existing threads retain `purpose='run'`

