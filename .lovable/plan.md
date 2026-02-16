

## Fix: executeChildCascade Does Not Wait for GPT-5 Background Responses

### Root Cause

When `executeChildCascade` calls `runConversation()` for each child prompt, GPT-5 models trigger "background mode" in the edge function. The SSE stream immediately returns:

```
{ interrupted: true, interruptType: 'long_running', interruptData: { responseId: '...' } }
```

Back in `executeChildCascade` (line 1841):
```
success: !!result?.response   // result.response is undefined -> false
```

All 5 children are marked as failures, the cascade completes instantly, and no actual AI responses are ever collected. The background responses DO complete (via webhook/polling) but nothing is listening for them inside the cascade loop.

The `usePendingResponseSubscription` hook that waits for background completions only exists at the MainLayout level for single-prompt runs -- it is not used inside `executeChildCascade`.

### Solution

Add inline polling inside `executeChildCascade` to wait for background completion when `runConversation` returns an `interrupted: true` result. This mirrors what `usePendingResponseSubscription` does but works synchronously within the cascade loop.

### Technical Changes

**File: `src/hooks/useCascadeExecutor.ts`**

**1. Add a helper function `waitForBackgroundResponse`** (before the `executeChildCascade` callback):

```typescript
const waitForBackgroundResponse = async (
  responseId: string, 
  timeoutMs = 600_000, // 10 minutes
  pollIntervalMs = 10_000 // 10 seconds
): Promise<{ response: string | null; success: boolean; usage?: any; response_id?: string }> => {
  const startTime = Date.now();
  
  while (Date.now() - startTime < timeoutMs) {
    // Check cancellation
    if (isCancelled()) {
      return { response: null, success: false };
    }
    
    // Wait for poll interval (but check cancel every second)
    for (let waited = 0; waited < pollIntervalMs; waited += 1000) {
      if (isCancelled()) return { response: null, success: false };
      await new Promise(r => setTimeout(r, Math.min(1000, pollIntervalMs - waited)));
    }
    
    // Poll the pending_responses table
    const { data } = await supabaseClient
      .from('q_pending_responses')
      .select('status, output_text, error, usage')
      .eq('response_id', responseId)
      .maybeSingle();
    
    if (!data) continue;
    
    if (data.status === 'completed' && data.output_text) {
      return { 
        response: data.output_text, 
        success: true, 
        usage: data.usage,
        response_id: responseId 
      };
    }
    
    if (['failed', 'cancelled', 'incomplete'].includes(data.status)) {
      console.error(`Background response ${responseId} ended with status: ${data.status}`, data.error);
      return { response: null, success: false };
    }
    
    // Also try polling the edge function (same as usePendingResponseSubscription)
    try {
      const { data: pollData, error: pollError } = await supabaseClient
        .functions.invoke('poll-openai-response', {
          body: { response_id: responseId },
        });
      
      if (!pollError && pollData?.status === 'completed' && pollData?.output_text) {
        return { 
          response: pollData.output_text, 
          success: true, 
          usage: pollData.usage,
          response_id: responseId 
        };
      }
    } catch (e) {
      console.warn('Poll edge function error:', e);
    }
  }
  
  console.error(`Background response ${responseId} timed out after ${timeoutMs}ms`);
  return { response: null, success: false };
};
```

**2. Modify the `runConversation` result handling** (around lines 1827-1843):

After `runConversation` returns, check if the result is an `interrupted` background response and wait for it:

```typescript
// Standard OpenAI conversation path
result = await runConversation({
  conversationRowId: parentAssistantRowId,
  childPromptRowId: childPrompt.row_id,
  userMessage,
  threadMode: 'new',
  childThreadStrategy: 'parent',
  template_variables: templateVariables,
  store_in_history: false,
});

// Handle GPT-5 background mode: wait for completion
if (result?.interrupted && result?.interruptType === 'long_running') {
  const bgResponseId = result.interruptData?.responseId;
  console.log(`executeChildCascade: Child ${childPrompt.prompt_name} went to background mode (${bgResponseId}), waiting...`);
  
  toast.info(`Waiting for background response: ${childPrompt.prompt_name}`, {
    source: 'executeChildCascade',
  });
  
  const bgResult = await waitForBackgroundResponse(bgResponseId);
  
  // Overwrite result with the actual background response
  result = {
    response: bgResult.response,
    usage: bgResult.usage,
    response_id: bgResult.response_id,
  };
}
```

**3. No changes needed** to the `success` check on line 1841 -- it already uses `!!result?.response`, which will now correctly be `true` once the background response is received.

### What This Fixes

- `executeChildCascade` will now detect when a child prompt enters background mode and poll until the response arrives
- Each child waits for its own completion before moving to the next, maintaining sequential execution order
- Cancellation is respected during the wait (checked every second)
- The cascade result will correctly reflect success/failure based on actual AI responses
- Post-action processing (variable assignments, recursive cascades) will work because `result.response` will contain the actual output

### Scope

- Only `src/hooks/useCascadeExecutor.ts` is modified
- No edge function or database changes needed
- No new dependencies

