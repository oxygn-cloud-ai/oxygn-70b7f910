

# Chat "No Response" Root Cause Analysis & Fix Plan

## Diagnosis Summary

After tracing the complete chat flow from user input → edge function → OpenAI → SSE streaming → UI rendering, I identified:

**The new debug logging is NOT appearing in console** — even though progress and heartbeat logs are showing. This indicates the preview may be running a partially stale build, or there's a build error blocking the latest changes.

**The edge function successfully connects to OpenAI** — it receives a `status: queued` response and starts streaming. Heartbeats are being sent every 10 seconds.

**The client is closing the connection prematurely** — edge function logs show `SSE stream cancelled by client: Http: connection closed before message completed`.

## Root Causes Identified

### 1. Build Error (Blocking)
```
tsconfig.json(32,5): error TS6310: Referenced project '/dev-server/tsconfig.node.json' may not disable emit.
```
This platform-level TypeScript error may be causing partial or failed builds, resulting in stale code running in the preview.

### 2. Missing Debug Log Output
The new debug logs at critical points:
- `[ChatStream] Starting fetch to prompt-family-chat`
- `[ChatStream] Response status: 200 ok: true`
- `[ChatStream] Stream ended, fullContent length: X`

...are NOT appearing in the console, even though:
- `[ChatStream] Progress: Calling AI model...`
- `[ChatStream] Heartbeat: 10208 ms`

ARE appearing. This is logically inconsistent and suggests a build issue.

### 3. Stream Content Not Being Received
The edge function logs show:
- "Initial response: resp_xxx status: queued" 
- Then nothing else

OpenAI's response is stuck in "queued" and never transitions to streaming content. The edge function waits, but no `output_text_delta` events are received from OpenAI.

## Fix Plan

### Step 1: Force Complete Rebuild
Trigger a rebuild to ensure all latest code changes are deployed. The TS6310 error is a known platform constraint that should resolve on rebuild.

### Step 2: Add OpenAI Stream Entry Logging
The edge function needs logging when it enters the streaming function to track where it gets stuck:

**File**: `supabase/functions/prompt-family-chat/index.ts`

Add at line 632 (inside `streamOpenAIResponse`):
```typescript
console.log('Starting stream fetch for response:', responseId);
```

Add at line 651 (after stream response check):
```typescript
console.log('Stream response received, status:', streamResponse.status);
```

Add at line 672 (inside the while loop):
```typescript
console.log('Reading stream chunk...');
```

### Step 3: Add Client-Side Abort Detection
Add logging when the fetch is aborted to identify what triggers the cancellation:

**File**: `src/hooks/usePromptFamilyChatStream.ts`

Add inside the AbortController setup (around line 98):
```typescript
abortControllerRef.current.signal.addEventListener('abort', () => {
  console.log('[ChatStream] Fetch aborted - signal received');
});
```

### Step 4: Verify Thread State
The `handleSend` function creates a thread if one doesn't exist. If thread creation succeeds but returns an unexpected state, the message won't be sent:

**File**: `src/components/layout/ConversationPanel.tsx`

Add after the thread creation block (line 175):
```typescript
console.log('[Chat] Thread state after creation:', {
  threadId,
  activeThreadId: promptFamilyChat.activeThreadId,
  messages: promptFamilyChat.messages.length
});
```

### Step 5: Check OpenAI Response Streaming Behavior
The OpenAI Responses API may not immediately start streaming for "queued" responses. Add polling logging:

**File**: `supabase/functions/prompt-family-chat/index.ts`

Enhance `pollForCompletion` function (around line 563) with more detailed logging:
```typescript
console.log('Polling iteration - elapsed:', Math.round((Date.now() - startTime) / 1000), 's, status:', data?.status);
```

## Testing After Implementation

1. **Check console for ALL debug logs** appearing in correct sequence:
   - `[Chat] handleSend - activeThreadId: xxx`
   - `[Chat] Sending message to thread: xxx`
   - `[ChatStream] Starting fetch to prompt-family-chat`
   - `[ChatStream] Response status: 200 ok: true`
   - (Progress/Heartbeat events)
   - `[ChatStream] Stream ended, fullContent length: X`
   - `[Chat] sendMessage completed`

2. **Check edge function logs** for:
   - `Starting stream fetch for response: resp_xxx`
   - `Stream response received, status: 200`
   - `Reading stream chunk...` (should appear multiple times)
   - `Final content length: X`
   - `Closing SSE stream`

3. **Verify UI shows response** after stream ends

## Files to Modify

| File | Changes |
|------|---------|
| `supabase/functions/prompt-family-chat/index.ts` | Add streaming entry/exit logs |
| `src/hooks/usePromptFamilyChatStream.ts` | Add abort signal listener |
| `src/components/layout/ConversationPanel.tsx` | Add thread state logging |

