
# Fix: False Success Toast for GPT-5 Background/Webhook Responses

## Problem

When a GPT-5 request is initiated from the Reading Pane (single prompt run via `MainLayout.handleRunPrompt`), the `conversation-run` edge function returns early with an SSE event `{ type: 'long_running_started', response_id: '...' }`. The `useConversationRun` hook correctly parses this and returns an interrupt result:

```typescript
{
  interrupted: true,
  interruptType: 'long_running',
  interruptData: { responseId: '...', message: '...' }
}
```

However, `MainLayout.tsx` only checks for `interruptType === 'question'` (line 411). The `long_running` interrupt falls through to `break` at line 439 ("Normal completion"), then hits the success toast at line 502 which displays `unknown | 0 tokens | 9010ms | stop` because the result has no `model`, `usage`, or `finish_reason` fields.

Additionally, the tracing logic at lines 476-488 records a "success" span with empty output and zero tokens for what is actually an in-progress background operation.

## Root Cause

Missing `interruptType === 'long_running'` handling in the question loop at lines 410-439 of `MainLayout.tsx`.

## Fix (1 file, 1 change)

### `src/pages/MainLayout.tsx` -- lines 436-439

After the existing question interrupt handler (line 435: `continue;`), add a check for `long_running` interrupts before the `break`:

```typescript
          continue; // Loop again with answer
        }
        
        // Check for long-running/webhook interrupt (GPT-5 background mode)
        if (result?.interrupted && result.interruptType === 'long_running') {
          const responseId = result.interruptData?.responseId;
          
          // Complete tracing span as 'deferred' -- actual result arrives via webhook
          tracingResult = await tracingPromise;
          const { traceId, spanId } = tracingResult;
          if (spanId) {
            await completeSpan({
              span_id: spanId,
              status: 'success',
              openai_response_id: responseId,
              output: '[deferred to webhook]',
              latency_ms: Date.now() - startTime,
            }).catch(err => console.warn('Failed to complete span:', err));
          }
          if (traceId) {
            await completeTrace({
              trace_id: traceId,
              status: 'completed',
            }).catch(err => console.warn('Failed to complete trace:', err));
          }
          
          toast.info('Background processing started', {
            description: 'GPT-5 is processing your request. The response will appear automatically when ready.',
            duration: 5000,
          });
          
          endSingleRun();
          setRunStartingFor(null);
          return; // Exit handleRunPrompt entirely -- webhook handler delivers the result
        }
        
        // Normal completion - break the loop
        break;
```

This early-returns from `handleRunPrompt`, which:
1. Prevents the false success toast (lines 502-505)
2. Prevents recording zero-token cost data (lines 508-522)
3. Prevents action execution on empty response (lines 529+)
4. Shows an info toast so the user knows the request is being processed in the background
5. Records the tracing span with a `[deferred to webhook]` marker so the trace is not left dangling

## What This Does NOT Change

- No changes to the webhook signature validation or `openai-webhook` edge function
- No changes to `useConversationRun.ts` (it already handles `long_running_started` correctly)
- No changes to `usePromptFamilyChatStream.ts` (the Conversation Panel chat path already handles webhook handoff correctly at line 346-361)
- No changes to the `usePendingResponseSubscription` hook
- No changes to any other edge function or database table
- No changes to the question interrupt flow
- No changes to the cascade execution path

## Scope Verification

- Only `src/pages/MainLayout.tsx` is modified
- The Conversation Panel (chat) path in `usePromptFamilyChatStream.ts` already handles this correctly by detecting `longRunningResponseId`, skipping the success toast, and waiting for the Realtime subscription -- no changes needed there
- The `PromptFieldsTab.tsx` generate button uses `useConversationRun` directly but through its own handler which does not go through `MainLayout.handleRunPrompt`, so it is unaffected by this change
