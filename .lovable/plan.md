
# Remediation Plan: Complete Phase 7 + Fix Webhook Error Handling

## Pre-Audit Verification Summary

The previous implementation completed **6 of 7 phases**. This plan addresses:
1. **Bug fixes** for missing error handling in `openai-webhook/index.ts`
2. **Phase 7 completion** - Add detection logic to trigger webhook mode

---

## Phase 1: Fix Webhook Error Handling (Bug Remediation)

### File: `supabase/functions/openai-webhook/index.ts`

**Issue 1: Missing responseId null check (Line 140)**
- Current: `const responseId = data?.id;` followed by DB query
- Risk: If `data.id` is undefined, query will fail or return unexpected results

**Issue 2: Silent database update failures (Lines 183-218)**
- Current: No error handling on database updates
- Risk: If updates fail, webhook returns 200 OK but data is lost/inconsistent

**Remediation:**
```typescript
// After line 140, add null check:
if (!responseId) {
  console.warn('[openai-webhook] No response_id in payload:', { type, eventId });
  return new Response('OK', { status: 200 });
}

// For database updates, add error checking:
const { error: updateError } = await supabase.from('q_pending_responses')
  .update({...})
  .eq('row_id', pendingResponse.row_id);

if (updateError) {
  console.error('[openai-webhook] Failed to update pending response:', updateError);
  // Return 500 to trigger OpenAI retry
  return new Response('Internal Server Error', { status: 500 });
}
```

---

## Phase 2: Complete Phase 7 - Long-Running Detection

### Overview
Add detection logic to identify operations that will exceed edge function timeout and proactively switch to webhook mode.

### File: `supabase/functions/conversation-run/index.ts`

**Location:** After imports (around line 20)

**Add Helper Function:**
```typescript
// Detect if operation will likely exceed edge function timeout
function isLongRunningOperation(
  model: string | undefined,
  reasoningEffort: string | undefined,
  toolCount: number
): boolean {
  // GPT-5 with high reasoning effort can take 5+ minutes
  if (model?.includes('gpt-5') && reasoningEffort === 'high') {
    return true;
  }
  // GPT-5 with extensive tool usage can also be slow
  if (model?.includes('gpt-5') && toolCount > 5) {
    return true;
  }
  return false;
}
```

**Location:** After background request creation (find where `background: true` is used and response is obtained)

**Add Webhook Mode Trigger:**
```typescript
// Check if this will be a long-running operation
const toolCount = (tools || []).length;
if (isLongRunningOperation(selectedModel, apiOptions?.reasoning_effort, toolCount)) {
  const webhookSecret = Deno.env.get('OPENAI_WEBHOOK_SECRET');
  
  if (webhookSecret && responseId) {
    // Create pending response record for webhook tracking
    const { error: insertError } = await supabase
      .from('q_pending_responses')
      .insert({
        response_id: responseId,
        owner_id: userId,
        prompt_row_id: promptRowId,
        thread_row_id: activeThreadRowId,
        trace_id: traceId,
        source_function: 'conversation-run',
        model: selectedModel,
        reasoning_effort: apiOptions?.reasoning_effort,
      });
    
    if (!insertError) {
      emitter.emit({
        type: 'long_running_started',
        response_id: responseId,
        message: 'Complex request submitted. Processing in background - you will be notified when complete.',
      });
      emitter.emit({ type: 'output_text_done', text: '', item_id: 'long_running_placeholder' });
      emitter.close();
      return; // Exit early - webhook will deliver result
    } else {
      console.warn('[conversation-run] Failed to create pending response, continuing with polling:', insertError);
    }
  }
}
```

### File: `supabase/functions/prompt-family-chat/index.ts`

Apply the same pattern at the equivalent location after the background request is created.

---

## Phase 3: Redeploy Edge Functions

After making changes:
1. Deploy `openai-webhook` (already deployed, needs redeployment with fixes)
2. Deploy `conversation-run` with Phase 7 changes
3. Deploy `prompt-family-chat` with Phase 7 changes

---

## Pre-Existing Issue (NOT Fixed - Platform Constraint)

**tsconfig.json Build Error (TS6310)**
- This error (`Referenced project may not disable emit`) is a pre-existing platform constraint
- Documented in project memory
- NOT introduced by this implementation
- Does NOT block functionality

---

## Files to Modify

| File | Change Type | Description |
|------|-------------|-------------|
| `supabase/functions/openai-webhook/index.ts` | Bug Fix | Add responseId check + error handling |
| `supabase/functions/conversation-run/index.ts` | New Feature | Add Phase 7 detection + webhook trigger |
| `supabase/functions/prompt-family-chat/index.ts` | New Feature | Add Phase 7 detection + webhook trigger |

---

## Verification Checklist

After implementation:
- [ ] Webhook returns 500 on DB update failure (enables OpenAI retry)
- [ ] Webhook handles missing responseId gracefully
- [ ] Long-running detection triggers for GPT-5 + high reasoning
- [ ] `long_running_started` event emitted correctly
- [ ] Frontend receives and handles the interrupt signal
- [ ] Realtime subscription picks up webhook completion

---

## Risk Assessment

| Risk | Severity | Mitigation |
|------|----------|------------|
| False positive long-running detection | Medium | Conservative criteria (GPT-5 + high only) |
| Webhook failure with 500 causes infinite retry | Low | OpenAI has retry limits; can add idempotency |
| Frontend not connected when webhook fires | Medium | Realtime subscription handles this |

---

## Technical Notes

1. **No changes to frontend** - Already has `long_running_started` handler and `usePendingResponseSubscription`
2. **No database changes** - `q_pending_responses` table already exists with correct schema
3. **No config changes** - `config.toml` already has webhook function configured
