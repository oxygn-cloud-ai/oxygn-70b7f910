

# Fix: Reading Pane GPT-5 Response Delivery

## Problem

When a GPT-5 request is triggered from the Reading Pane, `MainLayout.handleRunPrompt` now correctly shows an info toast ("Background processing started") and exits early. However, when the `openai-webhook` edge function later delivers the result and writes `output_response` to `q_prompts`, the UI never refreshes -- the user sees stale/empty output until they manually re-select the prompt.

The Conversation Panel path works because `usePromptFamilyChat` uses `usePendingResponseSubscription` to listen for Realtime updates on `q_pending_responses`. The Reading Pane path has no equivalent listener.

## Solution

Add a `usePendingResponseSubscription` watcher in `MainLayout` that:
1. Activates when a `long_running` interrupt sets a pending `responseId`
2. Listens for the webhook to mark the response as `completed` or `failed`
3. On completion: refreshes the prompt data so the output field updates, shows a success toast, and clears the subscription
4. On failure: shows an error toast and clears the subscription

## Changes

### 1. `src/pages/MainLayout.tsx` -- Add state + hook

Near the existing state declarations (around line 130), add:

```typescript
const [pendingWebhookResponseId, setPendingWebhookResponseId] = useState<string | null>(null);
const [pendingWebhookPromptId, setPendingWebhookPromptId] = useState<string | null>(null);
```

Import and call `usePendingResponseSubscription`:

```typescript
import { usePendingResponseSubscription } from '@/hooks/usePendingResponseSubscription';

// Near the other hooks:
const {
  isComplete: webhookComplete,
  isFailed: webhookFailed,
  outputText: webhookOutputText,
  errorMessage: webhookErrorMessage,
  clearPendingResponse: clearWebhookPending,
} = usePendingResponseSubscription(pendingWebhookResponseId);
```

### 2. `src/pages/MainLayout.tsx` -- Update the long_running handler (line 440)

In the existing `long_running` interrupt block, set the pending state before returning:

```typescript
if (result?.interrupted && result.interruptType === 'long_running') {
  const responseId = result.interruptData?.responseId;
  
  // ... existing tracing code stays the same ...
  
  // Activate Realtime subscription to receive webhook result
  setPendingWebhookResponseId(responseId || null);
  setPendingWebhookPromptId(promptId);
  
  toast.info('Background processing started', {
    description: 'GPT-5 is processing your request. The response will appear automatically when ready.',
    duration: 5000,
  });
  
  endSingleRun();
  setRunStartingFor(null);
  return;
}
```

### 3. `src/pages/MainLayout.tsx` -- Add effect to handle webhook completion

Add a `useEffect` that reacts to the subscription state:

```typescript
useEffect(() => {
  if (!pendingWebhookResponseId) return;
  
  if (webhookComplete && webhookOutputText) {
    toast.success('Background response received', {
      description: webhookOutputText.slice(0, 100) + (webhookOutputText.length > 100 ? '...' : ''),
      duration: 5000,
    });
    
    // Refresh prompt data if the completed prompt is currently selected
    if (pendingWebhookPromptId && pendingWebhookPromptId === selectedPromptId) {
      fetchItemData(pendingWebhookPromptId).then(data => {
        if (data) setSelectedPromptData(data);
      });
    }
    
    // Clean up
    setPendingWebhookResponseId(null);
    setPendingWebhookPromptId(null);
    clearWebhookPending();
  }
  
  if (webhookFailed) {
    toast.error('Background request failed', {
      description: webhookErrorMessage || 'The background AI request did not complete successfully.',
      duration: 8000,
    });
    
    setPendingWebhookResponseId(null);
    setPendingWebhookPromptId(null);
    clearWebhookPending();
  }
}, [webhookComplete, webhookFailed, webhookOutputText, webhookErrorMessage,
    pendingWebhookResponseId, pendingWebhookPromptId, selectedPromptId,
    fetchItemData, clearWebhookPending]);
```

## What This Changes

- `src/pages/MainLayout.tsx` only -- adds ~40 lines of state management and an effect

## What This Does NOT Change

- No edge function changes
- No database changes
- No changes to `usePendingResponseSubscription` (reused as-is)
- No changes to the Conversation Panel webhook path
- No changes to `useConversationRun` or `usePromptFamilyChatStream`
- No changes to the cascade execution path

## How It Works End-to-End

```text
User clicks Run (GPT-5 prompt)
  -> conversation-run returns long_running_started SSE
  -> MainLayout sets pendingWebhookResponseId = responseId
  -> usePendingResponseSubscription subscribes to q_pending_responses via Realtime
  -> toast.info("Background processing started")
  
  ... minutes later ...
  
OpenAI webhook fires
  -> openai-webhook writes output to q_prompts.output_response
  -> openai-webhook updates q_pending_responses status = 'completed'
  -> Realtime pushes UPDATE to usePendingResponseSubscription
  -> useEffect detects webhookComplete = true
  -> Refreshes prompt data (fetchItemData)
  -> toast.success("Background response received")
  -> Clears subscription
```

