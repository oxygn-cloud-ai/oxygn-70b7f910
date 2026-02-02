

# Adversarial Audit of Long-Running Operation Fix Plan

## Audit Findings

### 1. CRITICAL: Plan References Non-Existent Status Value

**Finding:** The plan proposes updating the dashboard with `status: 'pending_webhook'` (Phase 2), but `LiveApiDashboardContext.tsx` has no such status value defined, and no search results find `pending_webhook` anywhere in the codebase.

**Risk:** Invalid status value will either be silently ignored or cause unexpected behavior.

**Remediation:** Use an existing status value (e.g., `'waiting_for_webhook'` or `'queued'`) OR document that dashboard status is informational and any string is acceptable.

---

### 2. CRITICAL: `usePendingResponseSubscription` Is Never Used

**Finding:** The hook `usePendingResponseSubscription.ts` exists but is **never imported anywhere** in the codebase. Search for `import.*usePendingResponseSubscription` returns zero matches.

**Risk:** The hook has never been tested in production. May contain latent bugs.

**Implication:** The plan correctly identifies this hook for reuse, but verification is needed that it actually works.

---

### 3. HIGH: Type Safety Violations in Proposed Return Interface

**Finding:** The plan proposes adding `pendingResponseId: string | null` and `isWaitingForWebhook: boolean` to `UsePromptFamilyChatStreamReturn`, but:

1. The stream hook does NOT currently have a `clearPendingResponse` method
2. The plan's Phase 3 code references `pendingResponseId` without declaring it in state
3. Missing type exports for `UsePromptFamilyChatStreamReturn`

**Remediation:** Add complete type definitions:

```typescript
export interface UsePromptFamilyChatStreamReturn {
  // ... existing fields ...
  pendingResponseId: string | null;
  isWaitingForWebhook: boolean;
  clearPendingResponse: () => void;
}
```

---

### 4. HIGH: Race Condition in Proposed Effect

**Finding:** The plan's Phase 4 effect in `usePromptFamilyChat.ts` has a dependency bug:

```typescript
useEffect(() => {
  if (!streamManager.pendingResponseId) return;
  // ...
}, [isComplete, isFailed, outputText, errorMessage, streamManager, threadManager, messageManager]);
```

**Problems:**
1. `streamManager` is a new object on every render (not stable reference)
2. Effect will re-run excessively due to object identity changes
3. Missing `clearPendingResponse` from usePendingResponseSubscription in cleanup

**Remediation:** Use refs for stable hook references (already established pattern in file), or extract only primitive values.

---

### 5. MEDIUM: Existing Pattern in `useConversationRun` Not Followed

**Finding:** `useConversationRun.ts` (lines 178-189) already handles `long_running_started` by:
1. Setting `result.interrupted = true`
2. Setting `result.interruptType = 'long_running'`
3. Setting `result.interruptData.responseId`

The prompt family chat stream should follow this same pattern for architectural consistency.

**Risk:** Divergent patterns create maintenance burden and confusion.

**Remediation:** Align the prompt family chat implementation with the existing interrupt pattern.

---

### 6. MEDIUM: UI Component Missing from Plan

**Finding:** The plan proposes adding a "Processing in background..." indicator to `ConversationPanel.tsx` but:

1. Does not show where this fits relative to existing indicators (lines 349-391)
2. Does not handle the transition from "Processing" back to normal state
3. `isWaitingForWebhook` is not currently exposed from `usePromptFamilyChat`

**Remediation:** Specify exact insertion point (after line 377, before tool activity indicator).

---

### 7. LOW: Incomplete Cleanup on Thread Switch

**Finding:** When user switches threads while waiting for webhook:
- `usePendingResponseSubscription` cleanup happens (via responseId change)
- But streaming state (`isWaitingForWebhook`) may not reset

**Remediation:** Add cleanup in `switchThread` function in `usePromptFamilyChat.ts`.

---

### 8. LOW: Missing Toast Deduplication

**Finding:** The plan calls `notify.info('Processing in background')` in the stream hook, but then `notify.success('AI response received')` when webhook completes. If both fire in quick succession (webhook is fast), user gets confusing duplicate toasts.

**Remediation:** Add conditional: only show success toast if webhook mode was active.

---

### 9. TRIVIAL: Incorrect Code in Phase 3

**Finding:** The plan's Phase 3 code block references variables that don't exist:
- `isWaitingForWebhook` read before it's declared in state
- `unregisterCall()` called but variable is named `unregisterCall` in the try block only

**Remediation:** Ensure variable scope is correct in implementation.

---

### 10. OMISSION: No Realtime Publication Check

**Finding:** The plan assumes `q_pending_responses` table is enabled for Supabase Realtime, but this is not verified.

**Remediation:** Verify via migration or manual check that table has:
```sql
ALTER PUBLICATION supabase_realtime ADD TABLE public.q_pending_responses;
```

---

## Revised Implementation Plan

### Phase 1: Extend Stream Hook Types and State

**File:** `src/hooks/usePromptFamilyChatStream.ts`

**Changes:**

1. Add state variables (after line 42):
```typescript
const [pendingResponseId, setPendingResponseId] = useState<string | null>(null);
const [isWaitingForWebhook, setIsWaitingForWebhook] = useState(false);
```

2. Add clear function (after line 66):
```typescript
const clearPendingState = useCallback(() => {
  setPendingResponseId(null);
  setIsWaitingForWebhook(false);
}, []);
```

3. Update `resetStreamState` (line 58-66) to also reset pending state:
```typescript
const resetStreamState = useCallback(() => {
  console.log('[ChatStream] RESET called');
  setStreamingMessage('');
  setThinkingText('');
  setToolActivity([]);
  setIsStreaming(false);
  setIsExecutingTools(false);
  setPendingResponseId(null);      // ADD
  setIsWaitingForWebhook(false);   // ADD
  toolActivityCountRef.current = 0;
}, []);
```

4. Update return interface (line 16-32):
```typescript
export interface UsePromptFamilyChatStreamReturn {
  isStreaming: boolean;
  streamingMessage: string;
  thinkingText: string;
  toolActivity: ToolActivity[];
  isExecutingTools: boolean;
  pendingResponseId: string | null;      // ADD
  isWaitingForWebhook: boolean;          // ADD
  sendMessage: (
    userMessage: string,
    threadId: string,
    promptRowId: string,
    model: string | null,
    reasoningEffort: string,
    callbacks: StreamCallbacks
  ) => Promise<string | null>;
  cancelStream: () => void;
  resetStreamState: () => void;
  clearPendingState: () => void;         // ADD
}
```

5. Update return statement (lines 400-409):
```typescript
return {
  isStreaming,
  streamingMessage,
  thinkingText,
  toolActivity,
  isExecutingTools,
  pendingResponseId,          // ADD
  isWaitingForWebhook,        // ADD
  sendMessage,
  cancelStream,
  resetStreamState,
  clearPendingState,          // ADD
};
```

---

### Phase 2: Add `onLongRunningStarted` Handler

**File:** `src/hooks/usePromptFamilyChatStream.ts`

**Location:** After line 306 (inside the parseSSELine callbacks object)

**Add handler:**
```typescript
onLongRunningStarted: (responseId, message) => {
  console.log('[ChatStream] Long-running operation started:', responseId);
  setPendingResponseId(responseId);
  setIsWaitingForWebhook(true);
  
  // Notify user
  notify.info('Processing in background', {
    source: 'ChatStream',
    description: message || 'You will be notified when complete.',
  });
},
```

---

### Phase 3: Handle Webhook Mode Stream End

**File:** `src/hooks/usePromptFamilyChatStream.ts`

**Location:** Modify lines 312-324 (after stream reading completes)

**Replace with:**
```typescript
console.log('[ChatStream] Stream ended, fullContent length:', fullContent.length);

// Check if this was a webhook handoff (stream ended but we're waiting for webhook)
if (pendingResponseId && !fullContent.trim()) {
  console.log('[ChatStream] Webhook handoff complete, waiting for Realtime update');
  // Cleanup stream resources but keep isStreaming and isWaitingForWebhook
  if (streamingFlushTimeout) {
    clearTimeout(streamingFlushTimeout);
    streamingFlushTimeout = null;
  }
  clearTimeout(fetchTimeoutId);
  abortControllerRef.current = null;
  unregisterCall();
  // Don't call resetStreamState - keep streaming indicators active
  // Don't show success toast - that comes from webhook completion handler
  // Return null to indicate async completion path
  return null;
}

// Normal completion path (existing logic)
if (fullContent.trim().length > 0) {
  console.log('[ChatStream] Adding assistant message to chat');
  await callbacks.onMessageComplete(fullContent, threadId);
} else if (toolActivityCountRef.current === 0) {
  console.warn('[ChatStream] Empty response received');
  notify.warning('No response received', {
    source: 'usePromptFamilyChatStream',
    description: 'The AI returned an empty response. Please try again.',
  });
}
```

---

### Phase 4: Integrate Realtime Subscription in Orchestrator

**File:** `src/hooks/usePromptFamilyChat.ts`

**Changes:**

1. Add import (line 8):
```typescript
import { usePendingResponseSubscription } from './usePendingResponseSubscription';
import { notify } from '@/contexts/ToastHistoryContext';
```

2. Add subscription hook (after line 52):
```typescript
// Subscribe to pending response updates for webhook mode
const { 
  isComplete: webhookComplete, 
  isFailed: webhookFailed, 
  outputText: webhookOutput, 
  errorMessage: webhookError,
  clearPendingResponse 
} = usePendingResponseSubscription(streamManager.pendingResponseId);
```

3. Add effect to handle webhook completion (after line 108, before the consolidated effect):
```typescript
// Handle webhook completion
useEffect(() => {
  const pendingId = streamManager.pendingResponseId;
  if (!pendingId) return;
  
  if (webhookComplete && webhookOutput) {
    // Add the assistant message
    const threadId = threadManager.activeThreadId;
    if (threadId) {
      messageManager.addMessage('assistant', webhookOutput, threadId);
      
      // Update thread timestamp
      supabase
        .from('q_threads')
        .update({ last_message_at: new Date().toISOString() })
        .eq('row_id', threadId);
    }
    
    // Reset all states
    streamManager.resetStreamState();
    clearPendingResponse();
    
    notify.success('AI response received', {
      source: 'WebhookCompletion',
      description: webhookOutput.slice(0, 100) + (webhookOutput.length > 100 ? '...' : ''),
    });
  } else if (webhookFailed) {
    // Reset states and show error
    streamManager.resetStreamState();
    clearPendingResponse();
    
    notify.error(webhookError || 'Background processing failed', {
      source: 'WebhookCompletion',
      errorCode: 'WEBHOOK_FAILED',
    });
  }
}, [webhookComplete, webhookFailed, webhookOutput, webhookError, clearPendingResponse]);
```

4. Update switchThread to clear pending state (line 110-116):
```typescript
const switchThread = useCallback(async (threadId: string): Promise<void> => {
  messageManager.clearMessages();
  streamManager.resetStreamState();
  clearPendingResponse();  // ADD: Clear pending response on thread switch
  const messages = await threadManager.switchThread(threadId);
  messageManager.setMessages(messages);
}, [threadManager, messageManager, streamManager, clearPendingResponse]);
```

5. Update return interface (line 10-40) - add new properties:
```typescript
export interface UsePromptFamilyChatReturn {
  // ... existing ...
  isWaitingForWebhook: boolean;  // ADD
  pendingResponseId: string | null;  // ADD
}
```

6. Update return statement (lines 251-281):
```typescript
return {
  // ... existing ...
  isWaitingForWebhook: streamManager.isWaitingForWebhook,  // ADD
  pendingResponseId: streamManager.pendingResponseId,       // ADD
};
```

---

### Phase 5: Update UI Component

**File:** `src/components/layout/ConversationPanel.tsx`

**Changes:**

1. Extract new state from hook (after line 86):
```typescript
const isWaitingForWebhook = usePromptFamilyMode ? promptFamilyChat.isWaitingForWebhook : false;
```

2. Add webhook waiting indicator (insert after line 377, before tool activity indicator):
```typescript
{/* Webhook waiting indicator */}
{isWaitingForWebhook && usePromptFamilyMode && (
  <div className="flex justify-start">
    <div className="max-w-[85%] px-2.5 py-2 bg-surface-container rounded-m3-lg space-y-1.5">
      <div className="flex items-center gap-1.5 text-[10px] text-on-surface-variant">
        <Loader2 className="h-3 w-3 text-primary animate-spin" />
        <span className="font-medium">Processing in background...</span>
      </div>
      <div className="text-[10px] text-on-surface-variant/70">
        Complex request submitted. You'll be notified when complete.
      </div>
    </div>
  </div>
)}
```

3. Update isSending logic (line 79-81) to include webhook waiting:
```typescript
const isSending = usePromptFamilyMode 
  ? (promptFamilyChat.isStreaming || promptFamilyChat.isExecutingTools || promptFamilyChat.isWaitingForWebhook)
  : legacyIsSending;
```

---

## Files to Modify (Summary)

| File | Line Ranges | Change Type |
|------|-------------|-------------|
| `src/hooks/usePromptFamilyChatStream.ts` | 16-32, 42, 58-66, 306, 312-324, 400-409 | Add state, handler, early return, exports |
| `src/hooks/usePromptFamilyChat.ts` | 8, 10-40, 52, 108, 110-116, 251-281 | Import, subscribe, effect, cleanup, exports |
| `src/components/layout/ConversationPanel.tsx` | 79-81, 86, 377 | State extraction, indicator, sending logic |

---

## Pre-Implementation Verification Required

1. **Realtime publication**: Verify `q_pending_responses` is in `supabase_realtime` publication
2. **RLS policies**: Confirm users can SELECT from `q_pending_responses` where `owner_id = auth.uid()`
3. **Webhook delivery**: Confirm OpenAI webhook is correctly configured to hit `openai-webhook` edge function

---

## Testing Checklist

1. **Trigger webhook mode**: Use GPT-5 with `reasoning_effort: high`
2. **Verify SSE event**: Console shows `[ChatStream] Long-running operation started`
3. **Verify UI**: "Processing in background" indicator appears
4. **Verify database**: `q_pending_responses` record exists with `status: pending`
5. **Verify Realtime**: When webhook updates record, console shows `[usePendingResponseSubscription] Update`
6. **Verify message**: Assistant message appears in chat
7. **Verify cleanup**: Switching threads clears pending state
8. **Verify error path**: Simulate failed webhook, verify error toast

