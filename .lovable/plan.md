
## Fix: Main Cascade Missing Background Mode (long_running) Handler

### Root Cause

The main `executeCascade` function in `useCascadeExecutor.ts` does not handle `long_running` interrupts from GPT-5 background mode. Only the `executeChildCascade` function (used for auto-run children) has this handler.

**What happens:**
1. GPT-5 triggers background mode, the SSE stream returns `{ interrupted: true, interruptType: 'long_running', interruptData: { responseId } }`
2. The question handler loop (line 929) only checks for `interruptType === 'question'`, so it skips the `long_running` result
3. The generic catch-all at line 974 (`if (result?.interrupted)`) fires and overwrites the result with `{ success: false, error: 'Max questions exceeded' }`
4. Line 1001 checks `result?.response` which is now undefined, so it throws `"No response received"`
5. This retries 3 times, fails each time the same way, and shows the error toast

### Fix

**File: `src/hooks/useCascadeExecutor.ts`**

Insert a `long_running` interrupt handler **between** the question loop (line 971) and the generic interrupted catch-all (line 974). This handler will:

1. Extract the `responseId` from the interrupt data
2. Call the existing `waitForBackgroundResponse` helper (already defined at line 1669 and used by `executeChildCascade`)
3. Overwrite `result` with the background response, converting it to the same shape as a normal streaming result
4. Update the prompt's `output_response` in the database (same as `executeChildCascade` does)

The code to add (after line 971, before line 974):

```typescript
// Handle GPT-5 background mode: wait for completion via polling/realtime
if (result?.interrupted && result.interruptType === 'long_running') {
  const bgResponseId = result.interruptData?.responseId;
  if (!bgResponseId) {
    console.error('executeCascade: No responseId in long_running interrupt data');
    result = { response: null };
  } else {
    toast.info(`Background processing: ${prompt.prompt_name}`, {
      description: 'Waiting for GPT-5 to complete...',
      source: 'useCascadeExecutor',
    });

    const bgResult = await waitForBackgroundResponse(bgResponseId);

    if (bgResult.success && bgResult.response) {
      result = {
        response: bgResult.response,
        response_id: bgResult.response_id || bgResponseId,
      };

      // Update the prompt output in DB (same as executeChildCascade)
      await supabase
        .from(import.meta.env.VITE_PROMPTS_TBL)
        .update({
          output_response: bgResult.response,
          user_prompt_result: bgResult.response,
          updated_at: new Date().toISOString(),
        })
        .eq('row_id', prompt.row_id);
    } else {
      result = { response: null };
    }
  }
}
```

### Additional Fix: Webhook Signature Failure

The webhook logs show persistent signature verification failures. Every webhook from OpenAI is returning 401. This means:
- The `OPENAI_WEBHOOK_SECRET` stored in Supabase secrets does not match the signing secret configured in the OpenAI dashboard
- All webhook deliveries are being rejected
- The system is entirely dependent on polling fallback

This is a configuration issue, not a code issue. You need to:
1. Go to your OpenAI dashboard webhook settings
2. Copy the **exact** webhook signing secret (starts with `whsec_`)
3. Update the `OPENAI_WEBHOOK_SECRET` in your backend secrets to match

Until the webhook secret is fixed, all background completions rely on polling, which works but is slower.

### Scope

- `src/hooks/useCascadeExecutor.ts` -- 1 change (add ~25 lines after line 971)
- No database changes
- No edge function changes needed (polling fallback already works)
