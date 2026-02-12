

# Revised Plan: OpenAI Webhook Diagnostic Logging

Audit of the original plan against the actual codebase at `supabase/functions/openai-webhook/index.ts`.

---

## Audit Findings Against the Original Plan

### Finding 1: Secret Prefix Logging Is a Security Risk

The plan proposes logging `secretPrefix: secret.slice(0, 6)` in three places. If the secret does NOT have the `whsec_` prefix, the first 6 characters are raw base64 key material. Even with the prefix, `whsec_` is exactly 6 characters, so `slice(0, 6)` leaks nothing useful. But if the user stored the secret WITHOUT the prefix (just raw base64), `slice(0, 6)` leaks ~4.5 bytes of key entropy into logs. Edge function logs are visible in the backend dashboard.

**Fix:** Only log the prefix check result (`hasWhsecPrefix`) and the length. Do NOT log `secretPrefix` at all. The length + prefix-presence is sufficient to diagnose format issues.

### Finding 2: Plan Omits CORS -- But Correctly So

The `openai-webhook` function does NOT use CORS headers (lines 116-297). This is correct because it receives server-to-server POST requests from OpenAI, not browser requests. The plan does not add CORS. Verified correct.

### Finding 3: Plan Omits `config.toml` Verification -- But It Is Already Correct

Line 75-76 of `config.toml` shows `[functions.openai-webhook] verify_jwt = false`. This is correct for a webhook endpoint. No change needed. Verified.

### Finding 4: Hardcoded Table Names Inside This Function

The plan says "No behavioral changes" but the function has 5 hardcoded table references: `q_pending_responses` (lines 165, 189, 257), `q_execution_traces` (lines 233, 274), `q_threads` (line 205), `q_prompts` (line 217). These violate the architectural mandate (covered in the separate remediation plan). The webhook plan must NOT touch these -- they belong to the other plan's Phase 6 scope. However, Phase 6 of the other plan only adds entries to `_shared/tables.ts` and does NOT update the webhook function itself to use the `TABLES` constant.

**Risk:** The remediation plan's Phase 6 adds `PENDING_RESPONSES` and `MANUS_TASKS` to `tables.ts` but never imports or uses them in `openai-webhook/index.ts`. The webhook function still hardcodes all 4 table names. This is an omission in the OTHER plan, not this one. This diagnostic plan must not address it (per the user's instruction to not change anything else), but it must be flagged.

**Flag:** After this diagnostic plan is implemented, the separate remediation plan must add a Phase 2 entry for `openai-webhook/index.ts` to replace its 5 hardcoded table references with imports from `_shared/tables.ts`.

### Finding 5: `console.log` at Entry Point Leaks Into Production

The plan proposes `console.log('[openai-webhook] Verifying signature, secret format:', ...)` at the entry point (Change 5). This logs on EVERY successful webhook call, not just failures. Since this is diagnostic and temporary, it should use `console.debug` or be gated behind a check. However, edge functions in Deno do not distinguish log levels in the Supabase log viewer -- all levels appear. The real concern is log volume: if webhooks fire frequently, this adds noise.

**Fix:** Keep the entry-point log but mark it clearly as diagnostic with a `[DIAG]` prefix so it can be easily identified and removed later. Also, move it inside the `if (webhookSecret)` block (it already is in the plan -- verified correct).

### Finding 6: Plan References Wrong Line Numbers

The plan says "line 54-56" for missing headers, "line 62-64" for timestamp, "line 89-94" for signature comparison, "line 95-98" for outer catch, "line 120-129" for entry point. Verified against actual file:
- Missing headers: lines 54-57 (plan says 54-56, actual `return false` is line 56) -- close enough, no issue
- Timestamp: lines 62-64 -- correct
- Signature comparison: lines 89-94 -- correct
- Outer catch: lines 95-98 -- correct
- Entry point: lines 120-129 -- correct

All line references are accurate.

### Finding 7: The Plan Does Not Handle the `body` Being Already Consumed

Line 117: `const body = await req.text()`. The body is read as text first, then passed to `verifyWebhookSignature` and later parsed with `JSON.parse(body)`. This is correct -- `req.text()` is called once and the string is reused. No issue.

### Finding 8: TypeScript Strictness

The plan's code snippets are valid TypeScript. The `error` parameter in the catch block (Change 4) uses `error instanceof Error ? error.message : String(error)` which is type-safe. No issues.

### Finding 9: No Return Type Changes

All changes are logging-only. The function's return types (`Promise<boolean>` for `verifyWebhookSignature`, `Response` for the handler) are unchanged. Verified correct.

---

## Revised Plan

### Scope

Add diagnostic logging to `supabase/functions/openai-webhook/index.ts` to identify why signature verification fails. Logging-only changes. No behavioral changes.

### Change 1: Missing Headers Diagnostic (lines 54-56)

Replace:
```typescript
if (!webhookId || !webhookTimestamp || !webhookSignature) {
  console.error('[openai-webhook] Missing signature headers');
  return false;
}
```

With:
```typescript
if (!webhookId || !webhookTimestamp || !webhookSignature) {
  console.error('[openai-webhook] [DIAG] Missing signature headers:', {
    hasWebhookId: !!webhookId,
    hasWebhookTimestamp: !!webhookTimestamp,
    hasWebhookSignature: !!webhookSignature,
  });
  return false;
}
```

### Change 2: Timestamp Diagnostic (lines 62-64)

Replace:
```typescript
if (Math.abs(now - timestamp) > 300) {
  console.error('[openai-webhook] Timestamp outside acceptable range:', { timestamp, now });
  return false;
}
```

With:
```typescript
const deltaSeconds = Math.abs(now - timestamp);
if (deltaSeconds > 300) {
  console.error('[openai-webhook] [DIAG] Timestamp outside acceptable range:', {
    timestamp,
    now,
    deltaSeconds,
  });
  return false;
}
```

### Change 3: Signature Comparison Diagnostic (lines 89-94)

Replace:
```typescript
const computedSignature = 'v1,' + btoa(
  String.fromCharCode(...new Uint8Array(signatureBytes))
);

// Check if computed signature matches any provided signature
return webhookSignature.split(' ').some(sig => sig === computedSignature);
```

With:
```typescript
const computedSignature = 'v1,' + btoa(
  String.fromCharCode(...new Uint8Array(signatureBytes))
);

// Check if computed signature matches any provided signature
const receivedSignatures = webhookSignature.split(' ');
const matched = receivedSignatures.some(sig => sig === computedSignature);

if (!matched) {
  console.error('[openai-webhook] [DIAG] Signature mismatch:', {
    computedPrefix: computedSignature.slice(0, 20) + '...',
    receivedPrefixes: receivedSignatures.map(s => s.slice(0, 20) + '...'),
    secretLength: secret.length,
    hasWhsecPrefix: secret.startsWith('whsec_'),
    bodyLength: body.length,
  });
}

return matched;
```

Note: `secretPrefix` removed per Finding 1. Only `secretLength` and `hasWhsecPrefix` are logged.

### Change 4: Outer Catch Diagnostic (lines 95-98)

Replace:
```typescript
} catch (error) {
  console.error('[openai-webhook] Signature verification error:', error);
  return false;
}
```

With:
```typescript
} catch (error: unknown) {
  console.error('[openai-webhook] [DIAG] Signature verification error:', {
    error: error instanceof Error ? error.message : String(error),
    secretLength: secret.length,
    hasWhsecPrefix: secret.startsWith('whsec_'),
  });
  return false;
}
```

Note: `error` typed as `unknown` for strict TypeScript. No `secretPrefix` logged.

### Change 5: Entry Point Diagnostic (lines 120-126)

Replace:
```typescript
const webhookSecret = Deno.env.get('OPENAI_WEBHOOK_SECRET');
if (webhookSecret) {
  const isValid = await verifyWebhookSignature(req, body, webhookSecret);
  if (!isValid) {
    console.error('[openai-webhook] Invalid webhook signature');
    return new Response('Unauthorized', { status: 401 });
  }
```

With:
```typescript
const webhookSecret = Deno.env.get('OPENAI_WEBHOOK_SECRET');
if (webhookSecret) {
  console.log('[openai-webhook] [DIAG] Verifying signature:', {
    secretLength: webhookSecret.length,
    hasWhsecPrefix: webhookSecret.startsWith('whsec_'),
  });
  const isValid = await verifyWebhookSignature(req, body, webhookSecret);
  if (!isValid) {
    console.error('[openai-webhook] Invalid webhook signature - see [DIAG] logs above');
    return new Response('Unauthorized', { status: 401 });
  }
```

---

## What This Does NOT Change

- No changes to verification logic or HMAC algorithm
- No changes to response status codes
- No changes to database operations or table references
- No changes to any other edge function
- No changes to `config.toml`
- No database migrations
- No frontend changes
- No CORS changes (correctly absent for server-to-server webhook)
- No dependency changes

## Flagged for Separate Remediation Plan

The `openai-webhook/index.ts` file has 5 hardcoded table names (`q_pending_responses` x3, `q_execution_traces` x2, `q_threads` x1, `q_prompts` x1) that must be addressed in the remediation plan's Phase 2, not here.

## Post-Deploy Steps

1. Deploy the updated `openai-webhook` function
2. Trigger a GPT-5 request OR wait for OpenAI's retry (retries continue up to 72 hours from original failure)
3. Read edge function logs filtered for `[DIAG]`
4. Based on output, apply the targeted fix:
   - Missing headers: OpenAI dashboard webhook misconfiguration
   - Timestamp drift: Widen tolerance or investigate edge function clock skew
   - Secret decode error in catch: Re-save `OPENAI_WEBHOOK_SECRET` with correct base64 from OpenAI dashboard
   - Signature mismatch: Stored secret does not match OpenAI's signing key -- re-copy and re-save
5. After root cause is fixed, remove all `[DIAG]` logging lines to reduce log noise

