
# Security Remediation - Audit Findings Resolution Plan

## Executive Summary

The adversarial audit revealed a **critical failure**: the CORS hardening was NOT applied to any edge function. While the utility was created correctly, all 21+ edge functions still use wildcard `Access-Control-Allow-Origin: *`, leaving APIs vulnerable.

---

## Critical Issues Requiring Immediate Fix

### Issue 1: CORS Wildcard Still Active (CRITICAL)

**Current State**: All edge functions use:
```typescript
import { corsHeaders } from "../_shared/cors.ts"; // Uses '*'
```

**Required State**: All edge functions must use:
```typescript
const origin = req.headers.get('Origin');
const corsHeaders = getCorsHeaders(origin);
```

**Affected Files** (21 functions):
- batch-embeddings, confluence-manager, conversation-cancel
- conversation-manager, conversation-run, credentials-manager
- execution-manager, fetch-provider-models, generate-embedding
- github-release, manus-key-validate, manus-task-create
- manus-webhook-register, openai-billing, openai-proxy
- prompt-family-chat, prompt-versions, resource-health
- studio-chat, test-openai-delete, thread-manager

---

### Issue 2: ErrorBoundary Origin Prefix Attack (HIGH)

**Current Code** (line 64-66):
```typescript
currentOrigin === origin || currentOrigin.startsWith(origin)
```

**Risk**: `https://lovable.dev.attacker.com` would match `https://lovable.dev`

**Fix**: Remove `startsWith` and use exact match only.

**Missing Domains**: Add `qonsol.app` to trusted origins.

---

### Issue 3: Legacy CORS Export (CRITICAL)

**Current Code** (cors.ts lines 108-111):
```typescript
export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  ...
};
```

**Fix**: Remove this export entirely to force all functions to use `getCorsHeaders(origin)`.

---

## Implementation Order

### Step 1: Update cors.ts Utility
- Remove legacy `corsHeaders` export (lines 102-111)
- Add `qonsol.app` domains to `ALLOWED_ORIGINS`

### Step 2: Update All 21 Edge Functions
For each function:
1. Get origin from request: `const origin = req.headers.get('Origin');`
2. Generate dynamic headers: `const corsHeaders = getCorsHeaders(origin);`
3. Use in OPTIONS handler: `return handleCorsOptions(corsHeaders);`
4. Use in all responses: `headers: { ...corsHeaders, 'Content-Type': 'application/json' }`

### Step 3: Fix ErrorBoundary
- Remove `startsWith` from origin matching
- Add `qonsol.app` production domains to trusted list

### Step 4: Documentation Cleanup
- Fix PostHog comment to reflect actual masking behavior

---

## Files to Modify

### Modified Files (22):
1. `supabase/functions/_shared/cors.ts` - Remove legacy export
2. `src/components/ErrorBoundary.tsx` - Fix origin matching
3. `src/lib/posthog.ts` - Fix comment
4. 21 edge function files - Implement dynamic CORS

---

## Success Criteria

After implementation:
- No edge function uses wildcard `*` for CORS
- All edge functions call `getCorsHeaders(origin)` dynamically
- ErrorBoundary only matches exact trusted origins
- `qonsol.app` domains included in both CORS and ErrorBoundary lists
- Legacy `corsHeaders` export removed from codebase

---

## Technical Implementation Notes

### Pattern for Each Edge Function:

```typescript
import { getCorsHeaders, handleCorsOptions } from "../_shared/cors.ts";

serve(async (req) => {
  const origin = req.headers.get('Origin');
  const corsHeaders = getCorsHeaders(origin);
  
  if (req.method === 'OPTIONS') {
    return handleCorsOptions(corsHeaders);
  }

  try {
    // ... handler logic
    return new Response(JSON.stringify(data), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
```

### Updated ALLOWED_ORIGINS List:

```typescript
const ALLOWED_ORIGINS: readonly string[] = [
  // Production
  'https://qonsol.app',
  'https://www.qonsol.app',
  
  // Lovable preview/deploy URLs
  'https://id-preview--5c8b7a90-dc2a-4bd7-9069-c2c2cd2e6062.lovable.app',
  
  // Development
  'http://localhost:8080',
  'http://localhost:5173',
  'http://localhost:3000',
] as const;
```

### Updated ErrorBoundary TRUSTED_ORIGINS:

```typescript
const TRUSTED_ORIGINS = [
  'https://lovable.dev',
  'https://www.lovable.dev',
  'https://qonsol.app',
  'https://www.qonsol.app',
  'https://id-preview--5c8b7a90-dc2a-4bd7-9069-c2c2cd2e6062.lovable.app',
] as const;
```
