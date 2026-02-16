

# Fix: Webhook Signature Mismatch Causing Background Request Timeouts

## Diagnosis

### Root Cause
The `openai-webhook` edge function is **consistently rejecting all incoming webhooks** due to HMAC signature mismatch. Every single webhook call logs:
```
[DIAG] Signature mismatch: {
  computedPrefix: "v1,tCN9/Gl4P8...",
  receivedPrefixes: ["v1,YEY9hLe//S6..."],
  secretLength: 50, hasWhsecPrefix: true
}
```

The `OPENAI_WEBHOOK_SECRET` stored in Lovable Cloud does not match the signing key OpenAI is using. This means GPT-5 background responses are never delivered via webhook.

### Why the Polling Fallback Also Fails
The system has a polling fallback (`poll-openai-response` called every 30s from the browser), but:
- It only runs while the user keeps the page open and focused
- If the user navigates away or switches prompts, polling stops
- The 10-minute client-side timeout (`TIMEOUT_MS`) fires before GPT-5 completes
- **Two pending responses are currently stuck** in the database with status `pending` and no `webhook_event_id`

### Evidence
Database query shows two orphaned rows:
- `resp_...971c` (gpt-5-nano) created 08:14:48 -- still `pending`
- `resp_...abad` (gpt-5) created 08:13:00 -- still `pending`

Both have `webhook_event_id: null`, confirming no webhook was ever accepted.

## Fix Plan

### Step 1: Re-configure the Webhook Secret (Configuration Fix)
The `OPENAI_WEBHOOK_SECRET` must be re-synced with OpenAI. This requires the user to:
1. Go to the OpenAI dashboard, navigate to Webhooks
2. Delete the existing webhook endpoint and create a new one pointing to the same URL
3. Copy the new signing secret (starts with `whsec_`)
4. Update the `OPENAI_WEBHOOK_SECRET` in Lovable Cloud

This is a manual step that must be done by the user.

### Step 2: Clean Up Stuck Pending Responses (Database Fix)
Mark the two orphaned pending responses as `failed` so they stop triggering UI errors:
```sql
UPDATE q_pending_responses
SET status = 'failed',
    error = 'Webhook delivery failed - signature mismatch',
    completed_at = now()
WHERE status = 'pending'
  AND created_at < now() - interval '30 minutes';
```

### Step 3: Improve Polling Resilience (Code Fix)
**File: `src/hooks/usePendingResponseSubscription.ts`**

Reduce polling interval from 30s to 10s and initial delay from 5s to 2s. This gives the polling fallback a better chance of catching completed responses before the user navigates away:

```text
POLL_INTERVAL_MS: 30_000 -> 10_000
Initial delay: 5_000 -> 2_000
```

### Step 4: Add Webhook Verification Bypass for Development (Code Fix)
**File: `supabase/functions/openai-webhook/index.ts`**

After signature verification fails, attempt a secondary verification using the raw secret (not base64-decoded) as a fallback. Some webhook secret formats from OpenAI use the raw string directly rather than base64. If both fail, continue to reject with 401.

This addresses the possibility that the secret format changed on OpenAI's side:

```typescript
// Primary: Standard Webhooks spec (base64-decode after stripping whsec_)
const secretBase64 = secret.replace('whsec_', '');
const secretBytes = Uint8Array.from(atob(secretBase64), c => c.charCodeAt(0));
// ... HMAC verification ...

// If primary fails, try raw bytes (some implementations use raw secret)
if (!matched) {
  const rawKey = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret.replace('whsec_', '')),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  // ... compute and compare again ...
}
```

## Files Changed

| File | Change |
|------|--------|
| `src/hooks/usePendingResponseSubscription.ts` | Reduce poll interval to 10s, initial delay to 2s |
| `supabase/functions/openai-webhook/index.ts` | Add secondary raw-secret HMAC verification fallback |
| Database | Clean up orphaned pending responses |

## What Stays the Same
- All other edge functions unchanged
- Webhook verification still required (not bypassed)
- 10-minute client timeout unchanged
- Realtime subscription logic unchanged
- No schema changes

## User Action Required
The user must re-configure the `OPENAI_WEBHOOK_SECRET` by creating a new webhook endpoint in the OpenAI dashboard and updating the secret. Without this, the signature mismatch will persist regardless of code changes.

