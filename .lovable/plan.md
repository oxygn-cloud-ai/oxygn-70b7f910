
# Phase 3-4 Implementation Plan: Update Edge Functions for Per-User API Keys

## Current State Analysis

All 15+ edge functions still use `Deno.env.get('OPENAI_API_KEY')` instead of the per-user credential system. The shared helpers in `credentials.ts` (Phase 1-2) are complete and ready for use.

## Files Requiring Updates

### Standard Pattern Files (JSON Response)
These functions return JSON responses and need the standard transformation:

| # | File | Current Line | Pattern |
|---|------|--------------|---------|
| 1 | `openai-proxy/index.ts` | 86-94 | Standard |
| 2 | `conversation-manager/index.ts` | 82-91 | Standard |
| 3 | `thread-manager/index.ts` | 118-125 | Standard |
| 4 | `conversation-cancel/index.ts` | 49-65 | Standard |
| 5 | `studio-chat/index.ts` | 127-133 | Standard |
| 6 | `test-openai-delete/index.ts` | 41-51 | Standard |
| 7 | `resource-health/index.ts` | 453-459 | Standard |
| 8 | `openai-billing/index.ts` | 61-67 | Standard |
| 9 | `generate-embedding/index.ts` | ~35 | Standard |
| 10 | `batch-embeddings/index.ts` | ~109 | Standard |
| 11 | `confluence-manager/index.ts` | 1001-1005 | Standard |

### SSE Pattern Files (Streaming Response)
These functions use SSE emitters and need a different error pattern:

| # | File | Current Line | Pattern |
|---|------|--------------|---------|
| 12 | `conversation-run/index.ts` | 1833-1840 | SSE emitter |
| 13 | `prompt-family-chat/index.ts` | 938-952 | SSE emitter |

### Special Cases

| # | File | Notes |
|---|------|-------|
| 14 | `fetch-provider-models/index.ts` | `fetchOpenAIModels()` needs authHeader param |
| 15 | `execution-manager/index.ts` | `deletePreviousTraceResponses()` helper needs apiKey param |
| 16 | `manus-key-validate/index.ts` | Remove env key source detection (lines 68-69) |
| 17 | `credentials-manager/index.ts` | Add 'openai' case in get_status switch |

---

## Transformation Patterns

### Standard Pattern (JSON Response)

```text
BEFORE:
const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');
if (!OPENAI_API_KEY) {
  return new Response(
    JSON.stringify({ error: 'OpenAI API key not configured' }),
    { status: 500, headers: ... }
  );
}

AFTER:
import { getOpenAIApiKey } from "../_shared/credentials.ts";
import { ERROR_CODES, buildErrorResponse, getHttpStatus } from "../_shared/errorCodes.ts";

// After auth validation, before using the key:
const authHeader = req.headers.get('Authorization')!;
const OPENAI_API_KEY = await getOpenAIApiKey(authHeader);
if (!OPENAI_API_KEY) {
  return new Response(
    JSON.stringify(buildErrorResponse(ERROR_CODES.OPENAI_NOT_CONFIGURED)),
    { status: getHttpStatus(ERROR_CODES.OPENAI_NOT_CONFIGURED), headers: ... }
  );
}
```

### SSE Pattern (Streaming Response)

```text
BEFORE:
const openAIApiKey = Deno.env.get('OPENAI_API_KEY');
if (!openAIApiKey) {
  emitter.emit({ type: 'error', error: 'OpenAI API key not configured' });
  return;
}

AFTER:
import { getOpenAIApiKey } from "../_shared/credentials.ts";
import { ERROR_CODES } from "../_shared/errorCodes.ts";

// After auth validation:
const authHeader = req.headers.get('Authorization')!;
const openAIApiKey = await getOpenAIApiKey(authHeader);
if (!openAIApiKey) {
  emitter.emit({ 
    type: 'error', 
    error: 'OpenAI API key not configured. Add your key in Settings → Integrations → OpenAI.', 
    error_code: ERROR_CODES.OPENAI_NOT_CONFIGURED 
  });
  emitter.close();
  return;
}
```

---

## Implementation Order

### Batch 1: Core Shared Functions (2 files)
1. `credentials-manager/index.ts` - Add 'openai' case to get_status
2. `manus-key-validate/index.ts` - Remove env fallback detection

### Batch 2: Standard JSON Response Functions (11 files)
All use the standard pattern with imports and error handling:
- openai-proxy
- conversation-manager
- thread-manager
- conversation-cancel
- studio-chat
- test-openai-delete
- resource-health
- openai-billing
- generate-embedding
- batch-embeddings
- confluence-manager

### Batch 3: SSE Streaming Functions (2 files)
- conversation-run
- prompt-family-chat

### Batch 4: Special Cases (2 files)
1. `fetch-provider-models/index.ts` - Update fetchOpenAIModels to accept authHeader
2. `execution-manager/index.ts` - Update deletePreviousTraceResponses to accept apiKey param

---

## Technical Details Per File

### 1. openai-proxy/index.ts
- Add imports at top
- Change line 86 from `Deno.env.get('OPENAI_API_KEY')` to `await getOpenAIApiKey(authHeader)`
- Update error response (lines 88-94) to use buildErrorResponse
- Note: authHeader available from line 35 but must be passed after validation

### 2. conversation-manager/index.ts
- Add imports at top
- Change line 82 from `Deno.env.get('OPENAI_API_KEY')` to `await getOpenAIApiKey(authHeader)`
- Update error response (lines 86-91) to use buildErrorResponse
- Note: authHeader needed from validateUser or req.headers

### 3. thread-manager/index.ts
- Add imports at top
- Change line 118 from `Deno.env.get('OPENAI_API_KEY')` to `await getOpenAIApiKey(authHeader)`
- Update error response (lines 120-125) to use buildErrorResponse

### 4. conversation-cancel/index.ts
- Add imports at top
- Change line 49 from `Deno.env.get('OPENAI_API_KEY')` to `await getOpenAIApiKey(authHeader)`
- authHeader already available at line 38

### 5. studio-chat/index.ts
- Add imports at top
- Change line 127 from `Deno.env.get('OPENAI_API_KEY')` to `await getOpenAIApiKey(authHeader)`
- authHeader from validateUser or req.headers

### 6. conversation-run/index.ts (SSE)
- Add imports at top
- Change line 1833 from `Deno.env.get('OPENAI_API_KEY')` to `await getOpenAIApiKey(authHeader)`
- Update emitter.emit (line 1838) to include error_code
- Add emitter.close() after emit

### 7. prompt-family-chat/index.ts (SSE)
- Add imports at top
- Change line 938 from `Deno.env.get('OPENAI_API_KEY')` to `await getOpenAIApiKey(authHeader)`
- Update emitter.emit (line 949) to include error_code
- Already has emitter.close() at line 951

### 8. fetch-provider-models/index.ts
- Add import for getOpenAIApiKey
- Update fetchOpenAIModels function signature to accept authHeader
- Change line 52 from `Deno.env.get('OPENAI_API_KEY')` to `await getOpenAIApiKey(authHeader)`
- Update caller to pass authHeader

### 9. execution-manager/index.ts
- Add import for getOpenAIApiKey
- Update deletePreviousTraceResponses signature at line 344 to accept openAIApiKey param
- Remove Deno.env.get call inside function
- Update all callers to pass the API key

### 10. manus-key-validate/index.ts
- Remove lines 68-69 (env key detection)
- Set keySource directly to 'user'

### 11. credentials-manager/index.ts
- Add 'openai' case at line ~129 in get_status switch:
```typescript
} else if (service === 'openai') {
  status.api_key = configuredKeys.includes('api_key');
```

---

## Risk Assessment

| Risk | Severity | Mitigation |
|------|----------|------------|
| Credential lookup timeout | Medium | 5-second timeout in getDecryptedCredentialWithTimeout |
| Breaking existing users | High | Clear error messages directing to Settings |
| SSE streams not properly closed | Medium | Add emitter.close() after error emit |

---

## Testing Checklist

- [ ] All 17 files updated with correct imports
- [ ] All Deno.env.get('OPENAI_API_KEY') calls replaced
- [ ] All error responses use correct error codes
- [ ] SSE functions include emitter.close() after errors
- [ ] manus-key-validate returns keySource: 'user'
- [ ] credentials-manager includes 'openai' case
- [ ] fetch-provider-models passes authHeader to fetchOpenAIModels
- [ ] execution-manager passes apiKey to deletePreviousTraceResponses
