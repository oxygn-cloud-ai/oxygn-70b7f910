

## Webhook Signature Fix: Secret Whitespace Trimming and Improved Diagnostics

### Root Cause Analysis

The `OPENAI_WEBHOOK_SECRET` is confirmed correct in the OpenAI dashboard, and the endpoint URL is correct. Both the base64-decoded and raw-UTF8 HMAC attempts fail. The most probable cause is **invisible whitespace** (trailing newline, space, or carriage return) stored alongside the secret value. When secrets are pasted into input fields, trailing whitespace is commonly included.

The code on line 81 does:
```
const secretBase64 = secret.replace('whsec_', '');
```
...but never calls `.trim()`. If even a single trailing character is present, `atob()` silently produces different key bytes, and every HMAC computation will mismatch.

### Changes Required

**File: `supabase/functions/openai-webhook/index.ts`**

1. **Add `.trim()` to all secret processing paths** -- Apply `.trim()` immediately when the secret is first read from the environment variable, before any processing occurs. This single fix at the entry point covers both the base64 and raw fallback paths.

2. **Enhance diagnostic logging** -- Log the decoded key byte length (not the secret itself) so future mismatches can be diagnosed instantly. A 32-byte decoded key confirms correct base64; anything else signals corruption.

3. **Remove the raw-secret fallback** -- Once trimming is applied, the raw fallback becomes unnecessary complexity. OpenAI/Svix always uses base64-encoded secrets with the `whsec_` prefix. The fallback masks the real problem and adds code surface for no benefit. Remove it to simplify the verification path.

### Technical Details

```text
Before (broken):
  secret = "whsec_abc123...XYZ=\n"  (trailing newline from paste)
  secretBase64 = "abc123...XYZ=\n"
  atob("abc123...XYZ=\n") -> wrong bytes -> wrong HMAC -> mismatch

After (fixed):
  secret = "whsec_abc123...XYZ="  (trimmed)
  secretBase64 = "abc123...XYZ="
  atob("abc123...XYZ=") -> correct 32 bytes -> correct HMAC -> match
```

### Specific Edits

In the `serve()` handler where the secret is read (~line 148):
- Change `Deno.env.get('OPENAI_WEBHOOK_SECRET')` to `Deno.env.get('OPENAI_WEBHOOK_SECRET')?.trim()`

In `verifyWebhookSignature` (~line 81):
- Add `.trim()` to the secret processing: `const secretBase64 = secret.replace('whsec_', '').trim();`
- Add a diagnostic log: `decodedKeyLength: secretBytes.length` to the mismatch error object

Remove the raw-secret fallback block (~lines 106-131) entirely.

### Risk Assessment

- **Low risk**: `.trim()` is a safe, idempotent operation -- if no whitespace exists, behavior is unchanged
- Removing the fallback simplifies the code and eliminates a misleading diagnostic path
- No other files are modified

