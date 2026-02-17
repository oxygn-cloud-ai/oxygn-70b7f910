
## Fix: Chat Permanently Stuck After Background Completion

### Root Cause

Two independent bugs create a permanent stall condition in the conversation panel:

**Bug A: `poll-openai-response` loses output text (Edge Function)**

When the poll edge function detects a terminal status and writes it to the DB, but `extractContent` returns `null` for the output text (observed in 7/10 recent prompt-family-chat completions), the DB row gets `status: completed, output_text: NULL`.

Additionally, on subsequent polls (line 152-159), if the DB row is already terminal, the function short-circuits and returns `{ status: 'completed', output_text: null }` without querying `output_text` from the DB or re-fetching from OpenAI. So even if the webhook later writes the output, the poll never returns it.

The initial DB query at line 124-128 only selects `row_id, status, owner_id, prompt_row_id` — it does NOT select `output_text`. So the early-return path can never return the output.

**Bug B: `usePromptFamilyChat.ts` has no fallback for completed-but-empty (Client)**

The webhook completion effect (line 159) checks `webhookComplete && webhookOutput`. When `webhookOutput` is null (as per Bug A), neither the success path nor the failure path executes. The 10-minute timeout only triggers for `status: 'pending'`, so it never fires for `status: 'completed'`. The UI remains in `isWaitingForWebhook: true` permanently.

### Fix

**File: `supabase/functions/poll-openai-response/index.ts`**

1. Change the initial DB query (line 124-128) to also select `output_text`:
   ```
   .select('row_id, status, owner_id, prompt_row_id, output_text')
   ```

2. Fix the already-terminal early return (line 152-159) to include the output text from the DB:
   ```
   return { status: pendingRow.status, reasoning_text: null, output_text: pendingRow.output_text || null }
   ```

3. Add a fallback when `extractContent` returns null for a completed response: re-fetch from OpenAI with `include` parameter or attempt to get text from any content block type (not just `output_text`). Specifically, also check for `block.type === 'text'` in case OpenAI uses a different content type for some response formats.

**File: `src/hooks/usePromptFamilyChat.ts`**

4. Add a fallback in the webhook completion effect (after the existing `if (webhookComplete && webhookOutput)` block): handle `webhookComplete && !webhookOutput` as a "completed but output missing" case. In this case:
   - Fetch messages from the thread history via `fetchMessages(threadId)` to recover the response from OpenAI's server-side state
   - Reset the streaming/webhook state
   - Show a warning toast indicating the response was recovered from history

This ensures that even if the poll/webhook fails to write output_text, the chat recovers by pulling the conversation history directly.

### Technical Details

**`supabase/functions/poll-openai-response/index.ts`**

Lines 124-128 (DB query):
```typescript
// BEFORE:
.select('row_id, status, owner_id, prompt_row_id')

// AFTER:
.select('row_id, status, owner_id, prompt_row_id, output_text')
```

Lines 152-159 (early return):
```typescript
// BEFORE:
return { status: pendingRow.status, reasoning_text: null, output_text: null }

// AFTER:
return { status: pendingRow.status, reasoning_text: null, output_text: pendingRow.output_text || null }
```

Lines 42-62 (`extractContent`): Add fallback for `block.type === 'text'`:
```typescript
if (item.type === 'message' && Array.isArray(item.content)) {
  for (const block of item.content) {
    if ((block.type === 'output_text' || block.type === 'text') && typeof block.text === 'string') {
      outputText += block.text;
    }
  }
}
```

**`src/hooks/usePromptFamilyChat.ts`**

Lines 159-194 (webhook effect): Add fallback after the existing success condition:
```typescript
if (webhookComplete && webhookOutput) {
  // ... existing success handling ...
} else if (webhookComplete && !webhookOutput) {
  // Completed but output missing - recover from thread history
  processedWebhookRef.current = pendingId;
  const threadId = threadManagerRef.current.activeThreadId;
  if (threadId) {
    try {
      const freshMessages = await messageManagerRef.current.fetchMessages(threadId);
      // fetchMessages already calls setMessages internally
    } catch (e) {
      console.error('[PromptFamilyChat] Failed to recover messages from history:', e);
    }
  }
  streamManagerRef.current.resetStreamState();
  clearPendingResponse();
  notify.warning('Response recovered from history', {
    source: 'WebhookCompletion',
    description: 'Output was not captured directly. Messages loaded from conversation history.',
  });
} else if (webhookFailed) {
  // ... existing failure handling ...
}
```

Note: `fetchMessages` is async, so the effect will need to handle this. Since React effects cannot be async directly, the async call should be wrapped in an immediately-invoked async function.

### Scope

- `supabase/functions/poll-openai-response/index.ts` — 3 changes
- `src/hooks/usePromptFamilyChat.ts` — 1 change (webhook effect fallback)
- No database changes
- No other files modified
