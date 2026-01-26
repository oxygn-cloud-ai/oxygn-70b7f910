
# Revised Plan: Per-User API Keys Only (No Global Fallbacks)

## Overview

Remove ALL global environment variable fallbacks for OpenAI, Gemini, and Manus API keys. All API keys must be stored per-user in the encrypted `user_credentials` table with zero fallback mechanism.

---

## Security Architecture

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│                              CLIENT SIDE                                     │
│  User enters API key → Sent via HTTPS to credentials-manager               │
│  → Key is NEVER stored client-side                                          │
│  → Only boolean status returned (configured/not configured)                 │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │ HTTPS Only
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                           EDGE FUNCTIONS                                     │
│  getOpenAIApiKey(authHeader) → user key or null (NO FALLBACK)              │
│  getGeminiApiKey(authHeader) → user key or null (NO FALLBACK)              │
│  getManusApiKey(authHeader) → user key or null (NO FALLBACK)               │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                              DATABASE                                        │
│  user_credentials: AES-256 encrypted via pgp_sym_encrypt                   │
│  RLS: user_id = auth.uid()                                                  │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Phase 1: Update Error Codes

### File: `supabase/functions/_shared/errorCodes.ts`

**Add new error codes after line 49:**
```typescript
// OpenAI-Specific
OPENAI_NOT_CONFIGURED: 'OPENAI_NOT_CONFIGURED',
OPENAI_INVALID_KEY: 'OPENAI_INVALID_KEY',
OPENAI_API_ERROR: 'OPENAI_API_ERROR',

// Gemini-Specific
GEMINI_NOT_CONFIGURED: 'GEMINI_NOT_CONFIGURED',
GEMINI_INVALID_KEY: 'GEMINI_INVALID_KEY',
```

**Add metadata after line 103:**
```typescript
OPENAI_NOT_CONFIGURED: { httpStatus: 400, recoverable: false, userMessage: 'OpenAI API key not configured. Add your key in Settings → Integrations → OpenAI.' },
OPENAI_INVALID_KEY: { httpStatus: 401, recoverable: false, userMessage: 'Invalid OpenAI API key' },
OPENAI_API_ERROR: { httpStatus: 502, recoverable: true, userMessage: 'OpenAI API error' },
GEMINI_NOT_CONFIGURED: { httpStatus: 400, recoverable: false, userMessage: 'Gemini API key not configured. Add your key in Settings → Integrations.' },
GEMINI_INVALID_KEY: { httpStatus: 401, recoverable: false, userMessage: 'Invalid Gemini API key' },
```

---

## Phase 2: Update Shared Credential Helpers

### File: `supabase/functions/_shared/credentials.ts`

**Change 1: Add timeout-protected wrapper (after line 49)**
```typescript
/**
 * Get decrypted credential with timeout protection
 * Returns null on timeout or error - NO FALLBACK to env vars
 */
async function getDecryptedCredentialWithTimeout(
  authHeader: string,
  service: string,
  key: string,
  timeoutMs: number = 5000
): Promise<string | null> {
  try {
    const result = await Promise.race<string | null>([
      getDecryptedCredential(authHeader, service, key),
      new Promise<null>((_, reject) => 
        setTimeout(() => reject(new Error('Credential lookup timeout')), timeoutMs)
      )
    ]);
    return result;
  } catch (error) {
    console.warn(`[credentials] Timeout/error fetching ${service}/${key}:`, error);
    return null;
  }
}
```

**Change 2: Replace getManusApiKey (lines 54-63)**
```typescript
/**
 * Get Manus API key from user credentials (NO global fallback)
 */
export async function getManusApiKey(
  authHeader: string
): Promise<string | null> {
  return getDecryptedCredentialWithTimeout(authHeader, 'manus', 'api_key');
}
```

**Change 3: Add OpenAI helper (new function)**
```typescript
/**
 * Get OpenAI API key from user credentials (NO global fallback)
 */
export async function getOpenAIApiKey(
  authHeader: string
): Promise<string | null> {
  return getDecryptedCredentialWithTimeout(authHeader, 'openai', 'api_key');
}
```

**Change 4: Add Gemini helper (new function)**
```typescript
/**
 * Get Gemini API key from user credentials (NO global fallback)
 */
export async function getGeminiApiKey(
  authHeader: string
): Promise<string | null> {
  return getDecryptedCredentialWithTimeout(authHeader, 'gemini', 'api_key');
}
```

---

## Phase 3: Update Edge Functions - Standard Pattern

### Transformation Pattern for Non-SSE Functions

**BEFORE:**
```typescript
const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');
if (!OPENAI_API_KEY) {
  return new Response(
    JSON.stringify({ error: 'OpenAI API key not configured' }),
    { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}
```

**AFTER:**
```typescript
import { getOpenAIApiKey } from "../_shared/credentials.ts";
import { ERROR_CODES, buildErrorResponse, getHttpStatus } from "../_shared/errorCodes.ts";

// ... inside handler after auth validation ...
const OPENAI_API_KEY = await getOpenAIApiKey(authHeader);
if (!OPENAI_API_KEY) {
  return new Response(
    JSON.stringify(buildErrorResponse(ERROR_CODES.OPENAI_NOT_CONFIGURED)),
    { status: getHttpStatus(ERROR_CODES.OPENAI_NOT_CONFIGURED), headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}
```

### Files Using Standard Pattern (11 files):

| # | File | Line | Notes |
|---|------|------|-------|
| 1 | `openai-proxy/index.ts` | 86 | Standard pattern |
| 2 | `conversation-manager/index.ts` | 82 | Standard pattern |
| 3 | `thread-manager/index.ts` | 118 | Key fetch must move AFTER auth, BEFORE line 160 |
| 4 | `openai-billing/index.ts` | 61 | Standard pattern |
| 5 | `conversation-cancel/index.ts` | 49 | Standard pattern |
| 6 | `batch-embeddings/index.ts` | 109 | Standard pattern |
| 7 | `studio-chat/index.ts` | 127 | Local function receives key as param (OK) |
| 8 | `confluence-manager/index.ts` | 1001 | Standard pattern |
| 9 | `resource-health/index.ts` | 453 | Standard pattern |
| 10 | `generate-embedding/index.ts` | 35 | Admin-only: use calling user's key |
| 11 | `test-openai-delete/index.ts` | 41 | Admin-only: use calling user's key |

---

## Phase 4: Update Edge Functions - SSE Emitter Pattern

### Transformation Pattern for SSE Functions

**BEFORE (conversation-run lines 1833-1840):**
```typescript
const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');
// ...
if (!OPENAI_API_KEY) {
  emitter.emit({ type: 'error', error: 'OpenAI API key not configured', error_code: 'CONFIG_ERROR' });
  return;
}
```

**AFTER:**
```typescript
import { getOpenAIApiKey } from "../_shared/credentials.ts";
import { ERROR_CODES } from "../_shared/errorCodes.ts";

// ... inside handler after auth validation ...
const OPENAI_API_KEY = await getOpenAIApiKey(authHeader);
if (!OPENAI_API_KEY) {
  emitter.emit({ 
    type: 'error', 
    error: 'OpenAI API key not configured. Add your key in Settings → Integrations → OpenAI.', 
    error_code: ERROR_CODES.OPENAI_NOT_CONFIGURED 
  });
  return;
}
```

### Files Using SSE Pattern (2 files):

| # | File | Line | Notes |
|---|------|------|-------|
| 1 | `conversation-run/index.ts` | 1833-1840 | SSE emitter pattern |
| 2 | `prompt-family-chat/index.ts` | 938-952 | SSE emitter pattern, also add `emitter.close()` after emit |

---

## Phase 5: Update fetch-provider-models - Internal Function Pattern

### File: `supabase/functions/fetch-provider-models/index.ts`

**Change 1: Update imports (line 1 area)**
```typescript
import { getOpenAIApiKey } from "../_shared/credentials.ts";
```

**Change 2: Replace fetchOpenAIModels function (lines 51-131)**
```typescript
async function fetchOpenAIModels(authHeader: string): Promise<ModelData[]> {
  const apiKey = await getOpenAIApiKey(authHeader);
  if (!apiKey) {
    throw new Error('OpenAI API key not configured. Add your key in Settings → Integrations → OpenAI.');
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10000);

  try {
    const response = await fetch('https://api.openai.com/v1/models', {
      headers: { 'Authorization': `Bearer ${apiKey}` },
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`OpenAI API error: ${response.status} - ${errorText}`);
    }

    // ... rest of function unchanged ...
  } catch (err: unknown) {
    clearTimeout(timeoutId);
    const error = err as Error;
    if (error.name === 'AbortError') {
      throw new Error('OpenAI API request timed out');
    }
    throw error;
  }
}
```

**Change 3: Update caller (around line 232)**
```typescript
// BEFORE:
if (provider === 'openai') {
  models = await fetchOpenAIModels();
}

// AFTER:
if (provider === 'openai') {
  models = await fetchOpenAIModels(authHeader);
}
```

---

## Phase 6: Update execution-manager - Helper Function Pattern

### File: `supabase/functions/execution-manager/index.ts`

**Change 1: Update function signature (line 344)**
```typescript
// BEFORE:
async function deletePreviousTraceResponses(traceId: string, supabase: any) {
  const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');
  if (!OPENAI_API_KEY) {
    console.warn('No OpenAI API key, skipping response deletion');
    return;
  }

// AFTER:
async function deletePreviousTraceResponses(
  traceId: string, 
  supabase: any, 
  openAIApiKey: string | null
): Promise<void> {
  if (!openAIApiKey) {
    console.warn('No OpenAI API key, skipping response deletion');
    return;
  }
```

**Change 2: Update all callers of deletePreviousTraceResponses**
Find all calls to this function and pass the API key:
```typescript
// Get key once at handler level
const OPENAI_API_KEY = await getOpenAIApiKey(authHeader);

// Pass to helper
await deletePreviousTraceResponses(traceId, supabase, OPENAI_API_KEY);
```

---

## Phase 7: Update manus-key-validate

### File: `supabase/functions/manus-key-validate/index.ts`

**Change (lines 67-69)**
```typescript
// BEFORE:
const envKey = Deno.env.get('MANUS_API_KEY');
const keySource = envKey ? 'env' : 'user';

// AFTER:
const keySource = 'user'; // Always user - no global fallback
```

**All 5 response locations using `keySource` will now return 'user' (correct behavior)**

---

## Phase 8: Update credentials-manager get_status

### File: `supabase/functions/credentials-manager/index.ts`

**Add explicit 'openai' case (around line 126)**
```typescript
} else if (service === 'gemini' || service === 'google') {
  status.api_key = configuredKeys.includes('api_key');
} else if (service === 'openai') {
  status.api_key = configuredKeys.includes('api_key');
} else {
```

---

## Phase 9: Update Frontend Hook

### File: `src/hooks/useUserCredentials.ts`

**Add 'openai' case (after line 134)**
```typescript
if (service === 'manus') {
  return status.api_key === true;
}

if (service === 'openai') {
  return status.api_key === true;
}
```

---

## Phase 10: Create OpenAI Settings Component

### New File: `src/components/settings/OpenAIIntegrationSettings.tsx`

Following `GeminiSection` pattern from SettingsContent.tsx (lines 2209-2371):

```typescript
import React, { useState, useEffect } from "react";
import { Key, Eye, EyeOff, Trash2, Save, ExternalLink, Loader2, CheckCircle, XCircle } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { SettingCard } from "@/components/ui/setting-card";
import { SettingRow } from "@/components/ui/setting-row";
import { useUserCredentials } from "@/hooks/useUserCredentials";
import { toast } from "@/components/ui/sonner";
import { trackEvent } from '@/lib/posthog';

interface OpenAIIntegrationSettingsProps {}

const OpenAIIntegrationSettings: React.FC<OpenAIIntegrationSettingsProps> = () => {
  const { 
    credentialStatus, 
    getCredentialStatus, 
    setCredential, 
    deleteCredential,
    isLoading: isCredLoading 
  } = useUserCredentials();
  
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [apiKey, setApiKey] = useState<string>('');
  const [showKey, setShowKey] = useState<boolean>(false);

  useEffect(() => {
    getCredentialStatus('openai');
  }, [getCredentialStatus]);

  const openaiStatus = credentialStatus['openai'] || {};
  const isConfigured = openaiStatus.api_key === true;

  const handleSaveKey = async (): Promise<void> => {
    if (!apiKey.trim()) {
      toast.error('Please enter an API key');
      return;
    }
    
    // Basic format validation
    if (!apiKey.trim().startsWith('sk-')) {
      toast.error('OpenAI API keys should start with "sk-"');
      return;
    }
    
    setIsSaving(true);
    try {
      await setCredential('openai', 'api_key', apiKey.trim());
      setApiKey('');
      toast.success('OpenAI API key saved');
      trackEvent('openai_api_key_saved');
    } catch (error) {
      toast.error('Failed to save API key');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteKey = async (): Promise<void> => {
    setIsSaving(true);
    try {
      await deleteCredential('openai', 'api_key');
      toast.success('OpenAI API key removed');
      trackEvent('openai_api_key_deleted');
    } catch (error) {
      toast.error('Failed to remove API key');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Status Card */}
      <SettingCard label="Connection">
        <SettingRow
          label="Status"
          description={isConfigured ? "Your OpenAI API key is configured" : "No API key configured"}
        >
          <div className="flex items-center gap-2">
            {isCredLoading ? (
              <Loader2 className="h-4 w-4 animate-spin text-on-surface-variant" />
            ) : isConfigured ? (
              <CheckCircle className="h-4 w-4 text-green-500" />
            ) : (
              <XCircle className="h-4 w-4 text-red-500" />
            )}
            <span className="text-body-sm text-on-surface-variant">
              {isConfigured ? "Connected" : "Not Connected"}
            </span>
          </div>
        </SettingRow>
      </SettingCard>

      {/* API Key Card */}
      <SettingCard label="API Key">
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <input
              type={showKey ? "text" : "password"}
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder={isConfigured ? "••••••••••••••••" : "sk-..."}
              className="flex-1 px-3 py-2 bg-surface-container rounded-m3-sm border border-outline-variant text-body-sm text-on-surface placeholder:text-on-surface-variant focus:outline-none focus:ring-1 focus:ring-primary"
            />
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={() => setShowKey(!showKey)}
                  className="w-8 h-8 flex items-center justify-center rounded-m3-full hover:bg-surface-container"
                >
                  {showKey ? (
                    <EyeOff className="h-4 w-4 text-on-surface-variant" />
                  ) : (
                    <Eye className="h-4 w-4 text-on-surface-variant" />
                  )}
                </button>
              </TooltipTrigger>
              <TooltipContent>{showKey ? "Hide" : "Show"}</TooltipContent>
            </Tooltip>
          </div>
          
          <div className="flex items-center gap-2">
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={handleSaveKey}
                  disabled={isSaving || !apiKey.trim()}
                  className="w-8 h-8 flex items-center justify-center rounded-m3-full hover:bg-surface-container disabled:opacity-50"
                >
                  {isSaving ? (
                    <Loader2 className="h-4 w-4 animate-spin text-on-surface-variant" />
                  ) : (
                    <Save className="h-4 w-4 text-on-surface-variant" />
                  )}
                </button>
              </TooltipTrigger>
              <TooltipContent>Save API Key</TooltipContent>
            </Tooltip>
            
            {isConfigured && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={handleDeleteKey}
                    disabled={isSaving}
                    className="w-8 h-8 flex items-center justify-center rounded-m3-full hover:bg-surface-container disabled:opacity-50"
                  >
                    <Trash2 className="h-4 w-4 text-on-surface-variant" />
                  </button>
                </TooltipTrigger>
                <TooltipContent>Remove API Key</TooltipContent>
              </Tooltip>
            )}
            
            <Tooltip>
              <TooltipTrigger asChild>
                <a
                  href="https://platform.openai.com/api-keys"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-8 h-8 flex items-center justify-center rounded-m3-full hover:bg-surface-container"
                >
                  <ExternalLink className="h-4 w-4 text-on-surface-variant" />
                </a>
              </TooltipTrigger>
              <TooltipContent>Get API Key from OpenAI</TooltipContent>
            </Tooltip>
          </div>
        </div>
      </SettingCard>

      {/* Info Card */}
      <SettingCard label="About">
        <div className="space-y-2">
          <p className="text-body-sm text-on-surface-variant">
            Your OpenAI API key is used for all AI operations including cascade runs, 
            conversations, and embeddings.
          </p>
          <p className="text-[10px] text-on-surface-variant">
            Your API key is encrypted with AES-256 and stored securely. 
            It is never exposed to the frontend or logged.
          </p>
        </div>
      </SettingCard>
    </div>
  );
};

export default OpenAIIntegrationSettings;
```

---

## Phase 11: Add OpenAI to Settings Menu

### File: `src/components/content/SettingsContent.tsx`

**Change 1: Add import for Key icon (if not present)**
```typescript
import { Settings, Type, Cpu, MessageSquare, FileText, Sparkles, Bot, Palette, Bell, User, BookOpen, Key } from "lucide-react";
```

**Change 2: Add lazy-loaded wrapper (around line 2200, following GeminiSection pattern)**
```typescript
// OpenAI Integration Section - lazy loaded
const OpenAISection = React.lazy(() => import('@/components/settings/OpenAIIntegrationSettings'));
const OpenAIIntegrationWrapper: React.FC = () => (
  <React.Suspense fallback={<div className="p-4 text-on-surface-variant">Loading...</div>}>
    <OpenAISection />
  </React.Suspense>
);
```

**Change 3: Add to SETTINGS_SECTIONS (line 2374)**
```typescript
const SETTINGS_SECTIONS = {
  "qonsol": { component: GeneralSection, icon: Settings, title: "General" },
  "naming": { component: PromptNamingSection, icon: Type, title: "Prompt Naming" },
  "models": { component: AIModelsSection, icon: Cpu, title: "AI Models" },
  "openai": { component: OpenAIIntegrationWrapper, icon: Key, title: "OpenAI" },  // NEW
  "assistants": { component: ConversationDefaultsSection, icon: MessageSquare, title: "Conversation Defaults" },
  // ... rest unchanged
};
```

**Change 4: Add case in getSectionProps (around line 2446)**
```typescript
case 'gemini':
  return {};
case 'openai':
  return {};
case 'notifications':
```

---

## Files Modified Summary

| # | File | Type | Changes |
|---|------|------|---------|
| 1 | `_shared/errorCodes.ts` | Edge | Add OPENAI_NOT_CONFIGURED, GEMINI_NOT_CONFIGURED codes |
| 2 | `_shared/credentials.ts` | Edge | Add timeout wrapper, getOpenAIApiKey, getGeminiApiKey, remove Manus fallback |
| 3 | `openai-proxy/index.ts` | Edge | Use getOpenAIApiKey(authHeader) |
| 4 | `conversation-manager/index.ts` | Edge | Use getOpenAIApiKey(authHeader) |
| 5 | `conversation-run/index.ts` | Edge | SSE pattern with ERROR_CODES |
| 6 | `thread-manager/index.ts` | Edge | Use getOpenAIApiKey(authHeader), timing adjustment |
| 7 | `openai-billing/index.ts` | Edge | Use getOpenAIApiKey(authHeader) |
| 8 | `conversation-cancel/index.ts` | Edge | Use getOpenAIApiKey(authHeader) |
| 9 | `generate-embedding/index.ts` | Edge | Use getOpenAIApiKey(authHeader) - admin uses own key |
| 10 | `batch-embeddings/index.ts` | Edge | Use getOpenAIApiKey(authHeader) |
| 11 | `studio-chat/index.ts` | Edge | Use getOpenAIApiKey(authHeader) |
| 12 | `prompt-family-chat/index.ts` | Edge | SSE pattern with ERROR_CODES |
| 13 | `execution-manager/index.ts` | Edge | Update deletePreviousTraceResponses signature |
| 14 | `confluence-manager/index.ts` | Edge | Use getOpenAIApiKey(authHeader) |
| 15 | `fetch-provider-models/index.ts` | Edge | Update fetchOpenAIModels(authHeader) |
| 16 | `resource-health/index.ts` | Edge | Use getOpenAIApiKey(authHeader) |
| 17 | `test-openai-delete/index.ts` | Edge | Use getOpenAIApiKey(authHeader) - admin uses own key |
| 18 | `manus-key-validate/index.ts` | Edge | Remove env key source detection |
| 19 | `credentials-manager/index.ts` | Edge | Add 'openai' case in get_status |
| 20 | `useUserCredentials.ts` | Frontend | Add 'openai' to isServiceConfigured |
| 21 | `OpenAIIntegrationSettings.tsx` | Frontend | New component |
| 22 | `SettingsContent.tsx` | Frontend | Add OpenAI section, import Key icon |

**Total: 22 files**

---

## Performance Impact

| Metric | Before | After | Notes |
|--------|--------|-------|-------|
| Latency per AI call | 0ms (env lookup) | +50-200ms | Credential lookup via credentials-manager |
| Cascading failure risk | None | Medium | If credentials-manager down, all AI fails |
| Memory | Low | Same | No caching implemented |

**Mitigation**: 5-second timeout in `getDecryptedCredentialWithTimeout` prevents infinite hangs.

---

## Admin Function Policy

**Decision**: Admin-only functions (`generate-embedding`, `test-openai-delete`) will use the calling admin user's personal API key. This ensures:
1. Admins must configure their own keys
2. Billing attribution is per-admin
3. No special "admin key" exception to the security model

---

## Migration Path

When a user attempts an AI operation without a configured key:
1. Edge function returns `400` with `error_code: 'OPENAI_NOT_CONFIGURED'`
2. Error message: "OpenAI API key not configured. Add your key in Settings → Integrations → OpenAI."
3. User navigates to Settings → Integrations → OpenAI
4. User enters their personal OpenAI API key
5. All AI operations work with their key

---

## Testing Checklist

- [ ] `_shared/errorCodes.ts` compiles with new codes
- [ ] `_shared/credentials.ts` timeout wrapper works correctly
- [ ] All 15 edge functions return correct error when no key configured
- [ ] SSE functions (conversation-run, prompt-family-chat) emit errors correctly
- [ ] `fetch-provider-models` passes authHeader to fetchOpenAIModels
- [ ] `execution-manager` helper function receives apiKey parameter
- [ ] `manus-key-validate` always returns keySource: 'user'
- [ ] `useUserCredentials` isServiceConfigured('openai') works
- [ ] `OpenAIIntegrationSettings` saves/deletes keys correctly
- [ ] Settings menu shows OpenAI section
- [ ] No API keys appear in browser console or network logs
- [ ] Admin functions work with admin's personal key
- [ ] Gemini/Manus continue to work without fallback
